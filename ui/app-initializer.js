import { App } from './app';
import { Monitoring } from '../core/monitoring.js';
import { Matcher } from '../core/match.js';
import { DB } from '../core/db.js';
import { ErrorHandler } from '../core/error.js';
import { NotificationManager } from './notification-manager.js';
import { SettingsManager } from "./settings-manager";
import { NostrInitializer } from "./nostr-initializer";
import { NoteManager } from "./note-manager";
import { ViewManager } from "./view-manager";
import { UIManager } from "./ui-manager";

async function createApp(appDiv) {
    const errorHandler = new ErrorHandler(appDiv);
    const db = new DB(errorHandler);
    const notificationManager = new NotificationManager();
    const monitoring = new Monitoring();
    await monitoring.start();
    const nostrInitializer = new NostrInitializer(db, errorHandler);
    const nostr = await nostrInitializer.initNostr();
    const matcher = new Matcher();
    const settingsManager = new SettingsManager(db, errorHandler);
    const noteManager = new NoteManager(db, errorHandler, matcher, nostr, notificationManager);
    const viewManager = new ViewManager();
    const uiManager = new UIManager();

    const app = new App(db, nostr, matcher, errorHandler, notificationManager, monitoring, settingsManager, noteManager, viewManager, uiManager);
    app.settings = await app.db.getSettings();
    return app;
}

export { createApp };
