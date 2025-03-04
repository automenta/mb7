import {createLayout} from './layout.js';
import {View} from "./view"
import {NoteView} from "./view.note";
import {FriendsView} from "./view.friends";
import {SettingsView} from "./view.settings";

export class AppUI {
    constructor(store, viewManager, noteManager, db, errorHandler, nostr, noteYjsHandler, notificationManager) {
        this.store = store;
        this.viewManager = viewManager;
        this.noteManager = noteManager;
        this.db = db;
        this.errorHandler = errorHandler;
        this.nostr = nostr;
        this.noteYjsHandler = noteYjsHandler;
        this.notificationManager = notificationManager;
    }

    async setupUI(appDiv) {
        document.title = "Netention"; // Set the document title
        const {noteView, friendsView, settingsView, contentView} = this.initializeViews();
        this.setupDefaultView(noteView, contentView);

        // Select the first note if no notes exist
        let notes;
        try {
            notes = await this.db.getAll();
            if (!notes || notes.length === 0) {
                await this.noteManager.createDefaultNote();
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'Error loading notes or creating default note');
        }

        const {menubar, mainContent} = createLayout(appDiv, noteView, friendsView, settingsView, contentView, this.store);
        // Display the name of the note in the editor title
        document.title = this.store.getState().selectedNoteId ? `Netention - ${this.store.getState().selectedNoteId.name}` : "Netention";
    }

    initializeViews() {
        const noteView = new NoteView(this.store, this.db, this.errorHandler, this.noteManager, this.noteYjsHandler, this.notificationManager);
        const friendsView = new FriendsView(this.store, this.db, this.nostr.addFriend.bind(this.nostr), this.nostr.removeFriend.bind(this.nostr), this.nostr.subscribeToPubkey.bind(this.nostr), this.nostr.unsubscribeToPubkey.bind(this.nostr), this.notificationManager.showNotification.bind(this.notificationManager));
        const settingsView = new SettingsView(this.store, this.db, this.nostr.updateSettings.bind(this.nostr), this.notificationManager.showNotification.bind(this.notificationManager));
        const contentView = new ContentView(this.store);

        return {noteView, friendsView, settingsView, contentView};
    }

    async setupDefaultView(noteView, contentView) {
        // Default to showing the NoteView
        this.viewManager.showView(noteView);

        // Load the first note if no note is selected
        if (!this.store.getState().selectedNoteId) {
            let notes;
            try {
                notes = await this.db.getAll();
                if (notes && notes.length > 0) {
                    this.store.dispatch({type: 'SET_SELECTED_NOTE', payload: notes[0].id});
                    await noteView.selectNote(notes[0].id);
                } else {
                    console.warn('No notes available to select.');
                }
            } catch (error) {
                this.errorHandler.handleError(error, 'Error loading notes');
            }
        }
    }
}

/** TODO Nostr feed, and other 'live' content */
export class ContentView extends View {

}
