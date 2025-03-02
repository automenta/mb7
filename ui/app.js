import { Monitoring } from '../core/monitoring.js';
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

class App {
    constructor(db, nostr) {
        this.db = db;
        this.nostr = nostr;
        this.selected = null;
        this.elements = {};

        this.elements.notificationArea = document.createElement('div');
        this.elements.notificationArea.id = 'notification-area';
        this.notificationManager = new NotificationManager(this);
        this.monitoring = new Monitoring(this);
        this.monitoring.start();
    }

    static async initialize(app) {
        const errorHandler = new ErrorHandler(app);
        const db = new DB(app, errorHandler);
        await db.the();
        const {
            signalingStrategy = "nostr",
            nostrRelays = "",
            nostrPrivateKey = ""
        } = await db.getSettings() || {};

        const nostr = new Nostr(app, signalingStrategy, nostrRelays, nostrPrivateKey);
        nostr.connect();
        const matcher = new Matcher(app);
        return {db, nostr, matcher, errorHandler};
    }

    async initializeNostr() {
        await this.db.initializeKeys();
        const {
            signalingStrategy = "nostr",
            nostrRelays = "",
            nostrPrivateKey = ""
        } = await this.db.getSettings() || {};

        this.nostr = new Nostr(this, signalingStrategy, nostrRelays, nostrPrivateKey);
        this.nostr.connect();
    }

    async saveOrUpdateObject(object) {
        await this.db.save(object);
    }

    async createNewObject(newNote) {
        const id = "test-id";
        const newObject = {id: id, name: newNote.name, content: newNote.content};
        await this.db.save(newObject);
        const that = this;
        await that.publishNewObject(newObject);
        return newObject;
    }

    // TODO: Integrate YDoc with the UI to enable real-time collaborative editing

    async publishNewObject(newObject) {
        try {
            await this.nostr.publish(newObject);
            this.notificationManager.showNotification('Published to Nostr!', 'success');
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
        if (!object.tags || !Array.isArray(object.tags))
            return;

        if (!object.tags.every(tag => tag.name))
            throw new Error('Tag name is required.');
    }

    async publishNoteToNostr(note) {
        if (!this.nostr) {
            console.error('Nostr is not initialized.');
            return;
        }
        try {
            await this.nostr.publish(note.content);
            this.notificationManager.showNotification('Published to Nostr!', 'success');
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
        }
    }
}

async function createApp() {
    const appDiv = document.getElementById('app');
    const appData = await App.initialize(appDiv);
    const app = new App(appData.db, appData.nostr);
    app.matcher = appData.matcher;
    app.errorHandler = appData.errorHandler;
    console.log('App.initialize() promise resolved');
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

async function setupUI() {
    let app = await createApp();

    const noteView = new NoteView(app, app.db, app.nostr);
    //noteView.notesListComponent.disableObserver = true;
    const friendsView = new FriendsView(app, app.db, app.nostr);
    const settingsView = new SettingsView(app, app.db, app.nostr);

    const contentView = new ContentView();

    const menubar = createMenuBar(app, noteView, friendsView, settingsView, contentView);
    const mainContent = createAppMainContent();

    const appDiv = document.getElementById('app');
    appDiv.appendChild(menubar);
    appDiv.appendChild(mainContent);
    appDiv.appendChild(app.elements.notificationArea);

    const defaultView =
        //noteView;
        contentView;

    app.showView(defaultView);

    noteView.notesListComponent.disableObserver = false;
    contentView.render(); //TODO only when shown
}

export {App};
