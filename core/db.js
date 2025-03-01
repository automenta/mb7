// db.js
const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: ["br", "b", "i", "span", "p", "strong", "em", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
};
import * as NostrTools from 'nostr-tools';
import { openDB } from 'idb';
import * as Y from 'yjs'
import DOMPurify from 'dompurify';
import { generateEncryptionKey, encrypt, decrypt } from './encryption';
import { addFriend, removeFriend, updateFriendProfile } from './friends';
import { saveSettings } from './settings';

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
                    db.createObjectStore(OBJECTS_STORE, { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains(KEY_STORAGE)) {
                    db.createObjectStore(KEY_STORAGE);
                }
                const objectStore = transaction.objectStore(OBJECTS_STORE);
                if (!objectStore.indexNames.contains('content')) {
                    objectStore.createIndex('content', 'content', { unique: false });
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
            const encryptedObject = await DB.db.get(OBJECTS_STORE, id);
            if (!encryptedObject) return null;
            // TODO: Retrieve the user's encryption key instead of generating a new one.
            // TODO: Implement secure encryption key management.
            const encryptionKey = window.keys.encryptionKey;
            const decryptedContent = await this.decrypt(encryptedObject.content, encryptionKey);
            return { ...encryptedObject, content: decryptedContent };
        } catch (error) {
            this.handleDBError("Failed to get object", error);
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
            // TODO: Retrieve the user's encryption key instead of generating a new one.
            // TODO: Store the encryption key ID with the object.
            // TODO: Implement secure encryption key management.
            let encryptionKey = window.keys.encryptionKey;
            if (!encryptionKey) {
                encryptionKey = await generateEncryptionKey();
                window.keys.encryptionKey = encryptionKey;
            }
            const encryptedContent = await this.encrypt(o.content, encryptionKey);
            const encryptedObject = { ...o, content: encryptedContent, encryptionKey: window.keys.pub };
            await DB.db.put(OBJECTS_STORE, encryptedObject);
            return o;
        } catch (error) {
            this.handleDBError("Failed to save object", error);
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
            this.handleDBError("Failed to delete object", error);
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
            this.handleDBError("Failed to get recent objects", error);
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
            await addFriend(DB.db, FRIENDS_OBJECT_ID, friend);
        } catch (error) {
            console.error("Failed to add friend:", error);
            throw error;
        }
    }

    async removeFriend(pubkey) {
        try {
            await removeFriend(DB.db, FRIENDS_OBJECT_ID, pubkey);
        } catch (error) {
            console.error("Failed to remove friend:", error);
            throw error;
        }
    }

    async updateFriendProfile(pubkey, name, picture) {
        try {
            await updateFriendProfile(DB.db, FRIENDS_OBJECT_ID, pubkey, name, picture);
        } catch (error) {
            console.error("Failed to update friend profile:", error);
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
        try {
            await saveSettings(DB.db, SETTINGS_OBJECT_ID, settings);
        } catch (error) {
            console.error("Failed to save settings:", error);
            throw error;
        }
    }

    async saveYDoc(id, yDoc) {
        const yDocData = Y.encodeStateAsUpdate(yDoc);
        await DB.db.put(OBJECTS_STORE, { id: `${id}-ydoc`, yDocData: yDocData });
    }

    async getYDoc(id) {
        await DB.the();
        const yDocObject = await DB.db.get(OBJECTS_STORE, `${id}-ydoc`);
        if (yDocObject) {
            const yDoc = new Y.Doc();
            Y.applyUpdate(yDoc, yDocObject.yDocData);
            return yDoc;
        } else {
            return null;
        }
    }
    async deleteCurrentObject(note) {
        try {
            await DB.db.delete(OBJECTS_STORE, note.id);
        } catch (error) {
            console.error("Failed to delete object:", error);
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
        return await DB.db.put(KEY_STORAGE, keys, KEY_STORAGE);
    }

    /**
     * Implements privacy controls to ensure NObjects are private by default.
     * @param {object} object - The NObject to apply privacy controls to.
     */
    async enforcePrivacy(object) {
        object.private = true;
        // TODO: Implement logic to ensure NObjects are private by default
        // TODO: Implement encryption, access control, and data masking
        // TODO: Consider creating a new file to handle encryption and decryption
        // TODO: Consider modifying ui/app.js to allow users to control privacy settings
        // TODO: Enforce access control based on the `private` flag.
        // TODO: Implement privacy controls, such as access control and data masking.
        object.content = "This object is private.";
        console.log(`Enforcing privacy for object: ${object.id} (not implemented)`);
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

    const newKeys = { priv, pub };
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
    window.keys = keys;
    return keys;
}

async function getNotesIndex() {
    const index = await DB.getDefaultObject(NOTES_INDEX_ID);
    return index.tags || [];
}

async function updateNotesIndex(newIndex) {
    await DB.db.put(OBJECTS_STORE, { id: NOTES_INDEX_ID, tags: newIndex });
}

export { getNotesIndex, updateNotesIndex };
