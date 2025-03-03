async function upgradeDatabase(db, oldVersion, newVersion, transaction) {
    console.log('onupgradeneeded triggered');
    if (!db.objectStoreNames.contains(OBJECTS_STORE)) {
        const objectStore = db.createObjectStore(OBJECTS_STORE, {keyPath: 'id'});
        objectStore.createIndex('kind', 'kind', {unique: false});
        objectStore.createIndex('content', 'content', {unique: false});
        objectStore.createIndex('tags', 'tags', {unique: false});
        objectStore.createIndex('createdAt', 'createdAt', {unique: false});
        objectStore.createIndex('updatedAt', 'updatedAt', {unique: false});
        objectStore.createIndex('private', 'private', {unique: false});
        objectStore.createIndex('isPersistentQuery', 'isPersistentQuery', {unique: false});
    }
    if (!db.objectStoreNames.contains(KEY_STORAGE)) {
        db.createObjectStore(KEY_STORAGE);
    }
    const objectStore = transaction.objectStore(OBJECTS_STORE);
    if (!objectStore.indexNames.contains('content')) {
        objectStore.createIndex('content', 'content', {unique: false});
    }
}

const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: ["br", "b", "i", "span", "p", "strong", "em", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
};
import DOMPurify from 'dompurify';
import {openDB} from 'idb';
import * as Y from 'yjs'

import {encrypt} from './crypto';
import {addFriend, removeFriend, updateFriendProfile} from './friend';
import {saveSettings} from './settings';
import {createDefaultObject} from './db.utils';
import {loadKeys} from './db.keys';

const DB_NAME = 'nostr-app-db';
const DB_VERSION = 2;
const OBJECTS_STORE = 'objects';
const KEY_STORAGE = 'nostr_keys';
const FRIENDS_OBJECT_ID = 'friends';
const SETTINGS_OBJECT_ID = 'settings';
const NOTES_INDEX_ID = 'notes-index';


export class DB {
    static db = null;

    constructor(app, errorHandler) {
        this.app = app;
        this.errorHandler = errorHandler;
    }

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
        try {
            if (!o.id) {
                console.error('Attempted to save an object without an `id`:', o);
                throw new Error('Missing id property on object');
            }

            await this.validateObjectData(o);

            // Data sanitization - prevent XSS attacks
            o.content = DOMPurify.sanitize(o.content, DOMPURIFY_CONFIG);

            // Deduplication - skip saving if the object hasn't changed
            const existingObject = await this.get(o.id);
            if (existingObject) {
                if (JSON.stringify(existingObject) === JSON.stringify(o)) {
                    console.log('Object has not been modified, skipping save');
                    return o;
                } else {
                    console.log('Object with id ' + o.id + ' already exists, updating...');
                }
            }

            // TODO: Retrieve the user's encryption key instead of generating a new one.
            // TODO: Store the encryption key ID with the object.
            // Enforce privacy by encrypting the object's content
            o.isPersistentQuery = isPersistentQuery;
            await this.enforcePrivacy(o);
            await DB.db.put(OBJECTS_STORE, o);

            try {
                // Yjs integration - enables collaborative editing and offline support
                // Operational Transformation (OT) for text-based NObjects
                console.log('Using OT for text-based NObject');

                // Get the YDoc for the object, create if it doesn't exist
                let yDoc = await this.getYDoc(o.id) || new Y.Doc();

                // Get the YText object from the YDoc
                const yText = yDoc.getText('content');

                // Apply the changes to the YText object within a transaction
                yDoc.transact(() => {
                    yText.delete(0, yText.length);
                    yText.insert(0, o.content);
                });

                // Save the YDoc
                await this.saveYDoc(o.id, yDoc);
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

    async saveYDoc(id, yDoc) {
        try {
            const yDocData = Y.encodeStateAsUpdate(yDoc);
            await DB.db.put(OBJECTS_STORE, {id: `${id}-ydoc`, yDocData: yDocData});
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to save YDoc with ID: ${id}`, error);
            console.error(`Failed to save YDoc with ID: ${id}`, error);
        }
    }

    async getYDoc(id) {
        await DB.the();
        try {
            const yDocObject = await DB.db.get(OBJECTS_STORE, `${id}-ydoc`);
            if (yDocObject) {
                const yDoc = new Y.Doc();
                Y.applyUpdate(yDoc, yDocObject.yDocData);
                return yDoc;
            } else {
                return null;
            }
        } catch (error) {
            this.errorHandler.handleError(error, "Failed to get YDoc", error);
            console.error("Failed to get YDoc:", error);
            return null;
        }
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
     * Implements privacy controls to ensure NObjects are private by default.
     * @param {object} object - The NObject to apply privacy controls to.
     * Enforces privacy by encrypting the object's content.
     *
     * This function encrypts the object's content to ensure privacy.
     */
    async enforcePrivacy(object) {
        try {
            const keys = await this.getKeys();
            if (!keys || !keys.encryptionKey) {
                return;
            }

            const encryptedData = await encrypt(object.content, keys.encryptionKey);
            object.content = `ENCRYPTED:${encryptedData}`;
            object.private = true;
            // object.encryptionKeyId = keys.encryptionKey.id; // Store key ID if needed - encryptionKey object doesn't have id field
            console.log(`Enforcing privacy for object: ${object.id}`);
        } catch (error) {
            this.errorHandler.handleError(error, "Failed to enforce privacy", error);
            console.error("Failed to enforce privacy:", error);
        }
    }

    /**
     * Executes persistent queries and notifies the user of any new matches.
     */
    async executePersistentQueries() {
        try {
            const persistentQueries = await this.getAll().filter(obj => obj.isPersistentQuery === true);

            for (const query of persistentQueries) {
                const matches = await this.app.matcher.findMatches(query);

                if (matches.length > 0) {
                    //dedupe matches
                    const uniqueMatches = [...new Set(matches.map(m => m.id))].map(id => matches.find(m => m.id === id));

                    this.app.showNotification(
                        `Match in ${uniqueMatches.length} object(s) for persistent query <em>${query.name}</em>:<br>${uniqueMatches.map(m => `<em>${m.name}</em> (updated ${formatDate(m.updatedAt)})`).join("<br>")}`
                    );
                }
            }
        } catch (error) {
            this.errorHandler.handleError(error, "Failed to execute persistent queries", error);
            console.error("Failed to execute persistent queries:", error);
        }
    }
}

setInterval(() => {
    DB.the().then(db => db.executePersistentQueries());
}, 60000); // Run every minute