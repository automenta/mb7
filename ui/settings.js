import { createElement } from './utils.js';

export class Settings {
    constructor(app) {
        this.app = app;
        this.el = createElement('div', { className: 'settings-view' });
    }

    async render() {
        this.el.innerHTML = '';

        // Load the settings object
        const settings = await this.app.db.getSettings();

        // Create a JSON editor
        const jsonEditor = createElement('textarea', {
            className: 'json-editor',
            rows: 10,
            cols: 50,
            value: JSON.stringify(settings, null, 2) // Pretty print the JSON
        });
        this.el.appendChild(jsonEditor);

        // Add a save button
        const saveButton = createElement('button', { className: 'save-button' }, 'Save Settings');
        saveButton.addEventListener('click', async () => {
            try {
                // Parse the JSON from the editor
                const newSettings = JSON.parse(jsonEditor.value);

                // Save the settings to the database
                await this.app.db.saveSettings(newSettings);

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
