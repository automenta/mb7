import DOMPurify from 'dompurify';
import {openDB} from 'idb';

import {addFriend, removeFriend, updateFriendProfile} from './friend';
import {saveSettings} from './settings';
import {createDefaultObject} from './db.utils';
import {loadKeys} from './db.keys';
import {saveYDoc, getYDoc} from './db.ydoc';
import {enforcePrivacy} from './db.privacy';
import {formatDate} from "../ui/content-view-renderer";

const DB_NAME = 'nostr-app-db';
const DB_VERSION = 2;
const OBJECTS_STORE = 'objects';
const KEY_STORAGE = 'nostr_keys';
const FRIENDS_OBJECT_ID = 'friends';
const SETTINGS_OBJECT_ID = 'settings';
const NOTES_INDEX_ID = 'notes-index';

const DB_SCHEMA = {
    [OBJECTS_STORE]: {
        keyPath: 'id',
        indices: [
            {name: 'kind', keyPath: 'kind', unique: false},
            {name: 'content', keyPath: 'content', unique: false},
            {name: 'tags', keyPath: 'tags', unique: false},
            {name: 'createdAt', keyPath: 'createdAt', unique: false},
            {name: 'updatedAt', keyPath: 'updatedAt', unique: false},
            {name: 'private', keyPath: 'private', unique: false},
            {name: 'isPersistentQuery', keyPath: 'isPersistentQuery', unique: false},
            {name: 'content', keyPath: 'content', unique: false}
        ]
    },
    [KEY_STORAGE]: {}
};

const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: ["br", "b", "i", "span", "p", "strong", "em", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
};

/**
 * Upgrades the database schema.
 * @param {IDBDatabase} db - The database object.
 * @param {number} oldVersion - The old version of the database.
 * @param {number} newVersion - The new version of the database.
 * @param {IDBTransaction} transaction - The database transaction.
 */
async function upgradeDatabase(db, oldVersion, newVersion, transaction) {
    console.log('onupgradeneeded triggered');

    for (const storeName in DB_SCHEMA) {
        if (!db.objectStoreNames.contains(storeName)) {
            const storeConfig = DB_SCHEMA[storeName];
            const objectStore = db.createObjectStore(storeName, {keyPath: storeConfig.keyPath});

            storeConfig.indices?.forEach(index => {
                objectStore.createIndex(index.name, index.keyPath, {unique: index.unique});
            });
        }
    }

    const objectStore = transaction.objectStore(OBJECTS_STORE);
    if (!objectStore.indexNames.contains('content')) {
        objectStore.createIndex('content', 'content', {unique: false});
    }
}

export class DB {
    static db = null;

    /**
     * Constructor for the DB class.
     * @param {object} app - The application object.
     * @param {object} errorHandler - The error handler object.
     */
    constructor(app, errorHandler) {
        this.app = app;
        this.errorHandler = errorHandler;
    }

