import * as NostrTools from 'nostr-tools';
import {generateEncryptionKey} from './crypto';
import {DB} from './db';

const generatePrivateKey = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

/**
 * Generate a new private/public key pair and persist it in the DB.
 */
export async function generateKeys() {
    const priv = generatePrivateKey();
    const pub = NostrTools.getPublicKey(priv);
    const encryptionKey = await generateEncryptionKey();
    const newKeys = {priv, pub, encryptionKey};
    await DB.db.put('nostr_keys', newKeys, 'nostr_keys');
    return newKeys;
}

/**
 * Load existing keys from DB. If none found, generate a new pair and save it.
 */
export async function loadKeys() {
    let keys = await DB.db.get('nostr_keys', 'nostr_keys');
    if (!keys) {
        keys = await generateKeys();
        console.log('Keys generated and saved.');
    }

    window.keys = keys;
    return keys;
}```

ui/edit/suggest.dropdown.js
