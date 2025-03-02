import {Edit} from './edit/edit.js';
import * as Y from 'yjs';

import {NotesSidebar} from './note/note.sidebar.js';
import {NoteDetails} from './note/note.details.js';

import {GenericListComponent} from './generic-list.js';

export class NoteView extends HTMLElement {
    constructor(app) {
        super();
        this.app = app;
        const sidebar = this.sidebar = new NotesSidebar(app, this);

        this.yDoc = new Y.Doc();
        this.notesListId = 'notesList';
        this.yMap = this.yDoc.getMap('notes');
        this.yName = this.yDoc.getText('name');
        this.yNotesList = this.yDoc.getArray('notesList'); // Yjs array for notes list

        this.el = document.createElement('div');
        this.el.className = 'notes-view';
        this.el.style.flexDirection = 'row';
        this.el.style.display = 'flex';

        const noteDetails = new NoteDetails();

        const mainArea = document.createElement('div');
        mainArea.style.flex = '1';
        mainArea.style.flexGrow = '1';
        mainArea.style.padding = '10px';

        this.el.appendChild(sidebar.render());

        mainArea.appendChild(this.newTitleEdit());

        // Details
        mainArea.appendChild(noteDetails.render());

        // Content area
        const contentArea = document.createElement('div');
        contentArea.className = 'note-content-area';
        contentArea.style.padding = '10px';
        mainArea.appendChild(contentArea);

        mainArea.appendChild(this.newLinkedView());
        mainArea.appendChild(this.newMatchesView());

        this.el.appendChild(mainArea);

        this.edit = new Edit(this.yDoc, this.app);
        mainArea.appendChild(this.edit.el);

        // Initialize GenericListComponent for notes list
        this.notesListComponent = new GenericListComponent(this.renderNoteItem.bind(this), this.yNotesList);
        sidebar.elements.notesList.replaceWith(this.notesListComponent.el);
        sidebar.el.insertBefore(this.newAddButton(), this.notesListComponent.el);
        this.selectedNote = null;

        this.loadInitialNotes(); // Load initial notes
    }

    async loadInitialNotes() {
        try {
            const notes = await this.app.db.getAll();
            if (notes && notes.length > 0) {
                this.yDoc.transact(() => {
                    notes.forEach(note => {
                        this.yNotesList.push([note.id]);
                    });
                });
                await this.notesListComponent.fetchDataAndRender(); // Re-render the list
            } else {
                console.log("No notes found in database on initial load.");
                await this.createNote(); // Create default note if no notes exist
            }
        } catch (error) {
            console.error("Error loading initial notes:", error);
        }
    }

    /** TODO dynamically refresh when the list or the item name changes */
    /** Removed - using GenericListComponent */
    newAddButton() {
        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        addButton.addEventListener('click', async () => {
            await this.createNote();
        });
        return addButton;
    }


    newShareEdit() {
        const sharingLabel = document.createElement('span');
        sharingLabel.textContent = '👥 No One';
        sharingLabel.style.marginLeft = '10px';
        return sharingLabel;
    }

    newPrivacyEdit() {
        const privacyLabel = document.createElement('span');
        privacyLabel.textContent = '🔒 Private';
        privacyLabel.style.marginLeft = '10px';
        return privacyLabel;
    }

    newPriEdit() {
        const priorityLabel = document.createElement('span');
        priorityLabel.textContent = '🚩 Med';
        return priorityLabel;
    }

    async handleDeleteNote(note) {
    }

    newTitleEdit() {
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Note Title';
        titleInput.className = 'note-title-input';
        return titleInput;
    }

    newLinkedView() {
        const linkedView = document.createElement('div');
        linkedView.textContent = 'Linked View';
        return linkedView;
    }

    newMatchesView() {
        const matchesView = document.createElement('div');
        matchesView.textContent = 'Matches View';
        return matchesView;
    }

    async createNote() {
        console.log('createNote function called');
        try {
            const timestamp = Date.now();
            const newObject = await this.app.createNewObject({name: '', content: '', timestamp});
            if (newObject) {
                this.selectedNote = newObject;
                await this.addNoteToList(newObject.id);
                await this.notesListComponent.fetchDataAndRender();
                this.showMessage('Saved');
            } else {
                console.error('Error creating note: newObject is null');
            }
        } catch (error) {
            console.error('Error creating note:', error);
        }
    }

    async deleteNote(note) {
        try {
            if (note) {
                await this.app.db.delete(note.id);
                await this.loadNotes();
                this.showMessage('Deleted');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    async addNoteToList(noteId) {
        this.yDoc.transact(() => {
            this.yNotesList.push([noteId]);
        });
    }

    render() {
        return this.el;
    }

    renderNoteItem(noteIdArray) { // Renamed from renderNObject to renderNoteItem, used by GenericListComponent, now receives noteId
        const noteId = noteIdArray[0];
        const li = document.createElement('li');
        li.dataset.id = noteId;
        const nameElement = document.createElement('div');
        nameElement.style.fontWeight = 'bold';
        li.appendChild(nameElement);
        li.addEventListener('click', async () => {
            const note = await this.app.db.get(noteId);
            if (note) {
                this.selectedNote = note;
                this.edit.editorArea.innerHTML = note.content;
            }
        });

        this.app.db.get(noteId).then(note => {
            if (note) {
                const yNoteMap = this.getYNoteMap(noteId);
                if (yNoteMap) {
                    yNoteMap.observe((event) => {
                        if (event.changes.keys.has("name")) {
                            nameElement.textContent = yNoteMap.get("name");
                        }
                        if (event.changes.keys.has("content")) {
                            this.edit.editorArea.innerHTML = yNoteMap.get("content");
                        }
                    });
                    nameElement.textContent = note.name;
                }
                li.classList.add('note-list-item'); // Add a CSS class for styling
                nameElement.classList.add('note-name');
            } else {
                nameElement.textContent = 'Error loading note - DEBUG';
            }
        });

        return li;
    }

    getYNoteMap(noteId) {
        return this.yMap.get(noteId);
    }

    showMessage(message) {
        const e = document.createElement('div');
        e.textContent = message;
        const es = e.style;
        es.position = 'absolute';
        es.top = '0';
        es.left = '0';
        es.backgroundColor = 'lightgreen';
        es.padding = '10px';
        this.el.appendChild(e);
        setTimeout(() => {
            this.el.removeChild(e);
        }, 3000);
    }

    updateNoteTitleDisplay() {
        if (this.selectedNote) {
            const titleInput = this.el.querySelector('.note-title-container input[type="text"]');
            if (titleInput) {
                titleInput.value = this.edit.yName.toString(); // Get name from Yjs
            }
        }
    }
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}