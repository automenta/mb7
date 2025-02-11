// db.js
import { openDB } from 'https://cdn.jsdelivr.net/npm/idb@7/+esm';
import * as NostrTools from 'https://cdn.jsdelivr.net/npm/nostr-tools@latest/+esm';

const DB_NAME = 'nostr-app-db';
const DB_VERSION = 2;
const OBJECTS_STORE = 'objects';
const FRIENDS_STORE = 'friends';
const KEY_STORAGE = 'nostr_keys';

/**
 * The main database class for your app.
 * Use DB.DB.initDB() to ensure the DB is open/ready.
 * Then create a new DB.DB() instance for the CRUD methods.
 */
export class DB {
    static db = null;

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
                    db.createObjectStore(OBJECTS_STORE, { keyPath: 'id' });
                }

                // Create 'friends' store + indexes if not present
                if (!db.objectStoreNames.contains(FRIENDS_STORE)) {
                    const friendsStore = db.createObjectStore(FRIENDS_STORE, { keyPath: 'pubkey' });
                    friendsStore.createIndex('last_updated', 'last_updated');
                    friendsStore.createIndex('name', 'name');
                }

                // Create 'nostr_keys' store if not present
                if (!db.objectStoreNames.contains(KEY_STORAGE)) {
                    db.createObjectStore(KEY_STORAGE);
                }
            },
        });

        return this.db;
    }

    constructor() {
        // The constructor doesn't need to open DB; use DB.initDB() instead.
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

    /**
     * Add a friend record if it does not exist.
     */
    async addFriend(pubkey) {
        const db = await DB.initDB();
        const existing = await db.get(FRIENDS_STORE, pubkey);
        if (!existing) {
            await db.put(FRIENDS_STORE, {
                pubkey,
                last_updated: Date.now(),
            });
        }
    }

    /**
     * Get a friend's info by pubkey.
     */
    async getFriend(pubkey) {
        const db = await DB.initDB();
        return db.get(FRIENDS_STORE, pubkey);
    }

    /**
     * Get all friends.
     */
    async getFriends() {
        const db = await DB.initDB();
        return db.getAll(FRIENDS_STORE);
    }

    /**
     * Remove a friend record by pubkey.
     */
    async removeFriend(pubkey) {
        const db = await DB.initDB();
        await db.delete(FRIENDS_STORE, pubkey);
    }

    /**
     * Set or update a friend's name/picture fields.
     */
    async updateFriendProfile(pubkey, name, picture) {
        const db = await DB.initDB();
        const friend = await db.get(FRIENDS_STORE, pubkey);
        if (friend) {
            friend.name = name;
            friend.picture = picture;
            friend.last_updated = Date.now();
            await db.put(FRIENDS_STORE, friend);
        } else {
            await db.put(FRIENDS_STORE, {
                pubkey,
                name,
                picture,
                last_updated: Date.now(),
            });
        }
    }

    /**
     * Clears all data in the DB (objects, friends, and keys).
     */
    async clearAllData() {
        const db = await DB.initDB();
        await db.clear(OBJECTS_STORE);
        await db.clear(FRIENDS_STORE);
        await db.clear(KEY_STORAGE);
        console.log('All data cleared from IndexedDB.');
    }

    /**
     * Save Nostr key data into the keys store.
     */
    async saveKeys(keys) {
        const db = await DB.initDB();
        // store the entire keys object under the fixed key "nostr_keys"
        await db.put(KEY_STORAGE, keys, KEY_STORAGE);
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

    const newKeys = { priv, pub };
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
