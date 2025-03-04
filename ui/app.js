import * as Y from 'yjs';
import { v4 as uuidv4 } from 'uuid';
import {Monitoring} from '../core/monitoring.js';
import {Matcher} from '../core/match.js';
import {DB} from '../core/db.js';
import {Nostr} from '../core/net.js';
import {ErrorHandler} from '../core/error.js';
import {createMenuBar} from './menu-bar.js';
import { NotificationManager } from './notification-manager.js';
import { createAppMainContent, createLayout } from './layout.js';
import { initializeViews } from './views.js';

class SettingsManager {
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

class NoteManager {
    constructor(db, errorHandler, matcher, nostr, notificationManager) {
        this.db = db;
        this.errorHandler = errorHandler;
        this.matcher = matcher;
        this.nostr = nostr;
        this.notificationManager = notificationManager;
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

    async createDefaultNote() {
        const defaultNote = {
            id: 'default',
            name: 'Welcome to Netention!',
            content: 'This is your first note. Edit it to get started.',
            private: true,
            tags: [],
            priority: 'Medium',
            isPersistentQuery: false
        };
        await this.db.save(defaultNote);
        return defaultNote;
    }

    async saveObject(object) {
        if (!object || !object.id) {
            this.errorHandler.handleError(new Error('Object must have an id'), 'Validation error saving object');
            return null;
        }

        const newObject = {id: object.id, name: object.name, content: object.content, tags: object.tags || []};
        this.processTags(newObject, object.private);
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

    processTags(object, isPrivate) {
        // Ensure tags is an array
        if (!object.tags) {
            object.tags = [];
        }

        const publicTag = object.tags.find(tag => tag.name === 'Public');
        const isPublic = publicTag && publicTag.value === 'true';

        // Remove existing visibility tag
        object.tags = object.tags.filter(tag => tag.name !== 'visibility');

        if (!isPublic) {
            // Add visibility tag
            object.tags.push({ name: 'visibility', value: isPrivate ? 'private' : 'public' });
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
            this.notificationManager.showNotification('Published to Nostr!', 'success');
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
        }
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
                this.notificationManager.showNotification('Published match to Nostr!', 'success');
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
        }
    }
}

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

        this.settingsManager = new SettingsManager(db, errorHandler);
        this.noteManager = new NoteManager(db, errorHandler, matcher, nostr, notificationManager);

        this.elements.notificationArea = document.createElement('div');
        this.elements.notificationArea.id = 'notification-area';
    }

    static async initialize(appDiv) {
        const errorHandler = new ErrorHandler(appDiv);
        const db = new DB(errorHandler);
        const notificationManager = new NotificationManager();
        const monitoring = new Monitoring();
        await monitoring.start();
        const nostr = await App.initNostr(db, errorHandler);
        const matcher = new Matcher(this);

        return {db, nostr, matcher, errorHandler, notificationManager, monitoring};
    }

    static async initNostr(db, errorHandler) {
        const settingsManager = new SettingsManager(db, errorHandler);
        const {signalingStrategy, nostrRelays, nostrPrivateKey} = await settingsManager.getSettings();
        const nostr = new Nostr(this, signalingStrategy, nostrRelays, nostrPrivateKey);
        nostr.connect();
        return nostr;
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
    setupDefaultView(app, noteView, contentView);
    const {menubar, mainContent} = createLayout(app, appDiv, noteView, friendsView, settingsView, contentView);

    // Select the first note if no notes exist
    let notes;
    try {
        notes = await app.db.getAll();
        if (!notes || notes.length === 0) {
            await app.noteManager.createDefaultNote();
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

async function setupDefaultView(app, noteView, contentView) {
    // Default to showing the NoteView
    app.showView(noteView);

    // Load the first note if no note is selected
    if (!app.selected) {
        let notes;
        try {
            notes = await app.db.getAll();
            if (notes && notes.length > 0) {
                await noteView.selectNote(notes[0].id);
            } else {
                console.warn('No notes available to select.');
            }
        } catch (error) {
            app.errorHandler.handleError(error, 'Error loading notes');
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    await setupUI();
});


export { App };
