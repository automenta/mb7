export class SettingsManager {
    constructor(db, errorHandler) {
        this.db = db;
        this.errorHandler = errorHandler;
    }

    async getSettings() {
        try {
            const settingsObject = await this.db.getSettings() || {};
            const settingsTags = settingsObject.tags || [];
            const findTag = (tagName) => settingsTags.find(tag => tag[0] === tagName)?.[1];
            return {
                signalingStrategy: findTag('signalingStrategy') || "nostr",
                nostrRelays: findTag('relays') || "",
                nostrPrivateKey: findTag('privateKey') || ""
            };
        } catch (error) {
            this.errorHandler.handleError(error, 'Error getting settings from db');
            return {signalingStrategy: "nostr", nostrRelays: "", nostrPrivateKey: ""};
        }
    }
}
