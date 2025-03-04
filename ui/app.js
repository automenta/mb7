import { v4 as uuidv4 } from 'uuid';
import {Monitoring} from '../core/monitoring.js';
import {Matcher} from '../core/match.js';
import {DB} from '../core/db.js';
import {ErrorHandler} from '../core/error.js';
import { NotificationManager } from './notification-manager.js';
import {SettingsManager} from "./settings-manager";
import {NostrInitializer} from "./nostr-initializer";
import {NoteManager} from "./note-manager";
import {ViewManager} from "./view-manager";
import {UIManager} from "./ui-manager";

/**
 * The main application class.
 * Manages the database, Nostr connection, and UI.
 */
class App {
    constructor(db, nostr, matcher, errorHandler, notificationManager, monitoring, settingsManager, noteManager, viewManager, uiManager) {
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
    }

    static async initialize(appDiv) {
        const errorHandler = new ErrorHandler(appDiv);
        const db = new DB(errorHandler);
        const notificationManager = new NotificationManager(this);
        const monitoring = new Monitoring();
        await monitoring.start();
        const nostrInitializer = new NostrInitializer(db, errorHandler);
        const nostr = await nostrInitializer.initNostr();
        const matcher = new Matcher(this);
        const settingsManager = new SettingsManager(db, errorHandler);
        const noteManager = new NoteManager(this, db, errorHandler, matcher, nostr, notificationManager);
        const viewManager = new ViewManager(this);
        const uiManager = new UIManager(this);

        return {db, nostr, matcher, errorHandler, notificationManager, monitoring, settingsManager, noteManager, viewManager, uiManager};
    }

    async relayConnected(relay) {
        await this.nostr.relayConnected(relay);
    }
}


async function createApp(appDiv) {
    const appData = await App.initialize(appDiv);
    console.log('Creating App instance with db:', appData.db, 'and nostr:', appData.nostr);
    const app = new App(
        appData.db,
        appData.nostr,
        appData.matcher,
        appData.errorHandler,
        appData.notificationManager,
        appData.monitoring,
        appData.settingsManager,
        appData.noteManager,
        appData.viewManager,
        appData.uiManager
    );
    app.settings = await app.db.getSettings();
    console.log('App.initialize() promise resolved');
    return {app};
}

document.addEventListener("DOMContentLoaded", async () => {
    const appDiv = document.getElementById('app');
    const {app} = await createApp(appDiv);
    await app.uiManager.setupUI(appDiv);
});

export { App };
