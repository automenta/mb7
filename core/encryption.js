export async function generateEncryptionKey() {
    const key = await crypto.subtle.generateKey(
        {
            name: "AES-GCM",
            length: 256,
        },
        true,
        ["encrypt", "decrypt"]
    );
    return key;
}

export async function encrypt(data, key) {
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherText = await crypto.subtle.encrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        encodedData
    );
    return {
        iv: Array.from(iv),
        cipherText: Array.from(new Uint8Array(cipherText))
    };
}

export async function decrypt(data, key) {
    const iv = new Uint8Array(data.iv);
    const cipherText = new Uint8Array(data.cipherText);
    const plainText = await crypto.subtle.decrypt(
        {
            name: "AES-GCM",
            iv: iv
        },
        key,
        cipherText
    );
    const decoder = new TextDecoder();
    return decoder.decode(plainText);
}