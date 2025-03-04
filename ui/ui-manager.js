import {createLayout} from './layout.js';
import {View} from "./view"
import {NoteView} from "./view.note";
import {FriendsView} from "./view.friends";
import {SettingsView} from "./view.settings";

export class UIManager {
    constructor(app) {
        this.app = app;
    }

    async setupUI(appDiv) {
        document.title = "Netention"; // Set the document title
        const {noteView, friendsView, settingsView, contentView} = this.initializeViews(this.app);
        this.setupDefaultView(this.app, noteView, contentView);

        // Select the first note if no notes exist
        let notes;
        try {
            notes = await this.app.db.getAll();
            if (!notes || notes.length === 0) {
                await this.app.noteManager.createDefaultNote();
            }
        } catch (error) {
            this.app.errorHandler.handleError(error, 'Error loading notes or creating default note');
        }

        const {menubar, mainContent} = createLayout(this.app, appDiv, noteView, friendsView, settingsView, contentView);
        // Display the name of the note in the editor title
        document.title = this.app.selected ? `Netention - ${this.app.selected.name}` : "Netention";
    }

    initializeViews(app) {
        const noteView = new NoteView(app, app.db, app.nostr);
        const friendsView = new FriendsView(app, app.db, app.nostr);
        const settingsView = new SettingsView(app, app.db, app.nostr);
        const contentView = new ContentView(app);

        return {noteView, friendsView, settingsView, contentView};
    }

    async setupDefaultView(app, noteView, contentView) {
        // Default to showing the NoteView
        app.viewManager.showView(noteView);

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
}

/** TODO Nostr feed, and other 'live' content */
export class ContentView extends View {

}
