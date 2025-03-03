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
    constructor(db, nostr) {
        this.db = db;
        this.nostr = nostr;
        this.selected = null;
        this.elements = {};

        this.elements.notificationArea = document.createElement('div');
        this.elements.notificationArea.id = 'notification-area';
    }

    static async initialize(appDiv) {
        const errorHandler = new ErrorHandler(appDiv);
        const app = new App();
        const db = new DB(app, errorHandler);
        let signalingStrategy = "nostr"; // Provide a default value in case of error
        let nostrRelays = "";
        let nostrPrivateKey = "";

        try {
            const settingsObject = await db.getSettings();

            if (settingsObject && settingsObject.tags) {
                for (const tag of settingsObject.tags) {
                    if (tag[0] === 'signalingStrategy') {
                        signalingStrategy = tag[1] || "nostr";
                    } else if (tag[0] === 'relays') {
                        nostrRelays = tag[1] || "";
                    } else if (tag[0] === 'privateKey') {
                        nostrPrivateKey = tag[1] || "";
                    }
                }
            }
        } catch (error) {
            console.error('Error getting settings from db:', error);
        }
        console.log('db.getSettings() returned:', await db.getSettings());

        const nostr = new Nostr(app, signalingStrategy, nostrRelays, nostrPrivateKey, app.yDoc);
        nostr.connect();
        const matcher = new Matcher(app);
        app.yDoc = new Y.Doc();

        // Initialize NotificationManager and Monitoring here, after db is ready
        const notificationManager = new NotificationManager(app);
        const monitoring = new Monitoring(app);
        console.log('App.initialize resolved with:', {
            db,
            nostr,
            matcher,
            errorHandler,
            notificationManager,
            monitoring
        });
        monitoring.start();
        app.db = db;
        return {db, nostr, matcher, errorHandler, notificationManager, monitoring};
    }

    async saveOrUpdateObject(object) {
        console.log('saveOrUpdateObject called with object:', object);

        if (!object || !object.id) {
            console.error('Object must have an id');
            return null;
        }

        const newObject = {id: object.id, name: object.name, content: object.content, tags: object.tags || []};
        newObject.tags.push(['visibility', object.private ? 'private' : 'public']);
        try {
            await this.db.save(newObject, object.isPersistentQuery);
            const matches = await this.matcher.findMatches(newObject);
            await this.publishNewObject(newObject);
            this.publishMatches(matches);
            return newObject;
        } catch (error) {
            this.errorHandler.handleError(error, 'Error saving or publishing object');
            return null;
        }
    }

    // Integrate YDoc with the UI to enable real-time collaborative editing

    async publishNewObject(newObject) {
        console.log('publishNewObject called with newObject:', newObject);
        const visibilityTag = newObject.tags.find(tag => tag[0] === 'visibility');
        if (!visibilityTag || visibilityTag[1] !== 'private') {
            try {
                await this.nostr.publish(newObject);
                this.notificationManager.showNotification('Published to Nostr!', 'success');
            } catch (error) {
                this.errorHandler.handleError(error, 'Error publishing to Nostr');
            }
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
        if (!object.tags || !Array.isArray(object.tags))
            return;

        const invalidTag = object.tags.find(tag => !tag.name);
        if (invalidTag) {
            throw new Error(`Tag name is required. Invalid tag: ${JSON.stringify(invalidTag)}`);
        }
    }

    async publishNoteToNostr(note) {
        console.log('publishNoteToNostr called with note:', note);
        if (!this.nostr) {
            console.error('Nostr is not initialized.');
            return;
        }
        try {
            await this.nostr.publish(note);
            this.showNotification('Published to Nostr!', 'success');
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
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
            this.errorHandler.handleError(error, 'Error publishing match to Nostr');
        }
    }
}

async function createApp(appDiv) {
    const appData = await App.initialize(appDiv);
    console.log('Creating App instance with db:', appData.db, 'and nostr:', appData.nostr);
    const app = new App(appData.db, appData.nostr);
    app.matcher = appData.matcher;
    app.errorHandler = appData.errorHandler;
    console.log('App.initialize() promise resolved');
    app.notificationManager = appData.notificationManager;
    app.monitoring = appData.monitoring;
    return app;
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
    let app = await createApp(appDiv);

    const {noteView, friendsView, settingsView, contentView} = initializeViews(app);

    const {menubar, mainContent} = createLayout(app, appDiv, noteView, friendsView, settingsView, contentView);

    setupDefaultView(app, noteView, contentView);
}

function initializeViews(app) {
    const noteView = new NoteView(app, app.db, app.nostr);
    const friendsView = new FriendsView(app, app.db, app.nostr);
    const settingsView = new SettingsView(app, app.db, app.nostr);
    const contentView = new ContentView();
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
