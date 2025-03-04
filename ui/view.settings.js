import { View } from "./view.js";
import { Ontology } from "../core/ontology.js";
import { createElement } from '../ui/utils.js';
import { GenericForm } from "./generic-form.js";
import * as Y from 'yjs';

export class SettingsView extends View {
    constructor(app, db, nostr) {
        super(app, `<div id="settings-view" class="view"><h2>Settings</h2></div>`);
        this.app = app;
        this.db = db;
        this.nostr = nostr;
        this.settingsObjectId = 'settings';
        this.yDoc = new Y.Doc();
    }

    async build() {
        this.el.innerHTML = "";

        // Fetch settings object from the database
        let settingsObject = await this.db.get(this.settingsObjectId);

        // If settings object doesn't exist, create a default one
        if (!settingsObject) {
            settingsObject = {
                id: this.settingsObjectId,
                name: "Settings",
                content: {}
            };
            await this.db.saveObject(settingsObject);
        }

        // Initialize app settings with the content from the settings object
        this.app.settings = settingsObject.content || {};

        // Create a Yjs map to store the settings data
        const yMap = this.yDoc.getMap('data');

        // Iterate over the settings definitions in the ontology
        for (const key in Ontology.Settings.tags) {
            if (!Ontology.Settings.tags.hasOwnProperty(key)) continue; // Skip inherited properties

            const settingDefinition = Ontology.Settings.tags[key];
            let value = this.app.settings[key] !== undefined ? this.app.settings[key] : settingDefinition.default;

            // Deserialize the value if a deserializer is defined
            if (this.app.settings[key] !== undefined && settingDefinition.deserialize) {
                try {
                    value = settingDefinition.deserialize(value);
                } catch (error) {
                    console.error(`Error deserializing setting ${key}:`, error);
                    this.app.showNotification(`Error deserializing setting ${key}: ${error.message}`, 'error');
                    continue; // Skip to the next setting if deserialization fails
                }
            }

            // Set the value in the Yjs map
            yMap.set(key, value);
        }

        // Create and build the generic form for editing the settings
        this.genericForm = new GenericForm(Ontology.Settings, this.yDoc, this.settingsObjectId, this.saveSettings.bind(this));
        await this.genericForm.build();
        this.el.appendChild(this.genericForm.el);

        // Create a save button and attach a click event listener
        const saveButton = createElement("button", { id: "save-settings-btn" }, "Save Settings");
        this.el.appendChild(saveButton);
        saveButton.addEventListener("click", () => this.saveSettings());

        // Listen for notify events to display notifications
        this.el.addEventListener('notify', (event) => {
            this.app.showNotification(event.detail.message, event.detail.type);
        });
    }

    async saveSettings() {
        const yMap = this.yDoc.getMap('data');
        const settings = {};

        // Iterate over the settings definitions in the ontology
        for (const key in Ontology.Settings.tags) {
            if (!Ontology.Settings.tags.hasOwnProperty(key)) continue; // Skip inherited properties

            const settingDefinition = Ontology.Settings.tags[key];
            const yValue = yMap.get(key);
            let value = yValue !== undefined ? yValue : settingDefinition.default;

            // Serialize the value if a serializer is defined
            if (settingDefinition.serialize) {
                try {
                    value = settingDefinition.serialize(value);
                } catch (error) {
                    console.error(`Error serializing setting ${key}:`, error);
                    this.app.showNotification(`Error serializing setting ${key}: ${error.message}`, 'error');
                    continue; // Skip to the next setting if serialization fails
                }
            }
            settings[key] = value;
        }

        // Fetch the settings object from the database
        let settingsObject = await this.db.get(this.settingsObjectId);
        settingsObject = settingsObject || { id: this.settingsObjectId, name: "Settings" };
        settingsObject.content = settings;
        await this.db.saveObject(settingsObject);

        // Update the app settings with the new values
        for (const key in Ontology.Settings.tags) {
            if (settings.hasOwnProperty(key)) {
                this.app.settings[key] = settings[key];
            }
        }

        // Save the settings to the app's settings manager and update Nostr settings
        this.app.settingsManager.saveSettings(settings);
        this.app.nostr.nostrRelays = settings.relays;
        this.app.nostr.nostrPrivateKey = settings.privateKey;
        await this.app.nostr.connectToRelays();

        // Show a notification that the settings have been saved
        this.app.showNotification('Settings saved');
    }
}
