ui/settings-manager.js
import Ontology from '../core/ontology.js';

export class SettingsManager {
    constructor(app, db, errorHandler) {
        this.app = app;
        this.db = db;
        this.errorHandler = errorHandler;
        this.ontology = Ontology;
    }

    async getSettings() {
        try {
            const settingsObject = await this.db.getSettings() || {};
            const settingsData = settingsObject.data || {};
            const settingsOntology = this.ontology?.Settings?.tags || {};
            const defaultSettings = {};
            for (const key in settingsOntology) {
                defaultSettings[key] = settingsData[key] !== undefined ? settingsData[key] : settingsOntology[key].default;
            }
            return { ...defaultSettings, ...settingsData };
        } catch (error) {
            this.errorHandler.handleError(error, "Failed to load settings", error);
            return {};
        }
    }


    async saveSettings(settings) {
        try {
            const settingsOntology = this.ontology?.Settings?.tags || {};
            for (const key in settings) {
                const settingDefinition = settingsOntology[key];
                if (settingDefinition && settingDefinition.validate) {
                    const isValid = settingDefinition.validate(settings[key], 'is');
                    if (!isValid) {
                        this.errorHandler.handleError(new Error(`Invalid value for setting: ${key}`), 'Settings validation error');
                        return false;
                    }
                }
            }

            let settingsObject = await this.db.getSettings();
            if (!settingsObject) {
                settingsObject = { id: 'settings', type: 'settings',  {} };
            }
            settingsObject.data = { ...settingsObject.data, ...settings };
            await this.db.saveSettings(settingsObject);
            this.app.notificationManager.showNotification('Settings saved successfully', 'success');
            return true;
        } catch (error) {
            this.errorHandler.handleError(error, "Failed to save settings", error);
            return false;
        }
    }
}

customElements.define('settings-view', SettingsView);
