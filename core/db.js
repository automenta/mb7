import { openDB } from 'idb';
import * as Y from 'yjs';
import { getYDoc } from './db.ydoc.js';

const DB_NAME = 'netention-db';
const DB_VERSION = 1;
const OBJECTS_STORE = 'objects';
const FRIENDS_OBJECT_ID = 'friends';
const SETTINGS_OBJECT_ID = 'settings';

async function upgradeDatabase(db, oldVersion, newVersion, transaction) {
    if (oldVersion < 1) {
        db.createObjectStore(OBJECTS_STORE, { keyPath: 'id' });
    }
}

async function createDefaultObject(db, id) {
    let defaultObject = null;
    if (id === FRIENDS_OBJECT_ID) {
        defaultObject = { id: FRIENDS_OBJECT_ID, type: 'friends', friends: [] };
    } else if (id === SETTINGS_OBJECT_ID) {
        defaultObject = { id: SETTINGS_OBJECT_ID, type: 'settings', settings: {} };
    } else {
        return null;
    }

    await db.put(OBJECTS_STORE, defaultObject);
    return defaultObject;
}


export class DB {
    static db = null;

    constructor(errorHandler) {
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
                let cursor = await DB.db.transaction(OBJECTS_STORE).objectStore(OBJECTS_STORE).openCursor();
                while (cursor) {
                    all.push(cursor.value);
                    cursor = await cursor.continue();
                }
            }
            return all;
        } catch (error) {
            this.errorHandler.handleError(error, "Error retrieving all objects", error);
            console.error("Error retrieving all objects", error);
            throw error;
        }
    }


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

    async save(o, isPersistentQuery) {
        if (!o.id) {
            console.error('Attempted to save an object without an `id`:', o);
            throw new Error('Missing id property on object');
        }

        try {
            await this.validateObjectData(o);

            o.content = this.sanitizeContent(o.content);

            await DB.db.put(OBJECTS_STORE, o);
            return o;
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to save object with ID: ${o.id}`, error);
            console.error(`Failed to save object with ID: ${o.id}`, error);
            throw error;
        }
    }

    sanitizeContent(content) {
        if (typeof content !== 'string') return content;
        return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    async validateObjectData(object) {
        if (!object.id) {
            throw new Error('Object must have an ID.');
        }
        if (typeof object.name !== 'string' || object.name.trim() === '') {
            throw new Error('Object name must be a non-empty string.');
        }
    }


    async delete(id) {
        try {
            await DB.db.delete(OBJECTS_STORE, id);
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to delete object with ID: ${id}`, error);
            console.error(`Failed to delete object with ID: ${id}`, error);
            throw error;
        }
    }

    async getYDoc(id) {
        return await getYDoc(this, id);
    }

    async saveYDoc(id, yDoc) {
        try {
            const yDocData = Y.encodeStateAsUpdate(yDoc);
            await DB.db.put(OBJECTS_STORE, { id: `${id}-ydoc`, yDocData });
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to save YDoc for ID: ${id}`, error);
            console.error(`Failed to save YDoc for ID: ${id}`, error);
            throw error;
        }
    }


    async saveObject(object) {
        return await this.save(object);
    }
}
