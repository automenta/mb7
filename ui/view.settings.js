import {View} from "./view.js";
import {Ontology} from "../core/ontology.js";
import {createElement} from '../ui/utils.js';
import {GenericForm} from "./generic-form.js";
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
        let settingsObject = await this.db.get(this.settingsObjectId);
        if (!settingsObject) {
            settingsObject = {id: this.settingsObjectId, name: "Settings", content: {}};
            await this.db.saveObject(settingsObject);
        }
        this.app.settings = settingsObject.content || {};
        const yMap = this.yDoc.getMap('data');
        for (const key in Ontology.Settings.tags) {
            if (!Ontology.Settings.tags.hasOwnProperty(key)) continue;
            const settingDefinition = Ontology.Settings.tags[key];
            let value = this.app.settings[key] !== undefined ? this.app.settings[key] : settingDefinition.default;
            if (this.app.settings[key] !== undefined && settingDefinition.deserialize) {
                try {
                    value = settingDefinition.deserialize(value);
                } catch (error) {
                    console.error(`Error deserializing setting ${key}:`, error);
                    this.app.showNotification(`Error deserializing setting ${key}: ${error.message}`, 'error');
                    continue;
                }
            }
            yMap.set(key, value);
        }
        this.genericForm = new GenericForm(Ontology.Settings, this.yDoc, this.settingsObjectId, this.saveSettings.bind(this));
        await this.genericForm.build();
        this.el.appendChild(this.genericForm.el);
        const saveButton = createElement("button", {id: "save-settings-btn"}, "Save Settings");
        this.el.appendChild(saveButton);
        saveButton.addEventListener("click", () => this.saveSettings());
        this.el.addEventListener('notify', (event) => {
            this.app.showNotification(event.detail.message, event.detail.type);
        });
    }

    async saveSettings() {
        const yMap = this.yDoc.getMap('data');
        const settings = {};
        for (const key in Ontology.Settings.tags) {
            if (!Ontology.Settings.tags.hasOwnProperty(key)) continue;
            const settingDefinition = Ontology.Settings.tags[key];
            const yValue = yMap.get(key);
            let value = yValue !== undefined ? yValue : settingDefinition.default;
            if (settingDefinition.serialize) {
                try {
                    value = settingDefinition.serialize(value);
                } catch (error) {
                    console.error(`Error serializing setting ${key}:`, error);
                    this.app.showNotification(`Error serializing setting ${key}: ${error.message}`, 'error');
                    continue;
                }
            }
            settings[key] = value;
        }
        let settingsObject = await this.db.get(this.settingsObjectId);
        settingsObject = settingsObject || {id: this.settingsObjectId, name: "Settings"};
        settingsObject.content = settings;
        await this.db.saveObject(settingsObject);
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
