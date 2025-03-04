ui/view.settings.js
import { View } from '../view.js';
import { createElement } from '../utils.js';
import * as Y from 'yjs';
import { GenericForm } from '../generic-form.js';

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

        const settings = await this.app.db.getSettings();

        const jsonEditor = createElement('textarea', {
            className: 'json-editor',
            rows: 10,
            value: JSON.stringify(settings, null, 2)
        });
        this.el.appendChild(jsonEditor);

        const saveButton = createElement('button', {}, 'Save Settings');
        saveButton.addEventListener('click', async () => {
            try {
                const settingsData = JSON.parse(jsonEditor.value);
                await this.app.settingsManager.saveSettings(settingsData);
                this.showNotification('Settings saved!', 'success');
            } catch (error) {
                console.error("Error saving settings:", error);
                this.showNotification(`Failed to save settings: ${error.message}`, 'error');
            }
        });
        this.el.appendChild(saveButton);
        return this.el;
    }


    render() {
        this.build();
        return this.el;
    }
}

customElements.define('settings-view', SettingsView);
