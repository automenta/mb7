import {encrypt} from './crypto';

/**
 * Implements privacy controls to ensure NObjects are private by default.
 * @param {object} object - The NObject to apply privacy controls to.
 * Enforces privacy by encrypting the object's content.
 *
 * This function encrypts the object's content to ensure privacy.
 */
export async function enforcePrivacy(db, object) {
    try {
        const keys = await db.getKeys();
        if (!keys || !keys.encryptionKey) {
            return;
        }

        const encryptedData = await encrypt(object.content, keys.encryptionKey);
        object.content = `ENCRYPTED:${encryptedData}`;
        object.private = true;
        // object.encryptionKeyId = keys.encryptionKey.id; // Store key ID if needed - encryptionKey object doesn't have id field
        console.log(`Enforcing privacy for object: ${object.id}`);
    } catch (error) {
        db.errorHandler.handleError(error, "Failed to enforce privacy", error);
        console.error("Failed to enforce privacy:", error);
    }
}
