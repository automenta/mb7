import * as NostrTools from 'nostr-tools'
import {View} from "./view.js";

export class SettingsView extends View {
    constructor(app) {
        super(app, `<div id="settings-view" class="view"><h2>Settings</h2></div>`);
    }

    build() {
        this.el.innerHTML = `
            <h3>Nostr Keys</h3>
            <button id="generate-key-btn">Generate Key Pair</button>
            <button id="import-key-btn">Import Key</button>
            <button id="export-key-btn">Export Key</button>
            <div id="key-display"></div>
            <h3>Relays</h3>
            <textarea id="relay-list" placeholder="Relays (one per line)"></textarea>
            <h3>Preferences</h3>
            <label>Date/Time Format: <select id="date-format-select"><option value="Pp">Pp</option><option value="MM/dd/yyyy">MM/dd/yyyy</option></select></label>
            <h3>User Profile (Nostr)</h3>
            <label for="profile-name">Name:</label><input type="text" id="profile-name">
            <label for="profile-picture">Picture:</label><input type="text" id="profile-picture">
            <div id="profile-display"></div>
            <button id="save-settings-btn">Save Settings</button>
            <button id="clear-all-data-btn">Clear All Data</button>
        `;
    }

    bindEvents() {
        this.el.querySelector("#generate-key-btn").addEventListener("click", this.generateKeyPair.bind(this));
        this.el.querySelector("#import-key-btn").addEventListener("click", this.importKey.bind(this));
        this.el.querySelector("#export-key-btn").addEventListener("click", this.exportKey.bind(this));
        this.el.querySelector("#save-settings-btn").addEventListener("click", this.saveSettings.bind(this));
        this.el.querySelector("#clear-all-data-btn").addEventListener("click", () => {
            if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                this.app.db.clearAllData().then(() => {
                    this.app.showNotification("All data cleared.", "success");
                    window.location.reload();
                });
            }
        });
        this.loadSettings();
    }

    async loadSettings() {
        const settingsObject = await this.app.db.getSettings();
        if (settingsObject && settingsObject.tags) {
            let settings = {};
            settingsObject.tags.forEach(tag => {
                if (tag[0] === "relays") {
                    settings.relays = tag[1];
                    this.el.querySelector("#relay-list").value = tag[1];
                } else if (tag[0] === "dateFormat") {
                    settings.dateFormat = tag[1];
                    this.el.querySelector("#date-format-select").value = tag[1];
                    localStorage.setItem("dateFormat", tag[1]);
                } else if (tag[0] === "profileName") {
                    settings.profileName = tag[1];
                    this.el.querySelector("#profile-name").value = tag[1];
                } else if (tag[0] === "profilePicture") {
                    settings.profilePicture = tag[1];
                    this.el.querySelector("#profile-picture").value = tag[1];
                    this.displayProfile({name: settings.profileName, picture: settings.profilePicture});
                }
            });
        }
    }

    async saveSettings() {
        const relays = this.el.querySelector("#relay-list").value;
        const dateFormat = this.el.querySelector("#date-format-select").value;
        const profileName = this.el.querySelector("#profile-name").value;
        const profilePicture = this.el.querySelector("#profile-picture").value;

        const settings = {
            relays: relays,
            dateFormat: dateFormat,
            profileName: profileName,
            profilePicture: profilePicture
        };

        await this.app.db.saveSettings(settings);
        this.app.nostrClient?.setRelays(relays.split("\n").map(l => l.trim()).filter(Boolean));
        this.displayProfile({name: profileName, picture: profilePicture});
        localStorage.setItem("dateFormat", dateFormat);
        this.app.showNotification("Settings saved.", "success");
    }

    async generateKeyPair() {
        try {
            let keys = await DB.generateKeys();
            await this.app.db.saveKeys(window.keys = keys);
            this.displayKeys();
            this.app.showNotification("Keys generated.", "success");
        } catch {
            this.app.showNotification("Key generation failed.", "error");
        }
    }

    async importKey() {
        const privKey = prompt("Enter private key (hex):");
        if (!privKey) return;
        try {
            if (!/^[0-9a-fA-F]{64}$/.test(privKey)) throw new Error("Invalid key format.");
            window.keys = {priv: privKey, pub: await NostrTools.getPublicKey(privKey)};
            this.displayKeys();
            await this.app.db.saveKeys(window.keys);
            this.app.showNotification("Key imported.", "success");
        } catch (err) {
            this.app.showNotification(`Error importing key: ${err.message}`, "error");
        }
    }

    async exportKey() {
        const loadedKeys = await DB.loadKeys();
        if (!loadedKeys) {
            this.app.showNotification("No keys to export.", "error");
            return;
        }
        try {
            await navigator.clipboard.writeText(JSON.stringify(loadedKeys, null, 2));
            this.app.showNotification("Keys copied to clipboard.", "success");
        } catch {
            this.app.showNotification("Failed to copy keys.", "error");
        }
    }

    displayKeys() {
        if (window.keys) {
            this.el.querySelector("#key-display").innerHTML = `<p><strong>Public Key:</strong> ${NostrTools.nip19.npubEncode(window.keys?.pub) || "No key"}</p>`;
        }
    }

    displayProfile(profile) {
        const profileDisplay = this.el.querySelector("#profile-display");
        profileDisplay.innerHTML = `
            <p><strong>Name:</strong> ${profile.name || ""}</p>
            ${profile.picture ? `<img src="${profile.picture}" style="max-width:100px;max-height:100px;">` : ""}
        `;
    }
}
