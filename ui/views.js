import {FriendsView} from "./view.friends.js";
import {SettingsView} from "./view.settings.js";
import {NoteView as NoteView} from './view.note.js';
import {ContentView} from "./ui-manager.js";
import { v4 as uuidv4 } from 'uuid';

function initializeViews(app) {
    const noteView = new NoteView(app, app.db, app.nostr);
    const friendsView = new FriendsView(app, app.db, app.nostr);
    const settingsView = new SettingsView(app, app.db, app.nostr);
    const contentView = new ContentView(app);

    noteView.createNote = async () => {
        const newNote = {
            id: uuidv4(),
            name: 'New Note',
            content: '',
            tags: [],
            isPersistentQuery: false,
            private: false
        };
        await app.saveObject(newNote);
        noteView.loadNotes();
    };

    return {noteView, friendsView, settingsView, contentView};
}

export { initializeViews };
