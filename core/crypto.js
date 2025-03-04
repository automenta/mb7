const webcrypto = globalThis.crypto;

async function generateEncryptionKey() {
    const key = await webcrypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
    return key;
}

/**
 * Encrypts the given data using AES-GCM with the provided key.
 * @param {string} data - The data to encrypt.
 * @param {CryptoKey} key - The encryption key.
 * @returns {Promise<Uint8Array>} - The encrypted data (ciphertext) as a Uint8Array, prepended with the IV.
 */
async function encrypt(data, key) {
    // Generate a random initialization vector (IV)
    const iv = webcrypto.getRandomValues(new Uint8Array(12));

    // Encode the data as a Uint8Array
    const encodedData = new TextEncoder().encode(data);

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
    const result = new Uint8Array(iv.byteLength + cipherText.byteLength);

    // Copy the IV and ciphertext into the result array
    result.set(iv, 0);
    result.set(new Uint8Array(cipherText), iv.byteLength);

    // Return the combined IV and ciphertext
    return result;
}

/**
 * Decrypts the given data using AES-GCM with the provided key.
 * @param {Uint8Array} data - The encrypted data (ciphertext) as a Uint8Array, prepended with the IV.
 * @param {CryptoKey} key - The decryption key.
 * @returns {Promise<string>} - The decrypted data as a string.
 */
async function decrypt(data, key) {
    // Extract the IV from the beginning of the data
    const iv = data.slice(0, 12);

    // Extract the ciphertext from the rest of the data
    const cipherText = data.slice(12);

    // Decrypt the data using AES-GCM
    const decryptedData = await webcrypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv // Use the extracted IV
        },
        key, // Use the provided decryption key
        cipherText // Use the ciphertext
    );

    // Decode the decrypted data as a string
    const decodedData = new TextDecoder().decode(decryptedData);

    // Return the decoded data
    return decodedData;
}

export {encrypt, decrypt, generateEncryptionKey};
