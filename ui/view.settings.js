import {View} from './view';
import {createElement} from './utils.js';
import {GenericForm} from "./generic-form.js";
import * as Y from 'yjs';
import {Ontology} from "../core/ontology";

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
        this.el.innerHTML = '';

        // Load the settings object
        let settingsObject = await this.db.getSettings();

        // Create a JSON editor
        const jsonEditor = createElement('textarea', {
            className: 'json-editor',
            rows: 10,
            cols: 50,
            value: JSON.stringify(settingsObject, null, 2) // Pretty print the JSON
        });
        this.el.appendChild(jsonEditor);

        // Add a save button
        const saveButton = createElement('button', {className: 'save-button'}, 'Save Settings');
        saveButton.addEventListener('click', async () => {
            try {
                // Parse the JSON from the editor
                const newSettings = JSON.parse(jsonEditor.value);

                // Save the settings to the database
                await this.app.db.saveSettings(newSettings);

                // Update Nostr settings
                await this.nostr.updateSettings(newSettings);

                // Show a success notification
                this.app.showNotification('Settings saved successfully', 'success');
            } catch (error) {
                // Show an error notification
                this.app.showNotification(`Error saving settings: ${error.message}`, 'error');
                console.error('Error saving settings:', error);
            }
        });
        this.el.appendChild(saveButton);

        return this.el;
    }
}
