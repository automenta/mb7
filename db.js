// db.js
import {openDB} from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
import * as NostrTools from 'https://cdn.jsdelivr.net/npm/nostr-tools@latest/+esm';

const DB_NAME = 'nostr-app-db';
const DB_VERSION = 2;
const OBJECTS_STORE = 'objects';
const KEY_STORAGE = 'nostr_keys';
const FRIENDS_OBJECT_ID = 'friends';
const SETTINGS_OBJECT_ID = 'settings';

/**
 * The main database class for your app.
 * Use DB.DB.initDB() to ensure the DB is open/ready.
 * Then create a new DB.DB() instance for the CRUD methods.
 */
export class DB {
    static db = null;

    constructor() {
        // The constructor doesn't need to open DB; use DB.initDB() instead.
    }

    /**
     * Initialize (or upgrade) the IndexedDB database using `idb`.
     */
    static async initDB() {
        if (this.db) {
            // Already opened
            return this.db;
        }
        // Open (or upgrade) the database
        this.db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                console.log('onupgradeneeded triggered');
                // Create 'objects' store if not present
                if (!db.objectStoreNames.contains(OBJECTS_STORE)) {
                    db.createObjectStore(OBJECTS_STORE, {keyPath: 'id'});
                }

                // Create 'nostr_keys' store if not present
                if (!db.objectStoreNames.contains(KEY_STORAGE)) {
                    db.createObjectStore(KEY_STORAGE);
                }
            },
        });

        return this.db;
    }

    /**
     * Return all objects in the 'objects' store, sorted by createdAt descending.
     */
    async getAll() {
        const db = await DB.initDB();
        const all = await db.getAll(OBJECTS_STORE);
        return all.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    /**
     * Get a single object by its ID.
     */
    async get(id) {
        const db = await DB.initDB();
        return db.get(OBJECTS_STORE, id);
    }

    /**
     * Create or update an object (must have an `id`).
     */
    async save(o) {
        if (!o.id) {
            console.error('Attempted to save an object without an `id`:', o);
            throw new Error('Missing id property on object');
        }
        const db = await DB.initDB();
        await db.put(OBJECTS_STORE, o);
        return o;
    }

    /**
     * Delete an object by ID.
     */
    async delete(id) {
        const db = await DB.initDB();
        await db.delete(OBJECTS_STORE, id);
    }

    /**
     * Return the most recent N objects.
     */
    async getRecent(limit = 5) {
        const all = await this.getAll();
        return all.slice(0, limit);
    }

    /**
     * Return basic stats about all stored objects.
     */
    async getStats() {
        const all = await this.getAll();
        return {
            objectCount: all.length,
            tagCount: all.reduce((acc, obj) => acc + (obj.tags?.length || 0), 0),
        };
    }

    async getFriendsObjectId() {
        return FRIENDS_OBJECT_ID;
    }

    async getFriends() {
        const db = await DB.initDB();
        let friendsObject = await db.get(OBJECTS_STORE, FRIENDS_OBJECT_ID);

        if (!friendsObject) {
            // If the friends object doesn't exist, create it
            friendsObject = {
                id: FRIENDS_OBJECT_ID,
                kind: 30000,
                content: "",
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await db.put(OBJECTS_STORE, friendsObject);
        }

        return friendsObject;
    }

    async addFriend(friend) {
        const db = await DB.initDB();
        const friendsObject = await this.getFriends();

        const existingFriendIndex = friendsObject.tags.findIndex(
            (tag) => tag[0] === "People" && tag[1] === friend.pubkey
        );

        if (existingFriendIndex === -1) {
            // Friend doesn't exist, add them
            friendsObject.tags.push(["People", friend.pubkey, friend.name, friend.picture]);
            friendsObject.updatedAt = new Date().toISOString();
            await db.put(OBJECTS_STORE, friendsObject);
        }
    }

    async removeFriend(pubkey) {
        const db = await DB.initDB();
        const friendsObject = await this.getFriends();

        const friendIndex = friendsObject.tags.findIndex(
            (tag) => tag[0] === "People" && tag[1] === pubkey
        );

        if (friendIndex !== -1) {
            friendsObject.tags.splice(friendIndex, 1);
            friendsObject.updatedAt = new Date().toISOString();
            await db.put(OBJECTS_STORE, friendsObject);
        }
    }

    async updateFriendProfile(pubkey, name, picture) {
        const db = await DB.initDB();
        const friendsObject = await this.getFriends();

        const friendIndex = friendsObject.tags.findIndex(
            (tag) => tag[0] === "People" && tag[1] === pubkey
        );

        if (friendIndex !== -1) {
            friendsObject.tags[friendIndex][2] = name;
            friendsObject.tags[friendIndex][3] = picture;
            friendsObject.updatedAt = new Date().toISOString();
            await db.put(OBJECTS_STORE, friendsObject);
        }
    }

    async getSettingsObjectId() {
        return SETTINGS_OBJECT_ID;
    }

    async getSettings() {
        const db = await DB.initDB();
        let settingsObject = await db.get(OBJECTS_STORE, SETTINGS_OBJECT_ID);

        if (!settingsObject) {
            // If the settings object doesn't exist, create it
            settingsObject = {
                id: SETTINGS_OBJECT_ID,
                kind: 30000,
                content: "",
                tags: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };
            await db.put(OBJECTS_STORE, settingsObject);
        }

        return settingsObject;
    }

   async saveSettings(settings) {
        const db = await DB.initDB();
        let settingsObject = await this.getSettings();

        settingsObject.tags = [];

        // Add settings to the settings object
        if (settings.relays) {
            settingsObject.tags.push(["relays", settings.relays]);
        }
        if (settings.dateFormat) {
            settingsObject.tags.push(["dateFormat", settings.dateFormat]);
        }
  
        if (settings.profileName) {
            settingsObject.tags.push(["profileName", settings.profileName]);
        }
        if (settings.profilePicture) {
            settingsObject.tags.push(["profilePicture", settings.profilePicture]);
        }

        settingsObject.updatedAt = new Date().toISOString();
        await db.put(OBJECTS_STORE, settingsObject);
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
    const db = await DB.initDB();
    const priv = generatePrivateKey();
    const pub = NostrTools.getPublicKey(priv);

    const newKeys = {priv, pub};
    // store under the key "nostr_keys"
    await db.put(KEY_STORAGE, newKeys, KEY_STORAGE);
    return newKeys;
}

/**
 * Load existing keys from DB. If none found, generate a new pair and save it.
 */
export async function loadKeys() {
    const db = await DB.initDB();
    let keys = await db.get(KEY_STORAGE, KEY_STORAGE);
    if (!keys) {
        keys = await generateKeys();
        console.log('Keys generated and saved.');
    }
    return keys;
}
