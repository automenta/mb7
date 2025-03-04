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
import {createStore} from "../core/state.js";
import {initialState, reducer} from "../core/reducer.js";
import {NoteYjsHandler} from "./note/note-yjs-handler";

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
    constructor(db, nostr, matcher, errorHandler, notificationManager, monitoring, settingsManager, noteManager, viewManager, uiManager, ontology, store) {
        this.db = db;
        this.nostr = nostr;
        this.matcher = matcher;
        this.errorHandler = errorHandler;
        this.notificationManager = notificationManager;
        this.monitoring = monitoring;
        this.store = store; // Store the Redux-like store
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
    const noteYjsHandler = new NoteYjsHandler();

    // Create the Redux-like store
    const store = createStore(reducer, initialState);

    // Inject dependencies into UIManager
    const uiManager = new UIManager(store, viewManager, noteManager, db, errorHandler);

    const app = new App(db, nostr, matcher, errorHandler, notificationManager, monitoring, settingsManager, noteManager, viewManager, uiManager, Ontology, store);
    window.app = app;
    return app;
}


document.addEventListener("DOMContentLoaded", async () => {
    const appDiv = document.getElementById('app');
    const app = await createApp(appDiv);
    await app.uiManager.setupUI(appDiv);
});

export {App};
