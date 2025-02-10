import * as Net from "./net.js";

import { getPublicKey } from "https://esm.sh/nostr-tools@1.8.0";

const { set, get, del, keys: idbKeys } = idbKeyval;
const KEY_STORAGE = "nostr_keys";

export async function loadKeys() {
    try {
        let keysData = await get(KEY_STORAGE);
        if (!keysData) {
            const priv = Net.privateKey();
            const pub = getPublicKey(priv);
            keysData = { priv, pub };
            await set(KEY_STORAGE, keysData);
        }
        return keysData;
    } catch (error) {
        console.error("Error accessing IndexedDB for keys:", error);
        alert("Failed to access keys. IndexedDB might be unavailable.");
        return null;
    }
}

export class DB {
    async getAll() {
        try {
            const allKeys = await idbKeys();
            const allObjs = await Promise.all(allKeys.map(key => get(key)));
            return _.orderBy(allObjs.filter(Boolean), ["updatedAt"], ["desc"]);
        } catch (error) {
            console.error("Error getting all objects:", error);
            alert("Failed to retrieve data. IndexedDB might be unavailable.");
            return [];
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
            alert("Failed to save data. IndexedDB might be unavailable.");
            throw error;
        }
    }
    async delete(id) {
        try {
            await del(id);
        } catch (error) {
            console.error("Error deleting object:", error);
            alert("Failed to delete data. IndexedDB might be unavailable.");
        }
    }
}
