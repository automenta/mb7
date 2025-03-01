import {createElement} from "./utils.js";
import * as NostrTools from 'nostr-tools'
import {View} from "./view.js";

export class SettingsView extends View {
    constructor(app) {
        super(app, `<div id="settings-view" class="view"><h2>Settings</h2></div>`);
    }

    build() {
        this.el.innerHTML = "";
        const h3Keys = createElement("h3", {}, "Nostr Keys");
        const generateKeyBtn = createElement("button", {id: "generate-key-btn"}, "Generate Key Pair");
        const importKeyBtn = createElement("button", {id: "import-key-btn"}, "Import Key");
        const exportKeyBtn = createElement("button", {id: "export-key-btn"}, "Export Key");
        const keyDisplay = createElement("div", {id: "key-display"});

        const h3Signaling = createElement("h3", {}, "Signaling");
        const signalingStrategyLabel = createElement("label", {}, "Signaling Strategy:");
        const signalingStrategySelect = createElement("select", {id: "signaling-strategy-select"}, `<option value="nostr">Nostr</option><option value="webrtc">WebRTC Signaling Server (Not Implemented)</option>`);
        signalingStrategyLabel.append(signalingStrategySelect);

        const h3Nostr = createElement("h3", {}, "Nostr Settings");
        const nostrRelayListLabel = createElement("label", {}, "Relays (one per line):");
        const nostrRelayList = createElement("textarea", {
            id: "nostr-relay-list",
            placeholder: "Relays (one per line)"
        });
        nostrRelayListLabel.append(nostrRelayList);
        const nostrPrivateKeyLabel = createElement("label", {}, "Private Key:");
        const nostrPrivateKeyInput = createElement("input", {
            type: "text",
            id: "nostr-private-key",
            placeholder: "hex encoded private key"
        });
        nostrPrivateKeyLabel.append(nostrPrivateKeyInput);

        const h3Preferences = createElement("h3", {}, "Preferences");
        const dateFormatLabel = createElement("label", {}, `Date/Time Format: `);
        const dateFormatSelect = createElement("select", {id: "date-format-select"}, `<option value="Pp">Pp</option><option value="MM/dd/yyyy"></option>`);
        dateFormatLabel.append(dateFormatSelect);
        const h3UserProfile = createElement("h3", {}, "User Profile (Nostr)");
        const profileNameLabel = createElement("label", {htmlFor: "profile-name"}, "Name:");
        const profileNameInput = createElement("input", {type: "text", id: "profile-name"});
        const profilePictureLabel = createElement("label", {htmlFor: "profile-picture"}, "Picture:");
        const profilePictureInput = createElement("input", {type: "text", id: "profile-picture"});
        const profileDisplay = createElement("div", {id: "profile-display"});
        const saveSettingsBtn = createElement("button", {id: "save-settings-btn"}, "Save Settings");
        const clearAllDataBtn = createElement("button", {id: "clear-all-data-btn"}, "Clear All Data");

        this.el.append(
            h3Keys,
            generateKeyBtn,
            importKeyBtn,
            exportKeyBtn,
            keyDisplay,

            h3Signaling,
            signalingStrategyLabel,

            h3Nostr,
            nostrRelayListLabel,
            nostrPrivateKeyLabel,
            h3Preferences,
            dateFormatLabel,
            h3UserProfile,
            profileNameLabel,
            profileNameInput,
            profilePictureLabel,
            profilePictureInput,
            profileDisplay,
            saveSettingsBtn,
            clearAllDataBtn
        );
    }

    bindEvents() {
        this.el.querySelector("#generate-key-btn").addEventListener("click", this.generateKeyPair.bind(this));
        this.el.querySelector("#import-key-btn").addEventListener("click", this.importKey.bind(this));
        this.el.querySelector("#export-key-btn").addEventListener("click", this.exportKey.bind(this));
        this.el.querySelector("#save-settings-btn").addEventListener("click", this.saveSettings.bind(this));
        this.el.querySelector("#clear-all-data-btn").addEventListener("click", () => {
            if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                this.app.db.deleteCurrentObject().then(() => {
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
                    this.updateProfileDisplay({name: settings.profileName, picture: settings.profilePicture});
                } else if (tag[0] === "signalingStrategy") {
                    settings.signalingStrategy = tag[1];
                    this.el.querySelector("#signaling-strategy-select").value = tag[1];
                } else if (tag[0] === "nostrRelays") {
                    settings.nostrRelays = tag[1];
                    this.el.querySelector("#nostr-relay-list").value = tag[1];
                } else if (tag[0] === "nostrPrivateKey") {
                    settings.nostrPrivateKey = tag[1];
                    this.el.querySelector("#nostr-private-key").value = tag[1];
                }
            });
        }
    }

    async saveSettings() {
        const relays = this.el.querySelector("#relay-list").value;
        const dateFormat = this.el.querySelector("#date-format-select").value;
        const profileName = this.el.querySelector("#profile-name").value;
        const profilePicture = this.el.querySelector("#profile-picture").value;
        const signalingStrategy = this.el.querySelector("#signaling-strategy-select").value;
        const nostrRelays = this.el.querySelector("#nostr-relay-list").value;
        const nostrPrivateKey = this.el.querySelector("#nostr-private-key").value;

        const settings = {
            relays: relays,
            dateFormat: dateFormat,
            profileName: profileName,
            profilePicture: profilePicture,
            signalingStrategy: signalingStrategy,
            nostrRelays: nostrRelays,
            nostrPrivateKey: nostrPrivateKey
        };

        await this.app.db.saveSettings(settings);
        this.app.nostrClient?.setRelays(relays.split("\n").map(l => l.trim()).filter(Boolean));
        this.updateProfileDisplay({name: profileName, picture: profilePicture});
        localStorage.setItem("dateFormat", dateFormat);
        this.app.showNotification("Settings saved.", "success");
    }

    async generateKeyPair() {
        try {
            let keys = await this.app.db.generateKeys();
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
        const loadedKeys = await this.app.db.loadKeys();
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

    updateProfileDisplay(profile) {
        const profileDisplay = this.el.querySelector("#profile-display");
        profileDisplay.innerHTML = `
            <p><strong>Name:</strong> ${profile.name || ""}</p>
            ${profile.picture ? `<img src="${profile.picture}" style="max-width:100px;max-height:100px;">` : ""}
        `;
    }
}
