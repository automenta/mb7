import * as NostrTools from 'nostr-tools'
import {View} from "./view.js";
import {getTagDefinition} from "./ontology.js";

export class FriendsView extends View {
    constructor(app) {
        super(app, `<div id="friends-view" class="view"><h2>Friends</h2></div>`);
    }

    build() {
        this.el.innerHTML = `
            <input type="text" id="friend-pubkey" placeholder="Enter friend's nPub or pubkey">
            <button id="add-friend-btn">Add Friend</button>
            <h3>Your Friends</h3>
            <ul id="friends-list"></ul>
        `;
    }

    bindEvents() {
        this.el.querySelector("#add-friend-btn").addEventListener("click", () => this.addFriend());
        this.loadFriends(); // Load friends on initialization
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
        if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
            this.app.showNotification("Invalid public key format", "error");
            return;
        }

        try {
            const friend = { pubkey: pubkey };
            await this.app.db.addFriend(friend);
            this.app.showNotification(`Added friend: ${NostrTools.nip19.npubEncode(pubkey)}`, "success");
            this.app.nostrClient.subscribe([{kinds: [0], authors: [pubkey]}], {id: `friend-profile-${pubkey}`});
            await this.loadFriends();
            this.app.nostrClient.connectToPeer(pubkey); // Connect immediately

        } catch (error) {
            this.app.showNotification("Failed to add friend.", "error")
        }
    }

    async loadFriends() {
        const friendsObjectId = await this.app.db.getFriendsObjectId();
        const friendsObject = await this.app.db.get(friendsObjectId);

        if (!friendsObject || !friendsObject.tags) {
            this.el.querySelector("#friends-list").innerHTML = "<p>No friends found.</p>";
            return;
        }

        const peopleTagDefinition = getTagDefinition("People");

        this.el.querySelector("#friends-list").innerHTML = friendsObject.tags.map(tag => {
            if (tag[0] === "People") {
                const pubkey = tag[1];
                const name = tag[2] || "";
                const picture = tag[3] || "";

                const npub = NostrTools.nip19.npubEncode(pubkey);
                const displayName = name ? `${name} (${npub})` : npub;
                const profilePicture = picture ? `<img src="${picture}" alt="Profile Picture" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">` : '';
                return `<li>${profilePicture}${displayName} <button class="remove-friend" data-pubkey="${pubkey}">Remove</button></li>`;
            }
        }).join('');
        this.el.querySelectorAll(".remove-friend").forEach(button => button.addEventListener("click", (e) => this.removeFriend(button.dataset.pubkey)));
    }

    async removeFriend(pubkey) {
        try {
            await this.app.db.removeFriend(pubkey);
            this.app.nostrClient.unsubscribe(`friend-profile-${pubkey}`);
            await this.loadFriends(); // Refresh list after removing.
        } catch (error) {
            this.app.showNotification("Failed to remove friend.", "error");
        }
    }
}