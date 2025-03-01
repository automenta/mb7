import {DB} from '../core/db.js';
import {Nostr} from '../core/net.js';
import {ErrorHandler} from '../core/error-handler.js';
import {FriendsView} from "./view.friends.js";
import {SettingsView} from "./view.settings.js";
import {NotesView} from './view.notes.js';
import {ContentView} from "./ui-manager.js";
import {createMenuBar} from './menu-bar.js';
import {NotificationManager} from './notification-manager.js';

class App {
    constructor() {
        this.db = null;
        this.nostr = null;
        this.selected = null;
        this.notificationManager = new NotificationManager();
        this.elements = {};
    }

    async initialize() {
        await DB.the();
        this.errorHandler = new ErrorHandler(this);
        this.db = new DB(this, this.errorHandler);
        await this.db.initializeKeys();
        const settings = await this.db.getSettings() || {};
        const signalingStrategy = settings.signalingStrategy || "nostr";
        const nostrRelays = settings.nostrRelays || "";
        const nostrPrivateKey = settings.nostrPrivateKey || "";

        this.nostr = new Nostr(this, signalingStrategy, nostrRelays, nostrPrivateKey);
        this.nostr.connect();
    }

    async saveOrUpdateObject(object) {
        await this.db.save(object);
        console.log('saveOrUpdateObject', object);
    }

    async createNewObject(editView, newNote) {
        const id = crypto.randomUUID();
        console.log('createNewObject', editView, newNote);
        const newObject = {id: id, name: newNote.name, content: newNote.content};
        await this.db.saveObject(newObject);
        return newObject;
    }

    showEditor(newObject) {
        console.log('showEditor', newObject);
    }

    /**
     * Implements UI improvements to minimize cognitive load.
     */
    minimizeCognitiveLoad() {
        console.log("Implementing UI improvements to minimize cognitive load (not implemented)");
    }

    // TODO: Integrate YDoc with the UI to enable real-time collaborative editing

    /**
     * Shows a view in the main content area.
     * @param {View} view - The view to show.
     */
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
        if (!object.tags || !Array.isArray(object.tags)) {
            return;
        }

        object.tags.forEach(tag => {
            if (!tag.name) {
                throw new Error('Tag name is required.');
            }
            if (tag.name.length > 50) {
                throw new Error('Tag name is too long (max 50 characters).');
            }
        });
    }

}

document.addEventListener("DOMContentLoaded", async () => {
    const appDiv = document.getElementById('app');

    const app = new App();
    await app.initialize();
    await app.db.initializeKeys();
    const notesView = new NotesView(app);
    const friendsView = new FriendsView(app);
    const settingsView = new SettingsView(app);
    const contentView = new ContentView();

    const menubar = createMenuBar(app, notesView, friendsView, settingsView, contentView);
    const mainContent = document.createElement('main');
    mainContent.class = 'main-content';

    appDiv.appendChild(menubar);
    appDiv.appendChild(mainContent);

    // Create notification area
    const notificationArea = document.createElement('div');
    notificationArea.id = 'notification-area';
    appDiv.appendChild(notificationArea);
    app.elements = {notificationArea};

    app.showView(contentView); // Show content view by default
    contentView.render();
});
export {App};
