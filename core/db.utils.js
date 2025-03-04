/**
 * Creates a default object with the given ID and kind.
 */
export async function createDefaultObject(db, id, kind = 30000) {
    const now = new Date().toISOString();
    let object = {
        id,
        kind,
        content: '',
        tags: [],
        createdAt: now,
        updatedAt: now,
        isPersistentQuery: false,
    };

    if (id === 'settings') {
        object = {
            ...object,
            tagUIOverrides: {} // Initialize tagUIOverrides
        };
    }

    await db.put('objects', object);
    return object;
}

/**
 * Handles database errors.
 * @param {string} message - The error message.
 * @param {Error} error - The error object.
 */
export function handleDBError(message, error) {
    console.error(message + ':', error);
    throw error;
}
