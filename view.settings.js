import * as NostrTools from 'https://cdn.jsdelivr.net/npm/nostr-tools@latest/+esm'
import { View } from "./view.js";

export class SettingsView extends View {
    constructor(app) { super(app, `<div id="settings-view" class="view"><h2>Settings</h2></div>`); }

    build() {
        this.$el.append(
            `<h3>Nostr Keys</h3>
            <button id="generate-key-btn">Generate Key Pair</button>
            <button id="import-key-btn">Import Key</button>
            <button id="export-key-btn">Export Key</button>
            <div id="key-display"></div>
            <h3>Relays</h3>
            <textarea id="relay-list" placeholder="Relays (one per line)"></textarea>
            <button id="save-relays-btn">Save Relays</button>
            <h3>Preferences</h3>
            <label>Date/Time Format: <select id="date-format-select"><option value="Pp">Pp</option><option value="MM/dd/yyyy">MM/dd/yyyy</option></select></label>
            <h3>User Profile (Nostr)</h3>
            <label for="profile-name">Name:</label><input type="text" id="profile-name">
            <label for="profile-picture">Picture:</label><input type="text" id="profile-picture">
            <button id="save-profile-btn">Save Profile</button>
            <div id="profile-display"></div>
            <button id="clear-all-data-btn">Clear All Data</button> `
        );
    }

    bindEvents() {
        this.$el.find("#generate-key-btn").on("click", this.generateKeyPair.bind(this));
        this.$el.find("#import-key-btn").on("click", this.importKey.bind(this));
        this.$el.find("#export-key-btn").on("click", this.exportKey.bind(this));
        this.$el.find("#save-relays-btn").on("click", this.saveRelays.bind(this));
        this.$el.find("#date-format-select").on("change", () => localStorage.setItem("dateFormat", this.$el.find("#date-format-select").val()));
        this.$el.find("#save-profile-btn").on("click", this.saveProfile.bind(this));
        this.$el.find("#clear-all-data-btn").on("click", () => {
            if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                this.app.db.clearAllData().then(() => {
                    this.app.showNotification("All data cleared.", "success");
                    // Reload the application or reset to a default state
                    window.location.reload(); // Simplest approach for complete reset
                });
            }
        });

    }

    async generateKeyPair() {
        try {
            let keys = await DB.generateKeys();
            await this.app.db.saveKeys(window.keys = keys);
            this.displayKeys();
            this.app.showNotification("Keys generated.", "success");
        } catch { this.app.showNotification("Key generation failed.", "error"); }
    }

    async importKey() {
        const privKey = prompt("Enter private key (hex):");
        if (!privKey) return;
        try {
            if (!/^[0-9a-fA-F]{64}$/.test(privKey)) throw new Error("Invalid key format.");
            window.keys = { priv: privKey, pub: await NostrTools.getPublicKey(privKey) };
            this.displayKeys();
            await this.app.db.saveKeys(window.keys);
            this.app.showNotification("Key imported.", "success");
        } catch (err) { this.app.showNotification(`Error importing key: ${err.message}`, "error"); }
    }

    async exportKey() {
        const loadedKeys = await DB.loadKeys();
        if (!loadedKeys) { this.app.showNotification("No keys to export.", "error"); return; }
        try {
            await navigator.clipboard.writeText(JSON.stringify(loadedKeys, null, 2));
            this.app.showNotification("Keys copied to clipboard.", "success");
        } catch { this.app.showNotification("Failed to copy keys.", "error"); }
    }

    displayKeys() {
        if(window.keys) {
            this.$el.find("#key-display").html(`<p><strong>Public Key:</strong> ${NostrTools.nip19.npubEncode(window.keys?.pub) || "No key"}</p>`);
        }
    }

    saveRelays() {
        const relays = this.$el.find("#relay-list").val().split("\n").map(l => l.trim()).filter(Boolean);
        relays.length && this.app.nostrClient?.setRelays(relays); // Use app.nostrClient
        this.app.showNotification("Relays saved and updated.", "success"); //consistent feedback
    }

    async saveProfile() {
        const profile = { name: this.$el.find("#profile-name").val(), picture: this.$el.find("#profile-picture").val() };
        const event = {
            kind: 0,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: JSON.stringify(profile),
            pubkey: window.keys.pub,
        };
        try {
            event.id = await NostrTools.getEventHash(event);
            event.sig = await NostrTools.signEvent(event, window.keys.priv);
            this.app.nostrClient.publishRawEvent(event);  //use app.nostrClient
            this.displayProfile(profile);
            this.app.showNotification("Profile saved and published.", "success"); //consistent feedback

        } catch(error) {
            console.error("Error saving profile:", error);
            this.app.showNotification("Error saving profile.", "error");
        }
    }

    displayProfile(profile) {
        let profileHtml = `<p><strong>Name:</strong> ${profile.name || ""}</p>`;
        if(profile.picture) {
            profileHtml +=  `<img src="${profile.picture}" style="max-width:100px;max-height:100px;">`;
        }
        this.$el.find("#profile-display").html(profileHtml);
    }
}
