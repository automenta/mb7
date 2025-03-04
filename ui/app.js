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
import { createApp } from './app-initializer';

/**
 * The main application class.
 * Manages the database, Nostr connection, and UI.
 */
class App {
    constructor(db, nostr, matcher, errorHandler, notificationManager, monitoring, settingsManager, noteManager, viewManager, uiManager, yDoc) {
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
        this.yDoc = yDoc; // Store the Yjs document
    }

    async relayConnected(relay) {
        await this.nostr.relayConnected(relay);
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const appDiv = document.getElementById('app');
    const {app} = await createApp(appDiv);
    await app.uiManager.setupUI(appDiv);
});

export { App };
