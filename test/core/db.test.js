import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DB } from '@/core/db.js';
import { openDB } from 'idb';

vi.mock('idb', () => ({
    openDB: vi.fn(),
}));

describe('DB', () => {
    let db;
    let errorHandler;
    const testId = 'test-id';
    const testObject = { id: testId, name: 'Test Object', content: 'Test Content' };
    const defaultObjectData = { id: testId, 'default-data': 'default' };
    const existingObjectData = { id: testId, 'test-data': 'existing' };

    beforeEach(() => {
        errorHandler = {
            handleError: vi.fn(),
        };
        db = new DB(errorHandler);
        openDB.mockClear();
    });

    describe('constructor', () => {
        it('should set the errorHandler', () => {
            expect(db.errorHandler).toBe(errorHandler);
        });
    });

    describe('the', () => {
        it('should open the database if it is not already open', async () => {
            DB.db = null;
            openDB.mockResolvedValue({});

            await DB.the();

            expect(openDB).toHaveBeenCalled();
            expect(DB.db).toEqual({});
        });

        it('should return the existing database if it is already open', async () => {
            const existingDB = {};
            DB.db = existingDB;

            const result = await DB.the();

            expect(openDB).not.toHaveBeenCalled();
            expect(result).toBe(existingDB);
        });
    });

    describe('getDefaultObject', () => {
        it('should return existing object if found in DB', async () => {
            DB.db = {
                get: vi.fn().mockResolvedValue(existingObjectData),
            };

            const result = await DB.getDefaultObject(testId);

            expect(DB.db.get).toHaveBeenCalledWith('objects', testId);
            expect(result).toBe(existingObjectData);
        });

        it('should create and return a default object if not found in DB', async () => {
            DB.db = {
                get: vi.fn().mockResolvedValue(undefined),
                put: vi.fn().mockResolvedValue(undefined),
            };
            const createDefaultObject = vi.fn().mockResolvedValue(defaultObjectData);
            DB.getDefaultObject = async (id) => {
                let object = await DB.db.get('objects', id);
                return object ? object : await createDefaultObject(DB.db, id);
            }

            const result = await DB.getDefaultObject(testId);

            expect(DB.db.get).toHaveBeenCalledWith('objects', testId);
            expect(createDefaultObject).toHaveBeenCalledWith(DB.db, testId);
            expect(result).toEqual(defaultObjectData);
        });
    });

    describe('get', () => {
        it('should retrieve an object from the database', async () => {
            DB.db = {
                get: vi.fn().mockResolvedValue(existingObjectData),
            };

            const result = await db.get(testId);

            expect(DB.db.get).toHaveBeenCalledWith('objects', testId);
            expect(result).toEqual(existingObjectData);
        });

        it('should handle errors when retrieving an object', async () => {
            const error = new Error('Failed to retrieve object');
            DB.db = {
                get: vi.fn().mockRejectedValue(error),
            };

            await expect(db.get(testId)).rejects.toThrow(error);
            expect(errorHandler.handleError).not.toHaveBeenCalled();
        });
    });

    describe('save', () => {
        it('should throw an error if object does not have an id', async () => {
            const object = { name: 'Test Object' };

            await expect(db.save(object)).rejects.toThrow('Missing id property on object');
        });

        it('should save an object to the database', async () => {
            db.validateObjectData = vi.fn().mockResolvedValue();
            db.sanitizeContent = vi.fn().mockReturnValue(testObject.content);
            DB.db = {
                put: vi.fn().mockResolvedValue(),
            };

            await db.save(testObject);

            expect(db.validateObjectData).toHaveBeenCalledWith(testObject);
            expect(db.sanitizeContent).toHaveBeenCalledWith(testObject.content);
            expect(DB.db.put).toHaveBeenCalledWith('objects', testObject);
        });
    });

    describe('sanitizeContent', () => {
        it('should sanitize content to prevent XSS', () => {
            const content = '<script>alert("XSS");</script><p>Some text</p>';
            const sanitizedContent = db.sanitizeContent(content);
            expect(sanitizedContent).toBe('&lt;script>alert("XSS");&lt;/script>&lt;p>Some text&lt;/p>');
        });

        it('should return non-string content as is', () => {
            const content = { key: 'value' };
            const sanitizedContent = db.sanitizeContent(content);
            expect(sanitizedContent).toBe(content);
        });
    });

    describe('validateObjectData', () => {
        it('should throw an error if object does not have an ID', async () => {
            const object = { name: 'Test Object' };
            await expect(db.validateObjectData(object)).rejects.toThrow('Object must have an ID.');
        });

        it('should throw an error if object name is empty', async () => {
            const object = { id: testId, name: '  ' };
            await expect(db.validateObjectData(object)).rejects.toThrow('Object name must be a non-empty string.');
        });

        it('should not throw an error if object data is valid', async () => {
            await expect(db.validateObjectData(testObject)).resolves.not.toThrow();
        });
    });

    describe('delete', () => {
        it('should delete an object from the database', async () => {
            DB.db = {
                delete: vi.fn().mockResolvedValue(),
            };

            await db.delete(testId);

            expect(DB.db.delete).toHaveBeenCalledWith('objects', testId);
            expect(errorHandler.handleError).not.toHaveBeenCalled();
        });

        it('should handle errors when deleting an object', async () => {
            const error = new Error('Failed to delete object');
            DB.db = {
                delete: vi.fn().mockRejectedValue(error),
            };

            await expect(db.delete(testId)).rejects.toThrow(error);
            expect(errorHandler.handleError).toHaveBeenCalled();
        });
    });
});
