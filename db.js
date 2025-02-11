// db.js
import { set, get, del, keys as idbKeys, clear } from 'https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm';
import { getPublicKey } from "https://esm.sh/nostr-tools@1.8.0";

const KEY_STORAGE = "nostr_keys";
const FRIENDS_STORAGE = "nostr_friends";

export async function loadKeys() {
    try {
        let keysData = await get(KEY_STORAGE);
        if (!keysData) {
            const priv = generatePrivateKey();
            const pub = getPublicKey(priv);
            keysData = { priv, pub };
            await set(KEY_STORAGE, keysData);
        }
        return keysData;
    } catch (error) {
        console.error("Error accessing IndexedDB for keys:", error);
        return null; // Don't re-throw; handle gracefully
    }
}

export const generatePrivateKey = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};


export class DB {
    async getAll() {
        try {
            const allKeys = await idbKeys();
            // Filter out special keys
            const objectKeys = allKeys.filter(key => key !== KEY_STORAGE && key !== FRIENDS_STORAGE);
            const allObjs = await Promise.all(objectKeys.map(key => get(key)));
            return allObjs.filter(Boolean).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)); //sort directly
        } catch (error) {
            console.error("Error getting all objects:", error);
            return []; // Return empty array on error
        }
    }

    async get(id) {
        try {
            return await get(id);
        } catch (error) {
            console.error(`Error getting object with id ${id}:`, error);
            return null; // Return null on error
        }
    }

    async save(o) {
        if (!o.id) {
            console.error("Attempted to save an object without an id:", o);
            throw new Error("Missing id property on object");
        }
        try {
            await set(o.id, o);
            return o;
        } catch (error) {
            console.error("Error saving object:", error);
            throw error; // Re-throw for higher-level handling
        }
    }

    async delete(id) {
        try {
            await del(id);
        } catch (error) {
            console.error("Error deleting object:", error);
            // Don't re-throw; deleting is often non-critical
        }
    }

    async getRecent(limit = 5) {
        try {
            const objs = await this.getAll();
            return objs.slice(0, limit); // Already sorted in getAll
        } catch (error) {
            console.error("Error within getRecent", error);
            return []; // Return empty array on error
        }
    }

    async getStats() {
        try {
            const objs = await this.getAll();
            const objCount = objs.length;
            let tagCount = objs.reduce((acc, obj) => acc + (obj.tags?.length || 0), 0);
            return { objectCount: objCount, tagCount: tagCount };
        } catch (error) {
            console.error("Error within getStats", error);
            return { objectCount: 0, tagCount: 0 }; // Return default stats on error
        }
    }

    async addFriend(pubkey) {
        try {
            const friends = await this.getFriends();
            if (!friends.some(friend => friend.pubkey === pubkey)) {
                friends.push({ pubkey });
                await set(FRIENDS_STORAGE, friends);
            }
        } catch(error) {
            console.error("Error adding friend:", error);
            throw error;
        }
    }

    async getFriends() {
        try {
            let friends = await get(FRIENDS_STORAGE);
            return friends ? friends : [];
        } catch (error) {
            console.error("Error getting friends", error);
            return []; // Return empty array on error.
        }
    }

    async removeFriend(pubkey) {
        try {
            let friends = await this.getFriends();
            friends = friends.filter(friend => friend.pubkey !== pubkey);
            await set(FRIENDS_STORAGE, friends);
        } catch (error) {
            console.error("Error removing friend:", error);
            throw error;
        }
    }

    async clearAllData() {
        try {
            await clear();
            console.log("All data cleared from IndexedDB.");
        } catch (error) {
            console.error("Error clearing all data:", error);
            throw error;
        }
    }

    async saveKeys(keys) {
        try {
            await set(KEY_STORAGE, keys);
        } catch (error) {
            console.error("Error saving keys:", error);
            throw error; // Re-throw for handling by the caller
        }
    }
}