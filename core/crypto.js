const webcrypto = globalThis.crypto;

async function generateEncryptionKey() {
    return await webcrypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
}

/**
 * Encrypts the given data using AES-GCM with the provided key.
 * @param {string} x - The data to encrypt.
 * @param {CryptoKey} key - The encryption key.
 * @returns {Promise<Uint8Array>} - The encrypted data (ciphertext) as a Uint8Array, prepended with the IV.
 */
async function encrypt(x, key) {
    // Generate a random initialization vector (IV)
    const iv = webcrypto.getRandomValues(new Uint8Array(12));

    // Encode the data as a Uint8Array
    const encodedData = new TextEncoder().encode(x);

    // Encrypt the data using AES-GCM
    const cipherText = await webcrypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv // Use the generated IV
        },
        key, // Use the provided encryption key
        encodedData // Use the encoded data
    );

    // Create a new Uint8Array to hold the IV and ciphertext
    const y = new Uint8Array(iv.byteLength + cipherText.byteLength);

    // Copy the IV and ciphertext into the result array
    y.set(iv, 0);
    y.set(new Uint8Array(cipherText), iv.byteLength);

    return y;
}

/**
 * Decrypts the given data using AES-GCM with the provided key.
 * @param {Uint8Array} x - The encrypted data (ciphertext) as a Uint8Array, prepended with the IV.
 * @param {CryptoKey} key - The decryption key.
 * @returns {Promise<string>} - The decrypted data as a string.
 */
async function decrypt(x, key) {
    // Extract IV from data start
    const iv = x.slice(0, 12);

    // Extract ciphertext from remaining data
    const cipherText = x.slice(12);

    // Decrypt w/ AES-GCM
    const decryptedData = await webcrypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv // Use the extracted IV
        },
        key, // Use the provided decryption key
        cipherText // Use the ciphertext
    );

    // Decode the decrypted data as a string
    return new TextDecoder().decode(decryptedData);
}

export {encrypt, decrypt, generateEncryptionKey};
