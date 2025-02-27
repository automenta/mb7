// view.notes.js
import {Edit} from './edit.js';
import { renderList } from './list-renderer.js';
import { DB, getNotesIndex } from './db';

export class NotesView extends HTMLElement {
    constructor(app) {
        super();
        this.app = app;
        this.el = document.createElement('div');
        this.el.className = 'notes-view';
        
        const notesList = document.createElement('div');
        notesList.id = 'notes-list';
        
        const sidebar = document.createElement('div');
        sidebar.style.width = '200px';
        sidebar.style.borderRight = '1px solid #ccc';
        sidebar.style.padding = '10px';
        sidebar.appendChild(notesList);
        
        const mainArea = document.createElement('div');
        mainArea.style.flex = '1';
        mainArea.style.padding = '10px';
        
        const editView = new Edit();
        mainArea.appendChild(editView.el);

        this.el.appendChild(sidebar);
        this.el.appendChild(mainArea);
        this.elements = {notesList, mainArea, editView};

        this.loadNotes();

        this.elements.notesList.addEventListener('click', async (e) => {
            if (e.target.tagName === 'LI') {
                const noteId = e.target.dataset.id;
                const note = await this.app.db.get(noteId);
                this.elements.editView.setContent(note.content);
                this.elements.editView.selected = note;
            }
        });

        this.elements.editView.editorArea.addEventListener('create', this.createNote.bind(this));
        this.elements.editView.editorArea.addEventListener('update', this.updateNote.bind(this));
        this.elements.editView.editorArea.addEventListener('delete', this.deleteNote.bind(this));
    }

    async createNote() {
        const content = this.elements.editView.getContent();
        if (content.trim() === '') return;
        const newNote = await this.app.db.create({ content });
        this.elements.editView.setContent('');
        this.elements.editView.selected = null;
        this.loadNotes();
    }

    async updateNote() {
        if (!this.elements.editView.selected) return;
        const content = this.elements.editView.getContent();
        await this.app.db.update(this.elements.editView.selected.id, { content });
        this.loadNotes();
    }

    async deleteNote() {
        if (!this.elements.editView.selected) return;
        await this.app.db.delete(this.elements.editView.selected.id);
        this.elements.editView.setContent('');
        this.elements.editView.selected = null;
        this.loadNotes();
    }

    async loadNotes() {
        const notes = await getNotesIndex();
        const noteObjects = await Promise.all(notes.map(id => this.app.db.get(id)));
        renderList(noteObjects, this.elements.notesList, this.deleteNote.bind(this), this.updateNote.bind(this));
    }

    render() {
        return this.el;
    }
}

customElements.define('notes-view', NotesView);