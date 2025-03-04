import { View } from "./view.js";
import { Ontology } from "../core/ontology.js";
import { createElement } from '../ui/utils.js';
import { GenericForm } from "./generic-form.js";

export class SettingsView extends View {
    constructor(app, db, nostr) {
        super(app, `<div id="settings-view" class="view"><h2>Settings</h2></div>`);
        this.app = app;
        this.db = db;
        this.nostr = nostr;
        this.settingsObjectId = 'settings';
    }

    async build() {
        this.el.innerHTML = "";

        let settingsObject = await this.db.get(this.settingsObjectId);
        const yDoc = new Y.Doc();

        if (!settingsObject) {
            settingsObject = {
                id: this.settingsObjectId,
                name: "Settings",
            };
            await this.db.saveObject(settingsObject);
        }

        // Load settings from DB or create empty object
        this.app.settings = settingsObject?.content || {};

        // Initialize YDoc with existing settings
        const yMap = yDoc.getMap('data');
        for (const key in Ontology.Settings.tags) {
            const settingDefinition = Ontology.Settings.tags[key];
            const value = this.app.settings[key] !== undefined ? this.app.settings[key] : settingDefinition.default;
            yMap.set(key, value);
        }

        // Create and render the GenericForm
        this.genericForm = new GenericForm(Ontology.Settings, yDoc, this.settingsObjectId, this.saveSettings.bind(this));
        await this.genericForm.build();
        this.el.appendChild(this.genericForm.el);

        const saveButton = createElement("button", { id: "save-settings-btn" }, "Save Settings");
        this.el.appendChild(saveButton);
        saveButton.addEventListener("click", () => this.saveSettings());

        this.yDoc = yDoc;

        // Listen for notify events from the GenericForm
        this.el.addEventListener('notify', (event) => {
            this.app.showNotification(event.detail.message, event.detail.type);
        });
    }

    async saveSettings() {
        const yMap = this.yDoc.getMap('data');
        const settings = {};

        for (const key in Ontology.Settings.tags) {
            const settingDefinition = Ontology.Settings.tags[key];
            const yValue = yMap.get(key);
            settings[key] = settingDefinition.deserialize(yValue !== undefined ? yValue : settingDefinition.default);
        }

        // Save settings to DB
        let settingsObject = await this.db.get(this.settingsObjectId);
        settingsObject = settingsObject || { id: this.settingsObjectId, name: "Settings" };
        settingsObject.content = settings;
        await this.db.saveObject(settingsObject);

        // Apply settings to app
        for (const key in Ontology.Settings.tags) {
            if (settings.hasOwnProperty(key)) {
                this.app.settings[key] = settings[key];
            }
        }
        this.app.settingsManager.saveSettings(settings);
        this.app.nostr.nostrRelays = settings.relays;
        this.app.nostr.nostrPrivateKey = settings.privateKey;
        await this.app.nostr.connectToRelays();
        this.app.showNotification('Settings saved');
    }
}
