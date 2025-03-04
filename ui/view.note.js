import * as Y from 'yjs';
import {NoteUI} from './note/note.ui.js';
import {NoteList} from "./note/note-list.js";
import {NoteDetails} from "./note/note.details.js";
import {TagDisplay} from "./tag-display.js";
import {MyObjectsList} from "./my-objects-list.js";
import {NoteYjsHandler} from "./note-yjs-handler.js";
import {GenericListComponent} from "../generic-list-component";
import {NotesSidebar} from "./note.sidebar";

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
        }
    }
}

class NoteViewElements {
    constructor() {
        this.el = document.createElement('div');
        this.el.className = 'notes-view';
        this.el.style.flexDirection = 'row';
        this.el.style.display = 'flex';
    }

    createElement(type, options = {}, text = '') {
        const element = document.createElement(type);
        Object.assign(element, options);
        if (text) {
            element.textContent = text;
        }
        return element;
    }
}

export class NoteView extends HTMLElement {
    constructor(store, db, errorHandler, noteManager, noteYjsHandler, notificationManager) {
        super();
        this.store = store;
        this.db = db;
        this.errorHandler = errorHandler;
        this.noteManager = noteManager;
        this.noteYjsHandler = noteYjsHandler;
        this.notificationManager = notificationManager;

        this.yDoc = new Y.Doc();
        this.noteUI = new NoteUI();
        this.noteList = new NoteList(this.store, this, this.yDoc, this.yDoc.getArray('notesList'));
        this.notesListComponent = new GenericListComponent(this.renderNoteItem.bind(this), this.noteList.yNotesList);
        this.noteDetails = new NoteDetails(this);
        this.tagDisplay = new TagDisplay();
        this.myObjectsList = new MyObjectsList(this, this.yDoc.getArray('myObjects'));
        this.noteCreator = new NoteCreator(noteManager, noteYjsHandler, this.yDoc);
        this.noteElements = new NoteViewElements();
        this.notesSidebar = new NotesSidebar(this, this);

        this.el = this.noteElements.createElement('div', {className: 'notes-view'});
        this.el.style.flexDirection = 'row';
        this.el.style.display = 'flex';

        this.build();
    }

    async build() {
        this.el.appendChild(this.notesSidebar.render());
        this.el.appendChild(this.notesListComponent.render());
        this.el.appendChild(this.noteDetails.render());
        this.el.appendChild(this.tagDisplay.render());
        this.el.appendChild(this.myObjectsList.render());
        this.el.appendChild(await this.noteCreator.createNote());
        document.body.appendChild(this.el);
    }

    renderNoteItem(noteIdArray) { // Renamed from renderNObject to renderNoteItem, used by GenericListComponent, now receives noteId
        const noteId = noteIdArray[0];
        const li = document.createElement('li');
        li.dataset.id = noteId;
        li.classList.add('note-list-item');
        const nameElement = document.createElement('div');
        nameElement.style.fontWeight = 'bold';
        li.appendChild(nameElement);
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', async (event) => {
            event.stopPropagation(); // Prevent note selection
            const note = await this.db.get(noteId);
            if (note) {
                await this.noteList.handleDeleteNote(note);
            }
        });
        li.appendChild(deleteButton);

        li.addEventListener('click', async () => {
            await this.selectNote(noteId);
        });

        return li;
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
