import {Nostr} from "../core/net";
import {SettingsManager} from "./settings-manager";

export class NostrInitializer {
    constructor(db, errorHandler) {
        this.db = db;
        this.errorHandler = errorHandler;
        this.settingsManager = new SettingsManager(db, errorHandler);
    }

    async initNostr() {
        const {signalingStrategy, nostrRelays, nostrPrivateKey} = await this.settingsManager.getSettings();
        const nostr = new Nostr(this, signalingStrategy, nostrRelays, nostrPrivateKey);
        nostr.connect();
        return nostr;
    }
}