    /**
     * Initializes the database.
     * @returns {Promise<DB>} - The database object.
     */
    static async the() {
        if (this.db) return this.db;

        console.log("DB.the - opening database");
        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade: upgradeDatabase,
        });
        await DB.getDefaultObject(FRIENDS_OBJECT_ID);
        await DB.getDefaultObject(SETTINGS_OBJECT_ID);
        return this.db;
    }

    /**
     * Gets the default object.
     * @param {string} id - The ID of the object to get.
     * @returns {Promise<object>} - The default object.
     */
    static async getDefaultObject(id) {
        if (!DB.db) await DB.the();

        let object = await DB.db.get(OBJECTS_STORE, id);
        return object ? object : await createDefaultObject(DB.db, id);
    }

    /**
     * Validates the data of an object.
     * @param {object} o - The object to validate.
     */
    async validateObjectData(o) {
        if (typeof o.kind !== 'string') {
            throw new Error('Kind must be a string');
        }
        if (typeof o.content !== 'string') {
            this.errorHandler.handleError(new Error('Content must be a string'), "Failed to save object");
            throw new Error('Content must be a string');
        }
        if (!Array.isArray(o.tags)) {
            this.errorHandler.handleError(new Error('Tags must be an array'), "Failed to save object");
            throw new Error('Tags must be an array');
        }
    }

    /**
     * Initializes the keys.
     * @returns {Promise<object>} - The initialized keys.
     */
    async initializeKeys() {
        const keys = await loadKeys();
        if (keys) {
            window.keys = keys;
            return keys;
        }
        return null;
    }

    /**
     * Return all objects in the 'objects' store, sorted by createdAt descending.
     * @param {string} filter - The filter to apply to the objects.
     */
    async getAll(filter = "") {
        try {
            let all = [];
            if (filter) {
                const index = DB.db.transaction(OBJECTS_STORE).objectStore(OBJECTS_STORE).index('content');
                let cursor = await index.openCursor(filter.toLowerCase());
                while (cursor) {
                    all.push(cursor.value);
                    cursor = await cursor.continue();
                }
            } else {
                all = await DB.db.getAll(OBJECTS_STORE);
            }
            return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            this.errorHandler.handleError(error, "Failed to get all objects", error);
            console.error("getAll failure:", error);
            throw error;
        }

    }

    /**
     * Get a single object by its ID.
     * @param {string} filter - The filter to apply to the objects.
     */
    async get(id) {
        try {
            if (!DB.db)
                await DB.the();

            console.log("DB.get - id:", id);
            const result = await DB.db.get(OBJECTS_STORE, id);
            console.log("DB.get - result:", result);
            return result;
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to get object with ID: ${id}`, error);
            console.error(`Failed to get object with ID: ${id}`, error);
            throw error;
        }
    }

    /**
     * Create or update an object (must have an `id`).
     * @param {object} o - The object to save.
     * @param {boolean} isPersistentQuery - Whether the object is a persistent query.
     */
    async save(o, isPersistentQuery) {
        if (!o.id) {
            console.error('Attempted to save an object without an `id`:', o);
            throw new Error('Missing id property on object');
        }

        try {
            await this.validateObjectData(o);

            // Data sanitization - prevent XSS attacks
            o.content = DOMPurify.sanitize(o.content, DOMPURIFY_CONFIG);

            // Deduplication - skip saving if the object hasn't changed
            const existingObject = await this.get(o.id);
            if (existingObject && JSON.stringify(existingObject) === JSON.stringify(o)) {
                console.log('Object has not been modified, skipping save');
                return o;
            } else {
                console.log('Object with id ' + o.id + ' already exists, updating...');
            }

            o.isPersistentQuery = isPersistentQuery;

            // Enforce privacy
            await enforcePrivacy(this, o);

            // Save the object
            await DB.db.put(OBJECTS_STORE, o);

            // Yjs integration
            try {
                await saveYDoc(this, o);
            } catch (error) {
                this.errorHandler.handleError(error, "Failed to integrate with Yjs", error);
                console.error("Failed to integrate with Yjs:", error);
            }

            return o;
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to save object with ID: ${o.id}`, error);
            console.error(`Failed to save object with ID: ${o.id}`, error);
            throw error;
        }
    }

    /**
     * Delete an object by ID.
     */
    async delete(id) {
        try {
            await DB.db.delete(OBJECTS_STORE, id);
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to delete object with ID: ${id}`, error);
            console.error(`Failed to delete object with ID: ${id}`, error);
            throw error;
        }
    }

    /**
     * Return the most recent N objects.
     */
    async getRecent(limit = 5) {
        try {
            const all = await this.getAll();
            return all.slice(0, limit);
        } catch (error) {
            this.errorHandler.handleError("Failed to get recent objects", error);
            throw error;
        }
    }

    /**
     * Return basic stats about all stored objects.
     */
    async getStats() {
        try {
            const all = await this.getAll();
            return {
                objectCount: all.length,
                tagCount: all.reduce((acc, obj) => acc + (obj.tags?.length || 0), 0)
            };
        } catch (error) {
            this.errorHandler.handleError("Failed to get object stats", error);
            throw error;
        }
    }

    async getFriendsObjectId() {
        return FRIENDS_OBJECT_ID;
    }

    async getFriends() {
        return DB.getDefaultObject(FRIENDS_OBJECT_ID);
    }

    async addFriend(friend) {
        try {
            await addFriend(DB.db, FRIENDS_OBJECT_ID, friend);
        } catch (error) {
            this.errorHandler.handleError(`Failed to add friend: ${friend}`, error);
            throw error;
        }
    }

    async removeFriend(pubkey) {
        try {
            await removeFriend(DB.db, FRIENDS_OBJECT_ID, pubkey);
        } catch (error) {
            this.errorHandler.handleError(`Failed to remove friend: ${pubkey}`, error);
            throw error;
        }
    }

    async updateFriendProfile(pubkey, name, picture) {
        try {
            await updateFriendProfile(DB.db, FRIENDS_OBJECT_ID, pubkey, name, picture);
        } catch (error) {
            this.errorHandler.handleError(`Failed to update friend profile: ${pubkey}`, error);
            throw error;
        }
    }

    async getSettingsObjectId() {
        return SETTINGS_OBJECT_ID;
    }

    async getSettings(yDoc) {
        let settings = await DB.getDefaultObject(SETTINGS_OBJECT_ID);
        return settings;
    }

    async saveSettings(settings) {
        try {
            await saveSettings(DB.db, SETTINGS_OBJECT_ID, settings);
        } catch (error) {
            this.errorHandler.handleError(`Failed to save settings: ${settings}`, error);
            throw error;
        }
    }

    async getYDoc(id) {
        return await getYDoc(this, id);
    }

    async deleteCurrentObject(note) {
        try {
            await DB.db.delete(OBJECTS_STORE, note.id);
        } catch (error) {
            this.errorHandler.handleError("Failed to delete object:", error);
            throw error;
        }
    }

    async getAllObjects(filter = "") {
        return await this.getAll(filter);
    }

    async saveObject(object) {
        return await this.save(object);
    }

    async removeObject(id) {
        return await this.delete(id);
    }

    async getKeys() {
        return await loadKeys();
    }

    async saveKeys(keys) {
        return DB.db.put(KEY_STORAGE, keys, KEY_STORAGE);
    }

    /**
     * Executes persistent queries and notifies the user of any new matches.
     */
    async executePersistentQueries() {
        try {
            const persistentQueries = await this.getAll().filter(obj => obj.isPersistentQuery === true);

            await Promise.all(persistentQueries.map(async query => {
                const matches = await this.app.matcher.findMatches(query));
                if (matches.length > 0) {
                    this.notifyPersistentQueryMatches(query, matches);
                }
            }));
        } catch (error) {
            this.errorHandler.handleError(error, "Failed to execute persistent queries", error);
            console.error("Failed to execute persistent queries:", error);
        }
    }

    /**
     * Notifies the user of matches for a persistent query.
     * @param {object} query - The persistent query object.
     * @param {array} matches - The array of matched objects.
     */
    notifyPersistentQueryMatches(query, matches) {
        // Deduplicate matches
        const uniqueMatches = [...new Set(matches.map(m => m.id))].map(id => matches.find(m => m.id === id));

        const message = `Match in ${uniqueMatches.length} object(s) for persistent query <em>${query.name}</em>:<br>${uniqueMatches.map(m => `<em>${m.name}</em> (updated ${formatDate(m.updatedAt)})`).join("<br>")}`;

        this.app.showNotification(message);
    }
}

setInterval(() => {
    DB.the().then(db => db.executePersistentQueries());
}, 60000);
