import * as NostrTools from 'https://cdn.jsdelivr.net/npm/nostr-tools@latest/+esm'
import { View } from "./view.js";

export class FriendsView extends View {
    constructor(app) {
        super(app, `<div id="friends-view" class="view"><h2>Friends</h2></div>`);
    }

    build() {
        this.$el.append(
            `<input type="text" id="friend-pubkey" placeholder="Enter friend's nPub or pubkey">
             <button id="add-friend-btn">Add Friend</button>
             <h3>Your Friends</h3>
             <ul id="friends-list"></ul>`
        );
    }

    bindEvents() {
        this.$el.find("#add-friend-btn").on("click", () => this.addFriend());
        this.loadFriends(); // Load friends on initialization
    }

    async addFriend() {
        let pubkey = this.$el.find("#friend-pubkey").val().trim();
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
            await this.app.db.addFriend(pubkey);
            this.app.showNotification(`Added friend: ${NostrTools.nip19.npubEncode(pubkey)}`, "success");
            // Subscribe to the friend's profile (Kind 0)
            this.app.nostrClient.subscribe([{ kinds: [0], authors: [pubkey] }], { id: `friend-profile-${pubkey}` });

            this.loadFriends();
            this.app.nostrClient.connectToPeer(pubkey); // Connect immediately

        } catch(error) {
            this.app.showNotification("Failed to add friend.", "error")
        }
    }


    async loadFriends() {
        const friends = await this.app.db.getFriends();
        // Display friend's name and picture if available
        this.$el.find("#friends-list").html(friends.map(friend => {
            const npub = NostrTools.nip19.npubEncode(friend.pubkey);
            const displayName = friend.name ? `${friend.name} (${npub})` : npub;
            const profilePicture = friend.picture ? `<img src="${friend.picture}" alt="Profile Picture" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">` : '';
            return `<li>${profilePicture}${displayName} <button class="remove-friend" data-pubkey="${friend.pubkey}">Remove</button></li>`;
        }).join(''));
        this.$el.find(".remove-friend").on("click", (e) => this.removeFriend($(e.target).data("pubkey")));
    }


    async removeFriend(pubkey) {
        try {
            await this.app.db.removeFriend(pubkey);
            this.app.nostrClient.unsubscribe(`friend-profile-${pubkey}`);
            this.loadFriends(); // Refresh list after removing.
        } catch(error) {
            this.app.showNotification("Failed to remove friend.", "error");
        }
    }
}