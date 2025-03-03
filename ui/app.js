import * as Y from 'yjs'
import {Monitoring} from '../core/monitoring.js';
import {Matcher} from '../core/match.js';
import {DB} from '../core/db.js';
import {Nostr} from '../core/net.js';
import {ErrorHandler} from '../core/error.js';
import {FriendsView} from "./view.friends.js";
import {SettingsView} from "./view.settings.js";
import {NoteView as NoteView} from './view.note.js';
import {ContentView} from "./ui-manager.js";
import {createMenuBar} from './menu-bar.js';
import {NotificationManager} from './notification-manager.js';

/**
 * The main application class.
 * Manages the database, Nostr connection, and UI.
 */
class App {
    constructor(db, nostr, matcher, errorHandler, notificationManager, monitoring) {
        this.db = db;
        this.nostr = nostr;
        this.matcher = matcher;
        this.errorHandler = errorHandler;
        this.notificationManager = notificationManager;
        this.monitoring = monitoring;
        this.selected = null;
        this.elements = {};

        this.elements.notificationArea = document.createElement('div');
        this.elements.notificationArea.id = 'notification-area';
    }

    static async initialize(appDiv) {
        const errorHandler = new ErrorHandler(appDiv);
        const db = new DB(errorHandler);
        let signalingStrategy = "nostr"; // Provide a default value in case of error
        let nostrRelays = "";
        let nostrPrivateKey = "";

        try {
            const settingsObject = await db.getSettings() || {};
            const settingsTags = settingsObject.tags || [];
            signalingStrategy = settingsTags.find(tag => tag[0] === 'signalingStrategy')?.[1] || "nostr";
            nostrRelays = settingsTags.find(tag => tag[0] === 'relays')?.[1] || "";
            nostrPrivateKey = settingsTags.find(tag => tag[0] === 'privateKey')?.[1] || "";
        } catch (error) {
            errorHandler.handleError(error, 'Error getting settings from db');
        }
        const nostr = new Nostr(this, signalingStrategy, nostrRelays, nostrPrivateKey);
        nostr.connect();
        const matcher = new Matcher(this);
        const yDoc = new Y.Doc();

        // Initialize NotificationManager and Monitoring here, after db is ready
        const notificationManager = new NotificationManager();
        const monitoring = new Monitoring();
        await monitoring.start();
        return {db, nostr, matcher, errorHandler, notificationManager, monitoring};
    }

    async saveObject(object) {
        if (!object || !object.id) {
            this.errorHandler.handleError(new Error('Object must have an id'), 'Validation error saving object');
            return null;
        }

        const newObject = {id: object.id, name: object.name, content: object.content, tags: object.tags || []};
        newObject.tags.push(['visibility', object.private ? 'private' : 'public']);
        try {
            await this.db.save(newObject, object.isPersistentQuery);
            const matches = await this.matcher.findMatches(newObject);
            await this.publishObject(newObject);
            await this.publishMatches(matches);
            return newObject;
        } catch (error) {
            this.errorHandler.handleError(error, 'Error saving or publishing object');
            return null;
        }
    }

    async publishObject(object) {
        console.log('publishObject called with object:', object);
        const visibilityTag = object.tags.find(tag => tag[0] === 'visibility');
        const isPrivate = visibilityTag && visibilityTag[1] === 'private';

        if (isPrivate) {
            console.log('Object is private, not publishing to Nostr.');
            return;
        }

        try {
            await this.nostr.publish(object);
            this.showNotification('Published to Nostr!', 'success');
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
        }
    }

    showView(view) {
        const mainContent = document.querySelector('main');
        mainContent.innerHTML = ''; // Clear existing content
        view.build?.(); // Conditionally call build
        mainContent.appendChild(view.el);
        view.bindEvents?.(); // Conditionally call bindEvents
    }

    async relayConnected(relay) {
        await this.nostr.relayConnected(relay);
    }

    prepareObjectForSaving(object) {
        if (!object.tags || !Array.isArray(object.tags)) return;
        const invalidTag = object.tags.find(tag => !tag.name);
        if (invalidTag) {
            throw new Error(`Tag name is required. Invalid tag: ${JSON.stringify(invalidTag)}`);
        }
    }

    showNotification(message, type) {
        this.notificationManager.showNotification(message, type);
    }

    async publishMatches(matches) {
        console.log('publishMatches called with matches:', matches);
        if (!matches || matches.length === 0) {
            console.log('No matches to publish.');
            return;
        }
        try {
            for (const match of matches) {
                await this.nostr.publish(match);
                this.showNotification('Published match to Nostr!', 'success');
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
        }
    }
}

async function createApp(appDiv) {
    const appData = await App.initialize(appDiv);
    console.log('Creating App instance with db:', appData.db, 'and nostr:', appData.nostr);
    const app = new App(appData.db, appData.nostr, appData.matcher, appData.errorHandler, appData.notificationManager, appData.monitoring);
    console.log('App.initialize() promise resolved');
    return {app, db: appData.db, nostr: appData.nostr};
}

function createAppMainContent() {
    const mainContent = document.createElement('main');
    mainContent.className = 'main-content';
    return mainContent;
}

document.addEventListener("DOMContentLoaded", async () => {
    await setupUI();
});

/**
 * Sets up the UI after the DOM is loaded.
 * Initializes the app, creates views, and adds them to the DOM.
 */
async function setupUI() {
    const appDiv = document.getElementById('app');
    const {app, db, nostr} = await createApp(appDiv);
    const {noteView, friendsView, settingsView, contentView} = initializeViews(app, db, nostr);
    const {menubar, mainContent} = createLayout(app, appDiv, noteView, friendsView, settingsView, contentView);

    setupDefaultView(app, noteView, contentView);
}

function initializeViews(app, db, nostr) {
    const noteView = new NoteView(app, db, nostr);
    const friendsView = new FriendsView(app, db, nostr);
    const settingsView = new SettingsView(app, db, nostr);
    const contentView = new ContentView(app);
    return {noteView, friendsView, settingsView, contentView};
}

function createLayout(app, appDiv, noteView, friendsView, settingsView, contentView) {
    const menubar = createMenuBar(app, noteView, friendsView, settingsView, contentView);
    const mainContent = createAppMainContent();

    appDiv.appendChild(menubar);
    appDiv.appendChild(mainContent);
    appDiv.appendChild(app.elements.notificationArea);
    return {menubar, mainContent};
}

function setupDefaultView(app, noteView, contentView) {
    const defaultView = noteView;
    app.showView(defaultView);

    noteView.notesListComponent.disableObserver = false;
    contentView.render(); // TODO only when shown
}

export {App};
