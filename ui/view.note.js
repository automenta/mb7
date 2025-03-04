ui/view.note.js
import * as Y from 'yjs';
import { View } from '../view.js';
import { NotesSidebar } from '../note/note.sidebar.js';
import { NoteDetails } from '../note/note-details.js';
import { Edit } from './edit/edit.js';
import { NoteToolbar } from '../note/note.toolbar.js';
import { MyObjectsList } from '../note/my-objects-list.js';
import { NoteUI } from './note.ui.js';


class NoteCreator {
    constructor(noteManager, noteYjsHandler, yDoc) {
        this.noteManager = noteManager;
        this.noteYjsHandler = noteYjsHandler;
        this.yDoc = yDoc;
    }

    async createNote() {
        try {
            const newObject = await this.noteManager.createNote();
            if (newObject) {
                const yNoteMap = this.noteYjsHandler.getYNoteMap(newObject.id);
                if (!yNoteMap) {
                    this.yDoc.transact(() => {
                        const newYNoteMap = new Y.Map();
                        newYNoteMap.set('name', 'New Note');
                        newYNoteMap.set('content', '');
                        this.yDoc.getMap('notes').set(newObject.id, newYNoteMap);
                    });
                }
                return newObject;
            }
            return null;
        } catch (error) {
            console.error("Error creating note:", error);
            return null;
        }
    }
}


export class NoteView extends HTMLElement {
    constructor(app, store, db, errorHandler, noteManager, noteYjsHandler, notificationManager, ontology, matcher, nostr) {
        super();
        this.app = app;
        this.store = store;
        this.db = db;
        this.errorHandler = errorHandler;
        this.noteManager = noteManager;
        this.noteYjsHandler = noteYjsHandler;
        this.notificationManager = notificationManager;
        this.ontology = ontology;
        this.matcher = matcher;
        this.nostr = nostr;
        this.noteUI = new NoteUI(this);
        this.shadow = this.attachShadow({mode: 'open'});
        this.el = this.noteUI.render();
        this.shadow.appendChild(this.el);


        this.notesSidebar = new NotesSidebar(this.app, this);
        this.noteDetails = new NoteDetails(this.app, this);
        this.noteToolbar = new NoteToolbar(this);
        this.noteCreator = new NoteCreator(this.noteManager, this.noteYjsHandler, this.store.ydoc);
        this.myObjectsList = new MyObjectsList(this, this.store.yMyObjectsList, this.app);

        this.selectedNoteId = null;
        this.editView = null;
    }


    async connectedCallback() {
        this.render();
        this.loadNotes();
    }


    async loadNotes() {
        try {
            const notes = await this.noteManager.getAllNotes();
            this.renderNotesList(notes);
        } catch (error) {
            console.error("Error loading notes:", error);
        }
    }


    render() {
        this.noteUI.renderSidebar(this.notesSidebar);
        this.noteUI.renderToolbar(this.noteToolbar);
        this.noteUI.renderDetails(this.noteDetails);
        this.noteUI.renderMyObjectsList(this.myObjectsList);
        return this.el;
    }


    async createNote() {
        await this.noteCreator.createNote();
    }


    async renderNotesList(notes = []) {
        this.notesSidebar.renderNoteList(notes);
    }


    async handleNoteSelect(noteId) {
        this.selectedNoteId = noteId;
        const note = await this.noteManager.getNote(noteId);
        this.noteDetails.setSelectedNote(note);
        this.renderEditView(note);
    }


    async renderEditView(note) {
        if (this.editView) {
            this.editView.remove();
        }

        const ydoc = await this.app.db.getYDoc(note.id);
        if (!ydoc) {
            console.log("Creating new YDoc for note ID:", note.id);
            return await this.createNewYDocForNote(note);
        }
        console.log("YDoc already exists for note ID:", note.id);
        this.editView = new Edit(note, ydoc, this.app, this.getTagDefinition.bind(this), {});
        this.noteUI.renderEdit(this.editView);
    }

    getTagDefinition(tagName) {
        for (const category in this.ontology) {
            if (this.ontology[category].tags && this.ontology[category].tags[tagName]) {
                return this.ontology[category].tags[tagName];
            }
        }
        return null;
    }


    async createNewYDocForNote(note) {
        const ydoc = new Y.Doc();
        await this.app.db.saveYDoc(note.id, ydoc);
        this.editView = new Edit(note, ydoc, this.app, this.getTagDefinition.bind(this), {});
        this.noteUI.renderEdit(this.editView);
    }


    async handleDeleteNote() {
        if (!this.selectedNoteId) {
            this.notificationManager.showNotification("No note selected for deletion.", 'warning');
            return;
        }

        try {
            await this.noteManager.deleteNote(this.selectedNoteId);
            this.notificationManager.showNotification("Note deleted successfully.", 'success');
            this.clearView();
            await this.loadNotes();
        } catch (error) {
            console.error("Error deleting note:", error);
            this.notificationManager.showNotification("Failed to delete note.", 'error');
        }
    }


    clearView() {
        if (this.editView) {
            this.editView.remove();
            this.editView = null;
        }
        this.noteDetails.setSelectedNote(null);
    }


    remove() {
        this.el.remove();
    }
}

customElements.define('note-view', NoteView);
