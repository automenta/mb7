let webcrypto;

if (typeof window !== 'undefined' && window.crypto) {
    // Browser environment
    webcrypto = window.crypto;
} else {
    // Node.js environment
    const crypto = await import('node:crypto');
    webcrypto = crypto.webcrypto;
}

/**
 * Generates an AES-GCM encryption key.
 * @returns {Promise<CryptoKey>} The generated encryption key.
 */
async function generateEncryptionKey() {
    try {
        const key = await webcrypto.subtle.generateKey(
            {
                name: "AES-GCM",
                length: 256,
            },
            true,
            ["encrypt", "decrypt"]
        );
        return key;
    } catch (error) {
        console.error("Error generating encryption key:", error);
        throw error;
    }
}

/**
 * Encrypts data using AES-GCM.
 * @param {string} data The data to encrypt.
 * @param {CryptoKey} key The encryption key.
 * @returns {Promise<Uint8Array>} The encrypted data.
 */
async function encrypt(data, key) {
    try {
        // Generate a random initialization vector
        const iv = webcrypto.getRandomValues(new Uint8Array(12));
        // Encode the data as a Uint8Array
        const encodedData = new TextEncoder().encode(data);
        // Encrypt the data
        const cipherText = await webcrypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encodedData
        );
        // Create a new Uint8Array with the IV and cipherText
        const encryptedData = new Uint8Array(iv.length + cipherText.byteLength);
        encryptedData.set(iv, 0);
        encryptedData.set(new Uint8Array(cipherText), iv.length);
        return encryptedData;
    } catch (error) {
        console.error("Error encrypting data:", error);
        throw error;
    }
}

/**
 * Decrypts data using AES-GCM.
 * @param {Uint8Array} data The data to decrypt.
 * @param {CryptoKey} key The decryption key.
 * @returns {Promise<string>} The decrypted data.
 */
async function decrypt(data, key) {
    try {
        // Extract the IV from the beginning of the data
        const iv = data.slice(0, 12);
        // Extract the cipher text from the rest of the data
        const cipherText = data.slice(12);
        // Decrypt the data
        const decryptedData = await webcrypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            cipherText
        );
        // Decode the decrypted data
        const decodedData = new TextDecoder().decode(decryptedData);
        return decodedData;
    } catch (error) {
        console.error("Error decrypting data:", error);
        throw error;
    }
}

export {generateEncryptionKey, encrypt, decrypt};