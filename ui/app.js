import * as Y from 'yjs'
import {Monitoring} from '../core/monitoring.js';
import {Matcher} from '../core/match.js';
import {DB} from '../core/db.js';
import {Nostr} from '../core/net.js';
import {ErrorHandler} from '../core/error.js';
import {createMenuBar} from './menu-bar.js';
import { NotificationManager } from './notification-manager.js';
import { createAppMainContent, createLayout } from './layout.js';
import { initializeViews } from './views.js';

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

    async createNote(name = 'New Note') {
        const newNote = {
            id: uuidv4(),
            name: name,
            content: '',
            tags: [],
            isPersistentQuery: false,
            private: false
        };
        await this.saveObject(newNote);
        return newNote;
    }
}


async function createApp(appDiv) {
    const appData = await App.initialize(appDiv);
    console.log('Creating App instance with db:', appData.db, 'and nostr:', appData.nostr);
    const app = new App(appData.db, appData.nostr, appData.matcher, appData.errorHandler, appData.notificationManager, appData.monitoring);
    app.settings = await app.db.getSettings();
    console.log('App.initialize() promise resolved');
    return {app};
}

/**
 * Sets up the UI after the DOM is loaded.
 * Initializes the app, creates views, and adds them to the DOM.
 */
async function setupUI() {
    document.title = "Netention"; // Set the document title
    const appDiv = document.getElementById('app');
    const {app} = await createApp(appDiv);
    const {noteView, friendsView, settingsView, contentView} = initializeViews(app);
    const {menubar, mainContent} = createLayout(app, appDiv, noteView, friendsView, settingsView, contentView);

    setupDefaultView(app, noteView, contentView);

    // Select the first note if no notes exist
    let notes;
    try {
        notes = await app.db.getAll();
        if (notes.length === 0) {
            await app.createDefaultNote(app.db);
        }
    } catch (error) {
        app.errorHandler.handleError(error, 'Error loading notes or creating default note');
    }

    // Display the name of the note in the editor title
    document.title = app.selected ? `Netention - ${app.selected.name}` : "Netention";
}

function initializeViews(app) {
    const noteView = new NoteView(app, app.db, app.nostr);
    const friendsView = new FriendsView(app, app.db, app.nostr);
    const settingsView = new SettingsView(app, app.db, app.nostr);
    const contentView = new ContentView(app);

    return {noteView, friendsView, settingsView, contentView};
}

document.addEventListener("DOMContentLoaded", async () => {
    await setupUI();
});


export { App };
