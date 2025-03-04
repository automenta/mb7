export class SettingsManager {
    constructor(db, errorHandler, ontology) {
        this.db = db;
        this.errorHandler = errorHandler;
        this.ontology = ontology; // Inject the ontology
    }

    async getSettings() {
        try {
            const settingsObject = await this.db.getSettings() || {};
            const settingsData = settingsObject.data || {}; // Use a 'data' field to store settings

            // Apply default values from ontology if settings are missing
            const settingsOntology = this.ontology?.Settings?.tags || {};
            const defaultSettings = {};
            for (const key in settingsOntology) {
                defaultSettings[key] = settingsData[key] !== undefined ? settingsData[key] : settingsOntology[key].default;
            }

            return defaultSettings;
        } catch (error) {
            this.errorHandler.handleError(error, 'Error getting settings from db');
            return {
                signalingStrategy: "nostr",
                nostrRelays: "",
                nostrPrivateKey: ""
            };
        }
    }

    async saveSettings(settings) {
        try {
            // Validate settings against ontology
            const settingsOntology = this.ontology?.Settings?.tags || {};
            for (const key in settings) {
                const settingDefinition = settingsOntology[key];
                if (settingDefinition && settingDefinition.validate) {
                    const isValid = settingDefinition.validate(settings[key], 'is');
                    if (!isValid) {
                        this.errorHandler.handleError(new Error(`Invalid value for setting: ${key}`), `Invalid value for setting: ${key}`);
                        throw new Error(`Invalid value for setting: ${key}`);
                    }
                }
            }

            let settingsObject = await this.db.getSettings();
            if (!settingsObject) {
                settingsObject = {
                    id: 'settings', // Assuming 'settings' is the ID for the settings object
                    kind: 'settings',
                    name: 'Settings',
                    tags: []
                };
            }

            settingsObject.data = settings; // Store settings in the 'data' field

            await this.db.saveObject(settingsObject);
        } catch (error) {
            this.errorHandler.handleError(error, 'Error saving settings to db');
            throw error;
        }
    }
}
