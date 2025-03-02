import {Edit} from './edit/edit';
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
            this.createNote({name: '', content: ''});
        });
        sidebar.appendChild(addButton);

        const notesList = document.createElement('ul');
        notesList.className = 'notes-list';
        notesList.style.listStyleType = 'none';
        notesList.style.padding = '0';
        sidebar.appendChild(notesList);

        this.elements = {
            notesList: notesList
        };

        const mainArea = document.createElement('div');
        mainArea.style.flex = '1';
        mainArea.style.flexGrow = '1';
        mainArea.style.padding = '10px';

        this.el.appendChild(sidebar);
        this.el.appendChild(mainArea);

        this.edit = new Edit();
        mainArea.appendChild(this.edit.el);
        this.selectedNote = null;

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
                    this.edit.setContent(note.content);
                    this.selectedNote = note;
                }
            }
        });
    }

    handleDeleteNote = async (note) => {
        await this.deleteNote(note);
    }

    async createNote(newNote) {
        try {
            const newObject = await this.app.createNewObject(null, newNote);
            if (newObject) {
                await this.app.saveOrUpdateObject(newObject);
                await this.addNoteToList(newObject.id);
            }
            await this.loadNotes();
        } catch (error) {
            console.error('Error creating note:', error);
        }
    }

    async deleteNote(note) {
        try {
            if (note) {
                await this.app.db.delete(note.id);
                await this.loadNotes();
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    async addNoteToList(noteId) {
        let notesList = this.yMap.get(this.notesListId) ?? [];
        notesList.push(noteId);
        this.yMap.set(this.notesListId, notesList);
    }

    async loadNotes() {
        let notesList = this.yMap.get(this.notesListId) ?? [];

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
        const nameElement = document.createElement('div');
        nameElement.textContent = note.name;
        nameElement.style.fontWeight = 'bold';
        const contentElement = document.createElement('div');
        contentElement.textContent = note.content;
        li.appendChild(nameElement);
        li.appendChild(contentElement);
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', () => this.handleDeleteNote(note));
        li.appendChild(deleteButton);
        li.dataset.id = note.id;
        return li;
    }
}

customElements.define('notes-view', NotesView);