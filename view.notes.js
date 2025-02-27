import { renderList } from './list-renderer.js';
import { EditView } from './view.edit.js';
import { DB, getNotesIndex } from './db';
import * as Y from 'yjs';

export class NotesView extends HTMLElement {
    constructor(app) {
        super();
        this.app = app;
        this.el = document.createElement('div');
        this.el.className = 'notes-view';
        this.el.style.flexDirection = 'row';
        this.el.style.display = 'flex';

        // Initialize Yjs
        this.yDoc = new Y.Doc();
        this.notesListId = 'notesList';
        this.yMap = this.yDoc.getMap('notes');

        const sidebar = document.createElement('div');
        sidebar.style.width = '200px';
        sidebar.style.borderRight = '1px solid #ccc';
        sidebar.style.padding = '10px';
        sidebar.style.minWidth = '200px';

        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        addButton.addEventListener('click', () => {
            this.createNote({ name: '', content: '' }, this.elements.editView);
        });
        sidebar.appendChild(addButton);

        const notesList = document.createElement('ul');
        notesList.className = 'notes-list';
        notesList.style.listStyleType = 'none';
        notesList.style.padding = '0';
        sidebar.appendChild(notesList);

        const mainArea = document.createElement('div');
        mainArea.style.flex = '1';
        mainArea.style.flexGrow = '1';
        mainArea.style.padding = '10px';

        this.el.appendChild(sidebar);
        this.el.appendChild(mainArea);

        this.elements = { notesList: notesList, mainArea };
        this.elements.editView = new EditView(this.app);
        
        mainArea.appendChild(this.elements.editView.render());

        this.loadNotes();

        // Observe Yjs changes
        this.yMap.observe(event => {
            this.loadNotes();
        });

        notesList.addEventListener('click', async (e) => {
            if (e.target.tagName === 'LI') {
                const noteId = e.target.dataset.id;
                const note = await this.app.db.get(noteId);
                if (note) {
                    this.elements.editView.setContent(note.content);
                    this.elements.editView.selected = note;
                }
            }
        });
    }

    handleDeleteNote = async (note) => {
        await this.deleteNote(note);
    }

    async createNote(newNote, editView) {
        try {
            const newObject = await this.app.createNewObject(editView, newNote);
            this.app.showEditor(newObject);
            if (newObject) {
                await this.addNoteToList(newObject.id);
            }
            this.loadNotes();
        } catch (error) {
            console.error('Error creating note:', error);
        }
    }

    async updateNote({ id, content, completed }) {
        try {
            const note = await this.app.db.get(id);
            if (note) {
                await this.app.saveOrUpdateObject({ ...note, content, completed });
                this.loadNotes();
            }
        } catch (error) {
            console.error('Error updating note:', error);
        }
    }

    async deleteNote(note) {
        try {
            if (note) {
                await this.app.deleteCurrentObject(note);
                this.loadNotes();
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    async addNoteToList(noteId) {
        let notesList = this.yMap.get(this.notesListId);
        if (!notesList) {
            notesList = [];
        }
        notesList.push(noteId);
        this.yMap.set(this.notesListId, notesList);
    }

    async loadNotes() {
        let notesList = this.yMap.get(this.notesListId);
        if (!notesList) {
            notesList = [];
        }

        this.elements.notesList.innerHTML = '';
        for (const noteId of notesList) {
            const note = await this.app.db.get(noteId);
            if (note) {
                const noteElement = this.renderNObject(note);
                this.elements.notesList.append(noteElement);
            }
        }
    }

    render() {
        return this.el;
    }

    renderNObject(note) {
        const li = document.createElement('li');
        li.textContent = note.name + ': ' + note.content;
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => this.handleDeleteNote(note));
        li.appendChild(deleteButton);
        return li;
    }
}
customElements.define('notes-view', NotesView);