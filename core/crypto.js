import { webcrypto } from 'node:crypto';

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

async function encrypt(data, key) {
    try {
        const iv = webcrypto.getRandomValues(new Uint8Array(12));
        const encodedData = new TextEncoder().encode(data);
        const cipherText = await webcrypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            encodedData
        );
        const encryptedData = new Uint8Array(iv.length + cipherText.byteLength);
        encryptedData.set(iv, 0);
        encryptedData.set(new Uint8Array(cipherText), iv.length);
        return encryptedData;
    } catch (error) {
        console.error("Error encrypting data:", error);
        throw error;
    }
}

async function decrypt(data, key) {
    try {
        const iv = data.slice(0, 12);
        const cipherText = data.slice(12);
        const decryptedData = await webcrypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: iv
            },
            key,
            cipherText
        );
        const decodedData = new TextDecoder().decode(decryptedData);
        return decodedData;
    } catch (error) {
        console.error("Error decrypting data:", error);
        throw error;
    }
}

export { generateEncryptionKey, encrypt, decrypt };