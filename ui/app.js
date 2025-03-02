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
    constructor() {
        this.db = null;
        this.nostr = null;
        this.selected = null;
        this.notificationManager = new NotificationManager();
        this.elements = {};

        this.elements.notificationArea = document.createElement('div');
        this.elements.notificationArea.id = 'notification-area';

        this.initialize();
    }

    async initialize() {
        await DB.the();
        this.errorHandler = new ErrorHandler(this);
        this.db = new DB(this, this.errorHandler);
        await this.initializeNostr();
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
        console.log('saveOrUpdateObject', object);
    }

    async createNewObject(editView, newNote) {
        const id = crypto.randomUUID();
        console.log('createNewObject', editView, newNote);
        const newObject = {id: id, name: newNote.name, content: newNote.content};
        await this.db.save(newObject);
        return newObject;
    }

    // TODO: Integrate YDoc with the UI to enable real-time collaborative editing

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
    const app = new App();

    const noteView = new NoteView(app);
    const friendsView = new FriendsView(app);
    const settingsView = new SettingsView(app);

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
    contentView.render(); //TODO only when shown
}
export {App};
