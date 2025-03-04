import { NoteDetails } from './note/note.details.js';
import { NoteListComponent } from './note/note-list.js';
import { Edit } from './edit/edit.js';
import { View } from './view.js';
import { createElement } from './utils.js';

export class NoteView extends View {
    constructor(app, store, db, errorHandler, noteManager, noteYjsHandler, notificationManager, ontologyBrowser) {
        super(app, `<div id="note-view" class="view"></div>`);
        this.app = app;
        this.store = store;
        this.db = db;
        this.errorHandler = errorHandler;
        this.noteManager = noteManager;
        this.noteYjsHandler = noteYjsHandler;
        this.notificationManager = notificationManager;
        this.ontologyBrowser = ontologyBrowser;
        this.selectedNote = null;
        this.edit = null;
        this.noteDetails = new NoteDetails(this.app, this);
        this.noteList = null;
    }

    async build() {
        this.el.innerHTML = '';
        this.noteList = new NoteListComponent(this, this.store.notes, this.app);
        this.el.appendChild(this.noteList.render());
        this.el.appendChild(this.noteDetails);

        this.noteList.genericListComponent.listElement.addEventListener('click', async (e) => {
            if (e.target.closest('.list-item')) {
                const noteId = e.target.closest('.list-item').getAttribute('data-id');
                if (noteId) {
                    await this.loadNoteForEdit(noteId);
                }
            }
        });
    }


    async loadNoteForEdit(noteId) {
        if (this.edit) {
            this.edit.el.remove();
        }

        const note = await this.db.get(noteId);
        if (!note) {
            console.error(`Note with id ${noteId} not found`);
            return;
        }

        const yDoc = await this.db.getYDoc(noteId);
        if (!yDoc) {
            console.error(`YDoc for note id ${noteId} not found`);
            return;
        }

        this.selectedNote = note;
        this.edit = new Edit(note, yDoc, this.app, this.app.getTagDefinition, this.app.schema);
        this.el.appendChild(this.edit.render());

        this.noteDetails.selectedNote = note;
        this.noteDetails.render();

        this.dispatchEvent(new CustomEvent('note-selected', {
            bubbles: true,
            composed: true,
            detail: { note: note }
        }));
    }


    render() {
        this.build();
        return this.el;
    }

    remove() {
        this.el.remove();
    }
}
