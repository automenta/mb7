import * as Y from 'yjs';
import {NoteUI} from '@/ui/note/note.ui.js';
import {NoteList} from "@/ui/note/note-list.js";
import {NoteDetails} from "@/ui/note/note.details.js";
import {TagDisplay} from "@/ui/note/tag-display.js";
import {MyObjectsList} from "@/ui/note/my-objects-list.js";
import {GenericListComponent} from "@/ui/generic-list.js";
import {NotesSidebar} from "@/ui/note/note.sidebar.js";
import {Edit} from "@/ui/edit/edit.js";
import {getTagDefinition} from "@/core/ontology.js";
import {createElement} from "@/ui/utils.js";

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
            }
        } catch (error) {
            console.error("Error creating note:", error);
            this.app.notificationManager.showNotification(`Failed to create note: ${error.message}`, 'error');
        }
    }
}

export class NoteView extends HTMLElement {
    constructor(app, store, db, errorHandler, noteManager, noteYjsHandler, notificationManager, ontology) {
        super();
        this.app = app;
        this.store = store;
        this.db = db;
        this.errorHandler = errorHandler;
        this.noteManager = noteManager;
        this.noteYjsHandler = noteYjsHandler;
        this.notificationManager = notificationManager;
        this.ontology = ontology;

        this.yDoc = new Y.Doc();
        this.noteUI = new NoteUI();
        this.noteList = new NoteList(this.app, this, this.yDoc, this.yDoc.getArray('notesList'));
        this.notesListComponent = new GenericListComponent(this, this.noteList.yNotesList);
        this.noteDetails = new NoteDetails(this, this.app);
        this.tagDisplay = new TagDisplay(this.app);
        this.myObjectsList = new MyObjectsList(this, this.yDoc.getArray('myObjects'), this.app);
        this.noteCreator = new NoteCreator(noteManager, noteYjsHandler, this.yDoc);
        this.notesSidebar = new NotesSidebar(this.app, this);
        this.edit = null;
        this.selectedNote = null;

        this.el = createElement('div', {className: 'notes-view'});
        this.el.style.display = 'flex';
        this.el.style.flexDirection = 'row';
    }

    async build() {
        this.appendChild(this.el);
        this.el.appendChild(this.notesSidebar.render());
        this.el.appendChild(this.notesListComponent.render());
        this.el.appendChild(this.noteDetails.render());
        this.el.appendChild(this.tagDisplay.render());
        this.el.appendChild(this.myObjectsList.render());
        await this.createNote();

        await this.store.subscribe(() => {
            this.updateView();
        });
    }

    async updateView() {
        const selectedNoteId = this.store.getState().selectedNoteId;
        if (selectedNoteId and selectedNoteId !== this.selectedNote?.id) {
            await this.loadNote(selectedNoteId);
        }
    }

    async loadNote(noteId) {
        this.selectedNote = await this.db.get(noteId);
        if (this.selectedNote) {
            if (this.edit) {
                this.edit.el.remove();
                this.edit = null;
            }
            this.edit = new Edit(this.selectedNote, this.yDoc, this.app, getTagDefinition, this.ontology);
            this.el.appendChild(this.edit.el);
        }
    }

    renderListItem(noteIdArray) {
        const noteId = noteIdArray[0];
        const liContent = document.createElement('div');
        liContent.dataset.id = noteId;
        liContent.classList.add('note-list-item');

        this.renderNoteName(liContent, noteId);
        this.renderDeleteButton(liContent, noteId);

        liContent.addEventListener('click', async () => {
            await this.selectNote(noteId);
        });

        return liContent;
    }

    renderNoteName(liContent, noteId) {
        const nameElement = document.createElement('div');
        nameElement.style.fontWeight = 'bold';
        const yNoteMap = this.yDoc.getMap('notes').get(noteId);
        const noteName = yNoteMap ? yNoteMap.get('name') : `Note ID: ${noteId.substring(0, 8)}...`;
        nameElement.textContent = noteName;
        liContent.appendChild(nameElement);
    }

    renderDeleteButton(liContent, noteId) {
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            const note = await this.db.get(noteId);
            if (note) {
                await this.noteList.handleDeleteNote(note);
            }
        });
        liContent.appendChild(deleteButton);
    }


    async createNote() {
        await this.noteCreator.createNote();
    }

    remove() {
        this.el.remove();
    }

    async selectNote(noteId) {
        this.store.dispatch({type: 'SET_SELECTED_NOTE', payload: noteId});
    }
}

customElements.define('note-view', NoteView);
