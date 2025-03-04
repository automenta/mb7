import { View } from './view.js';
import { createElement } from '../utils.js';
import * as ace from 'ace-builds';
import 'ace-builds/src-noconflict/mode-json';
import 'ace-builds/src-noconflict/theme- Cobolt';

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

        const editor = ace.edit(jsonEditor, {
            mode: 'ace/mode/json',
            theme: 'ace/theme/cobalt',
            value: JSON.stringify(settings, null, 2),
            minLines: 10,
            maxLines: 30,
        });
        editor.session.setUseWrapMode(true);
        editor.session.setWrapLimitRange(null, null);


        const saveButton = createElement('button', {}, 'Save Settings');
        saveButton.addEventListener('click', async () => {
            try {
                const updatedSettings = JSON.parse(editor.getValue());
                await this.db.saveSettings(updatedSettings);
                this.app.notificationManager.showNotification('Settings saved successfully!', 'success');
            } catch (error) {
                console.error('Error saving settings:', error);
                this.app.notificationManager.showNotification(`Failed to save settings: ${error.message}`, 'error');
            }
        });
        this.el.appendChild(saveButton);
    }

    render() {
        this.build();
        return this.el;
    }
}
