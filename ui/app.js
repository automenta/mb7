import {ErrorHandler} from "../core/error.js";
import {DB} from "../core/db.js";
import {NotificationManager} from "./notification-manager.js";
import {Monitoring} from "../core/monitoring.js";
import {Matcher} from "../core/match.js";
import {Ontology} from "../core/ontology.js";
import {SettingsManager} from "./settings-manager.js";
import {NoteManager} from "./note-manager.js";
import {ViewManager} from "./view-manager.js";
import {UIManager} from "./ui-manager.js";
import {Nostr} from "../core/net.js";

export class NostrInitializer {
    constructor(db, errorHandler) {
        this.db = db;
        this.errorHandler = errorHandler;
        this.settingsManager = new SettingsManager(db, errorHandler);
    }

    async initNostr() {
        const {signalingStrategy, nostrRelays, nostrPrivateKey} = await this.settingsManager.getSettings();
        const nostr = new Nostr(this, signalingStrategy, nostrRelays, nostrPrivateKey);
        await nostr.init();
        return nostr;
    }
}

/**
 * The main application class.
 * Manages the database, Nostr connection, and UI.
 */
class App {
    constructor(db, nostr, matcher, errorHandler, notificationManager, monitoring, settingsManager, noteManager, viewManager, uiManager, ontology) {
        this.db = db;
        this.nostr = nostr;
        this.matcher = matcher;
        this.errorHandler = errorHandler;
        this.notificationManager = notificationManager;
        this.monitoring = monitoring;
        this.selected = null;
        this.elements = {};

        this.settingsManager = settingsManager;
        this.noteManager = noteManager;
        this.viewManager = viewManager;
        this.uiManager = uiManager;
        this.ontology = ontology; // Store the ontology
    }

    async relayConnected(relay) {
        await this.nostr.relayConnected(relay);
    }
}

async function createApp(appDiv) {
    const errorHandler = new ErrorHandler(appDiv);
    const db = new DB(errorHandler);
    const notificationManager = new NotificationManager();
    const monitoring = new Monitoring();
    await monitoring.start();
    const nostrInitializer = new NostrInitializer(db, errorHandler);
    const nostr = await nostrInitializer.initNostr();
    const matcher = new Matcher();

    const settingsManager = new SettingsManager(db, errorHandler, Ontology);
    const noteManager = new NoteManager(db, errorHandler, matcher, nostr, notificationManager);
    const viewManager = new ViewManager();
    const uiManager = new UIManager();

    const app = new App(db, nostr, matcher, errorHandler, notificationManager, monitoring, settingsManager, noteManager, viewManager, uiManager, Ontology);
    app.settings = await app.settingsManager.getSettings();
    app.uiManager.app = app; //HACK
    return app;
}


document.addEventListener("DOMContentLoaded", async () => {
    const appDiv = document.getElementById('app');
    const app = await createApp(appDiv);
    window.app = app; // Make app globally accessible
    await app.uiManager.setupUI(appDiv);
});

export {App};
