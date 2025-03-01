import { createElement } from "./utils.js";
import * as NostrTools from 'nostr-tools'
import {View} from "./view.js";
import {getTagDefinition} from "../core/ontology.js";
import * as DB from "../core/db.js";

export class FriendsView extends View {
    constructor(app) {
        super(app, `<div id="friends-view" class="view"><h2>Friends</h2></div>`);
        this.app = app;
    }

    build() {
        this.el.innerHTML = "";
        const input = createElement("input", { type: "text", id: "friend-pubkey", placeholder: "Enter friend's nPub or pubkey" });
        const button = createElement("button", { id: "add-friend-btn" }, "Add Friend");
        const h3 = createElement("h3", {}, "Your Friends");
        const ul = createElement("ul", { id: "friends-list" });

        this.el.append(input, button, h3, ul);
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
        if (!this.isValidPublicKey(pubkey)) {
            this.app.showNotification("Invalid public key format", "error");
            return;
        }

        try {
            const friend = {pubkey: pubkey};
            await this.app.db.addFriend(friend);
            this.app.showNotification(`Added friend: ${NostrTools.nip19.npubEncode(pubkey)}`, "success");
            await this.app.nostrClient.subscribe([{kinds: [0], authors: [pubkey]}], {id: `friend-profile-${pubkey}`});
            await this.loadFriends();
            await this.app.nostrClient.connectToPeer(pubkey); // Connect immediately

        } catch (error) {
            this.app.showNotification("Failed to add friend.", "error")
        }
    }

    async loadFriends() {
        console.log("FriendsView.loadFriends called");
        let friendsObjectId;
        let friendsObject;
        try {
            friendsObjectId = await this.app.db.getFriendsObjectId();
            console.log("friendsObjectId:", friendsObjectId);
            friendsObject = await this.app.db.get(friendsObjectId);
            console.log("friendsObject:", friendsObject);
        } catch (error) {
            console.error("Error loading friends:", error);
            console.log("Error:", error);
            this.app.errorHandler.handleError(error, "Failed to load friends");
            return;
        }

        const friendsList = this.el.querySelector("#friends-list");
        while (friendsList.firstChild) {
            friendsList.removeChild(friendsList.firstChild);
        }

        if (!friendsObject || !friendsObject.tags) {
            friendsList.innerHTML = "<p>No friends found.</p>";
            return;
        }

        const peopleTagDefinition = getTagDefinition("People");

        friendsObject.tags.forEach(tag => {
            if (tag[0] === "People") {
                const pubkey = tag[1];
                const name = tag[2] || "";
                const picture = tag[3] || "";

                const npub = NostrTools.nip19.npubEncode(pubkey);
                const displayName = name ? `${name} (${npub})` : npub;
                const profilePictureHTML = picture ? `<img src="${picture}" alt="Profile Picture" style="width: 24px; height: 24px; border-radius: 50%; margin-right: 8px;">` : '';
                const li = createElement('li');
                li.innerHTML = `${profilePictureHTML}${displayName} <button class="remove-friend" data-pubkey="${pubkey}">Remove</button>`;
                friendsList.append(li);
            }
        });
        this.el.querySelectorAll(".remove-friend").forEach(button => button.addEventListener("click", (e) => this.removeFriend(button.dataset.pubkey)));
    }

    async removeFriend(pubkey) {
        try {
            await this.app.db.removeFriend(pubkey);
            await this.app.nostrClient.unsubscribe(`friend-profile-${pubkey}`);
            await this.loadFriends(); // Refresh list after removing.
        } catch (error) {
            this.app.showNotification("Failed to remove friend.", "error");
        }
    }

    isValidPublicKey(pubkey) {
        return /^[0-9a-fA-F]{64}$/.test(pubkey);
    }
}