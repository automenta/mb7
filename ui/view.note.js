import * as Y from 'yjs';
import { NoteUI } from './note/note.ui.js';
import {NoteList} from "./note/note-list";
import {NoteDetails} from "./note/note.details.js";
import {TagDisplay} from "./tag-display.js";
import {MyObjectsList} from "./my-objects-list";
import {NoteYjsManager} from "../core/note.yjs.manager";

class NoteCreator {
    constructor(noteView) {
        this.noteView = noteView;
    }

    async createNote() {
        try {
            const newObject = await this.noteView.app.noteManager.createNote();
            if (newObject) {
                const yNoteMap = this.noteView.noteYjsManager.getYNoteMap(newObject.id);
                if (!yNoteMap) {
                    this.noteView.yDoc.transact(() => {
                        const newYNoteMap = new Y.Map();
                        newYNoteMap.set('name', 'New Note');
                        newYNoteMap.set('content', '');
                        this.noteView.yDoc.getMap('notes').set(newObject.id, newYNoteMap);
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
    constructor(app, db, nostr) {
        super();
        this.app = app;
        this.db = db;
        this.nostr = nostr;

        this.yDoc = new Y.Doc();
        this.noteYjsManager = new NoteYjsManager(this.yDoc);

        this.noteUI = new NoteUI();
        this.noteList = new NoteList(this, this.yDoc.getMap('notes'));
        this.noteDetails = new NoteDetails(this);
        this.tagDisplay = new TagDisplay();
        this.myObjectsList = new MyObjectsList(this, this.yDoc.getArray('myObjects'));
        this.noteCreator = new NoteCreator(this);
        this.noteElements = new NoteViewElements();

        this.el = this.noteElements.createElement('div', { className: 'notes-view' });
        this.el.style.flexDirection = 'row';
        this.el.style.display = 'flex';

        this.build();
    }

    async build() {
        this.el.appendChild(this.noteList.render());
        this.el.appendChild(this.noteDetails.render());
        this.el.appendChild(this.tagDisplay.render());
        this.el.appendChild(this.myObjectsList.render());
        this.el.appendChild(this.noteCreator.createNote());
        document.body.appendChild(this.el);
    }

    async createNote() {
        await this.noteCreator.createNote();
    }

    remove() {
        this.el.remove();
    }
}
