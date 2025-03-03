import {View} from "./view.js";
import {GenericForm} from "./generic-form.js";
import {Ontology} from "../core/ontology.js";

export class SettingsView extends View {
    constructor(app, db, nostr) {
        super(app, `<div id="settings-view" class="view"><h2>Settings</h2></div>`);
        this.app = app;
        this.db = db;
        this.nostr = nostr;
    }

    async build() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }
        const settingsObjectId = 'settings';
        let settingsObject = await this.db.get(settingsObjectId);
        let yDoc = await this.db.getYDoc(settingsObjectId);

        if (!yDoc) {
            settingsObject = {
                id: settingsObjectId,
                name: "Settings",
            };
            await this.db.saveObject(settingsObject);
            yDoc = new Y.Doc()
        }

        this.settingsForm = new GenericForm(Ontology.Settings, yDoc, 'settings');
        const formElement = await this.settingsForm.build();
        this.el.append(formElement);
    }

    async bindEvents() {
        // Word2Vec Model Path Input
        const word2vecLabel = createElement("label", {for: "word2vecModelPath"}, "Word2Vec Model Path");
        const word2vecInput = createElement("input", {
            type: "text",
            id: "word2vecModelPath",
            name: "word2vecModelPath",
            value: this.app.settings?.word2vecModelPath || './core/word2vec.model'
        });
        this.el.appendChild(word2vecLabel);
        this.el.appendChild(word2vecInput);

        await this.settingsForm.bindEvents();

        const saveButton = createElement("button", {id: "save-settings-btn"}, "Save Settings");
        this.el.appendChild(saveButton);
        saveButton.addEventListener("click", () => this.saveSettings());
    }

    async saveSettings() {
        const yMap = this.settingsForm.yMap;
        const settingsObject = await this.db.get('settings') || {};

        const settings = {
            relays: yMap.get('relays') || settingsObject.relays || '',
            webrtcNostrRelays: yMap.get('webrtcNostrRelays') || settingsObject.webrtcNostrRelays || '',
            privateKey: yMap.get('privateKey') || settingsObject.privateKey || '',
            dateFormat: yMap.get('dateFormat') || settingsObject.dateFormat || '',
            profileName: yMap.get('profileName') || settingsObject.profileName || '',
            profilePicture: yMap.get('profilePicture') || settingsObject.profilePicture || '',
            signalingStrategy: yMap.get('signalingStrategy') || settingsObject.signalingStrategy || 'nostr',
            word2vecModelPath: document.getElementById("word2vecModelPath").value
        };

        await this.db.saveSettings(settings);
        this.app.settings = settings;
        this.app.showNotification('Settings saved');
    }
}
