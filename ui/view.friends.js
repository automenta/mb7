import {createElement} from "./utils.js";
import * as NostrTools from 'nostr-tools'
import {View} from "./view.js";
import {generateEncryptionKey} from '../core/crypto.js';

const PUBKEY_REGEX = /^[0-9a-fA-F]{64}$/;

export class FriendsView extends View {
    constructor(app, db, nostr) {
        super(app, `<div id="friends-view" class="view"><h2>Friends</h2></div>`);
        this.app = app;
        this.db = db;
        this.nostr = nostr
    }

    build() {
        this.el.innerHTML = "";
        const input = createElement("input", {
            type: "text",
            id: "friend-pubkey",
            placeholder: "Enter friend's nPub or pubkey"
        });
        const button = createElement("button", {id: "add-friend-btn"}, "Add Friend");
        const h3 = createElement("h3", {}, "Your Friends");
        const ul = createElement("ul", {id: "friends-list"});

        this.el.append(input, button, h3, ul);
    }

    bindEvents() {
        this.el.querySelector("#add-friend-btn").addEventListener("click", () => this.addFriend());
        this.el.querySelector("#friends-list").addEventListener("click", (e) => {
            if (e.target.classList.contains("connect-webrtc")) {
                this.connectWebRTC(e.target.dataset.pubkey);
            }
        });
        this.loadFriends(); // Load friends on initialization
        this.el.querySelectorAll(".send-dm").forEach(button => button.addEventListener("click", (e) => this.sendDM(button.dataset.pubkey)));
    }

    async sendDM(pubkey) {
        const textInput = this.el.querySelector(`#dm-text-${pubkey}`);
        const text = textInput.value.trim();
        if (!text) return;

        try {
            await this.nostr.sendDM(pubkey, text);
            textInput.value = ''; // Clear the input after sending
            this.app.showNotification(`Sent DM to ${NostrTools.nip19.npubEncode(pubkey)}`, "success");
        } catch (error) {
            console.error("Error sending DM:", error);
            this.app.showNotification("Failed to send DM.", "error");
        }
    }

    async addFriend() {
        let pubkey = this.el.querySelector("#friend-pubkey").value.trim();
        if (!pubkey) return;

        // Check if input is an npub and decode to hex
        try {
            if (pubkey.startsWith("npub")) {
                pubkey = NostrTools.nip19.decode(pubkey).data;
            }
        } catch (error) {
            this.app.showNotification("Invalid nPub format", "error");
            return;
        }

        // Validate the public key format (hex)
        if (!this.isValidPublicKey(pubkey)) {
            this.app.showNotification("Invalid public key format", "error");
            return;
        }

        try {
            const friendObjectId = `friend-${pubkey}`;

            // Fetch name and picture here, before creating the friendObject
            // For now, set them to empty strings, but this is where you'd
            // want to integrate with a profile service or similar.
            const name = "";
            const picture = "";

            const friendObject = {
                id: friendObjectId,
                name: "Friend",
                tags: [
                    ['objectType', 'People'],
                    ['visibility', 'private'],
                    ['isPersistentQuery', 'false'],
                    ['pubkey', pubkey],
                    ['profileName', name],
                    ['profilePicture', picture]
                ]
            };
            await this.app.saveOrUpdateObject(friendObject);

            // Secure Key Exchange
            await this.exchangeKeys(pubkey);

            this.app.showNotification(`Added friend: ${NostrTools.nip19.npubEncode(pubkey)}`, "success");
            await this.loadFriends();
            await this.nostr.connectToPeer(pubkey); // Connect immediately

        } catch (error) {
            this.app.showNotification("Failed to add friend.", "error")
        }
    }

    async loadFriends() {
        console.log("FriendsView.loadFriends called");
        const friendsListObjectId = 'friendsList';
        let friendsListObject = await this.db.get(friendsListObjectId);

        if (!friendsListObject) {
            friendsListObject = {
                id: friendsListObjectId,
                name: "Friends List",
                friends: [],
                private: true,
                isPersistentQuery: false
            };
            await this.app.saveOrUpdateObject(friendsListObject);
        }

        const friendsList = this.el.querySelector("#friends-list");
        friendsList.innerHTML = ""; // Clear existing list

        if (friendsListObject && friendsListObject.friends) {
            for (const friendObjectId of friendsListObject.friends) {
                try {
                    // Load the Friend NObject from the database
                    const friendObject = await this.db.get(friendObjectId);

                    // Display the friend
                    if (friendObject) {
                        let pubkey, profileName, profilePicture;

                        for (const tag of friendObject.tags) {
                            if (tag[0] === 'pubkey') {
                                pubkey = tag[1];
                            } else if (tag[0] === 'profileName') {
                                profileName = tag[1];
                            } else if (tag[0] === 'profilePicture') {
                                profilePicture = tag[1];
                            }
                        }

                        const npub = NostrTools.nip19.npubEncode(pubkey);
                        const displayName = profileName || npub; // Use profileName if available, otherwise npub
                        const li = createElement('li');
                        li.innerHTML = `${displayName} <button class="remove-friend" data-pubkey="${pubkey}">Remove</button> <button class="connect-webrtc" data-pubkey="${pubkey}">Connect WebRTC</button>
                                            <input type="text" id="dm-text-${pubkey}" placeholder="Enter message">
                                            <button class="send-dm" data-pubkey="${pubkey}">Send DM</button>`;
                        friendsList.append(li);
                    }
                } catch (error) {
                    console.error("Error loading friend:", error);
                    this.app.showNotification("Failed to load friend.", "error");
                }
            }
        } else {
            friendsList.innerHTML = "<p>No friends found.</p>";
        }
        this.el.querySelectorAll(".remove-friend").forEach(button => button.addEventListener("click", (e) => this.removeFriend(button.dataset.pubkey)));
    }

    async removeFriend(pubkey) {
        try {
            //await this.db.removeFriend(pubkey);
            await this.nostr.unsubscribeToPubkey(`friend-profile-${pubkey}`);
            await this.loadFriends(); // Refresh list after removing.
        } catch (error) {
            this.app.showNotification("Failed to remove friend.", "error");
        }
    }

    isValidPublicKey(pubkey) {
        return PUBKEY_REGEX.test(pubkey);
    }

    async exchangeKeys(pubkey) {
        try {
            const encryptionKey = await generateEncryptionKey();
            // Send DM with the encryption key
            //const keyString = await webcrypto.subtle.exportKey("jwk", encryptionKey);
            await this.nostr.sendDM(pubkey, `Encryption key: ${JSON.stringify(encryptionKey)}`);

            console.log('Generated encryption key for friend:', encryptionKey);
        } catch (error) {
            console.error("Error during key exchange:", error);
            this.app.showNotification("Failed to exchange keys.", "error");
        }
    }

    async connectWebRTC(pubkey) {
        try {
            console.log('Connecting to WebRTC peer:', pubkey);
            await this.app.nostr.webRTCService.connectWebRTC(pubkey, true); // Assuming initiator
        } catch (error) {
            console.error('Error connecting to WebRTC peer:', error);
            this.app.showNotification(`Error connecting to WebRTC peer: ${error.message}`, 'error');
        }
    }
}
