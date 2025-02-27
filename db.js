// db.js
import * as NostrTools from 'nostr-tools';
import {openDB} from 'idb';
import * as Y from 'yjs'

/**
 * Creates a default object with the given ID and kind.
 */
async function createDefaultObject(db, id, kind = 30000) {
    const now = new Date().toISOString();
    const object = {
        id,
        kind,
        content: '',
        tags: [],
        createdAt: now,
        updatedAt: now,
    };
    await db.put(OBJECTS_STORE, object);
    return object;
}

const DB_NAME = 'nostr-app-db';
const DB_VERSION = 2;
const OBJECTS_STORE = 'objects';
const KEY_STORAGE = 'nostr_keys';
const FRIENDS_OBJECT_ID = 'friends';
const SETTINGS_OBJECT_ID = 'settings';
const NOTES_INDEX_ID = 'notes-index';

/**
 * The main database class for your app.
 * Use DB.DB.initDB() to ensure the DB is open/ready.
 * Then create a new DB.DB() instance for the CRUD methods.
 */
export class DB {
    static db = null;

    constructor() {

    }

    /**
     * Initialize (or upgrade) the IndexedDB database using `idb`.
     */
    static async the() {
        if (this.db)
            return this.db;

        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                console.log('onupgradeneeded triggered');
                if (!db.objectStoreNames.contains(OBJECTS_STORE)) {
                    db.createObjectStore(OBJECTS_STORE, {keyPath: 'id'});
                }
                if (!db.objectStoreNames.contains(KEY_STORAGE)) {
                    db.createObjectStore(KEY_STORAGE);
                }
            },
        });
        await DB.getDefaultObject(FRIENDS_OBJECT_ID);
        await DB.getDefaultObject(SETTINGS_OBJECT_ID);
        return this.db;
    }

    static async getDefaultObject(id) {
        if (!DB.db) {
            await DB.the();
        }
        let object = await DB.db.get(OBJECTS_STORE, id);

        if (!object) {
            object = await createDefaultObject(DB.db, id);
        }

        return object;
    }

    /**
     * Return all objects in the 'objects' store, sorted by createdAt descending.
     */
    async getAll() {
        try {
            const all = await DB.db.getAll(OBJECTS_STORE);
            return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        } catch (error) {
            console.error("getAll failure:", error);
            throw error;
        }
    }

    /**
     * Get a single object by its ID.
     */
    async get(id) {
        try {
            if (!DB.db) {
                await DB.the();
            }
            return DB.db.get(OBJECTS_STORE, id);
        } catch (error) {
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


            throw error;
        }
    }

    /**
     * Create or update an object (must have an `id`).
     */
    async save(o) {
        try {
            if (!o.id) {
                console.error('Attempted to save an object without an `id`:', o);
                throw new Error('Missing id property on object');
            }
            await DB.db.put(OBJECTS_STORE, o);
            return o;
        } catch (error) {
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


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
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


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
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


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
                tagCount: all.reduce((acc, obj) => acc + (obj.tags?.length || 0), 0),
            };
        } catch (error) {
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


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
            const friendsObject = await this.getFriends();
            const existingFriendIndex = friendsObject.tags.findIndex(
                (tag) => tag[0] === 'People' && tag[1] === friend.pubkey
            );

            if (existingFriendIndex === -1) {
                friendsObject.tags.push(['People', friend.pubkey, friend.name, friend.picture]);
                friendsObject.updatedAt = new Date().toISOString();
                await DB.db.put(OBJECTS_STORE, friendsObject);
            }
        } catch (error) {
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


            throw error;
        }
    }

    async removeFriend(pubkey) {
        try {
            const friendsObject = await this.getFriends();
            const friendIndex = friendsObject.tags.findIndex(
                (tag) => tag[0] === 'People' && tag[1] === pubkey
            );

            if (friendIndex !== -1) {
                friendsObject.tags.splice(friendIndex, 1);
                friendsObject.updatedAt = new Date().toISOString();
                await DB.db.put(OBJECTS_STORE, friendsObject);
            }
        } catch (error) {
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


            throw error;
        }
    }

    async updateFriendProfile(pubkey, name, picture) {
        try {
            const friendsObject = await this.getFriends();
            const friendIndex = friendsObject.tags.findIndex(
                (tag) => tag[0] === 'People' && tag[1] === pubkey
            );

            if (friendIndex !== -1) {
                friendsObject.tags[friendIndex][2] = name;
                friendsObject.tags[friendIndex][3] = picture;
                friendsObject.updatedAt = new Date().toISOString();
                await DB.db.put(OBJECTS_STORE, friendsObject);
            }
        } catch (error) {
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


            console.error("Error updating friend profile:", error);
            throw error;
        }
    }

    async getSettingsObjectId() {
        return SETTINGS_OBJECT_ID;
    }

    async getSettings() {
        return DB.getDefaultObject(SETTINGS_OBJECT_ID);
    }

    async saveSettings(settings) {
        let settingsObject = await this.getSettings();

        settingsObject.tags = [];

        const settingsMap = {
            relays: settings.relays,
            dateFormat: settings.dateFormat,
            profileName: settings.profileName,
            profilePicture: settings.profilePicture,
        };

        for (const [key, value] of Object.entries(settingsMap)) {
            if (value) {
                settingsObject.tags.push([key, value]);
            }
        }

        settingsObject.updatedAt = new Date().toISOString();
        try {
            await DB.db.put(OBJECTS_STORE, settingsObject);
        } catch (error) {
            console.error("Failed to save settings:", error);
            console.error("Error updating friend profile:", error);


            console.error("Failed to save settings:", error);
            throw error;
        }
    }

    async saveYDoc(id, yDoc) {
        const yDocData = Y.encodeStateAsUpdate(yDoc);
        await DB.db.put(OBJECTS_STORE, {id: `${id}-ydoc`, yDocData: yDocData});
    }

    async getYDoc(id) {
        const yDocObject = await DB.db.get(OBJECTS_STORE, `${id}-ydoc`);
        if (yDocObject) {
            const yDoc = new Y.Doc();
            Y.applyUpdate(yDoc, yDocObject.yDocData);
            return yDoc;
        } else {
            return null;
        }
    }
}

const generatePrivateKey = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

/**
 * Generate a new private/public key pair and persist it in the DB.
 */
export async function generateKeys() {
    const priv = generatePrivateKey();
    const pub = NostrTools.getPublicKey(priv);

    const newKeys = {priv, pub};
    await DB.db.put(KEY_STORAGE, newKeys, KEY_STORAGE);
    return newKeys;
}

/**
 * Load existing keys from DB. If none found, generate a new pair and save it.
 */
export async function loadKeys() {
    let keys = await DB.db.get(KEY_STORAGE, KEY_STORAGE);
    if (!keys) {
        keys = await generateKeys();
        console.log('Keys generated and saved.');
    }
    return keys;
}

async function getNotesIndex() {
    const index = await DB.getDefaultObject(NOTES_INDEX_ID);
    return index.tags || [];
}

async function updateNotesIndex(newIndex) {
    await DB.db.put(OBJECTS_STORE, {id: NOTES_INDEX_ID, tags: newIndex});
}

export {getNotesIndex, updateNotesIndex};
