import {Edit} from './edit/edit.js';
import * as Y from 'yjs';

import {NotesSidebar} from './note/note.sidebar.js';
import {NoteDetails} from './note/note.details.js';

import {GenericListComponent} from './generic-list.js';

export class NoteView extends HTMLElement {
    constructor(app, db, nostr) {
        super();
        this.app = app;
        this.db = db;
        this.nostr = nostr;
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

        const noteDetails = new NoteDetails(this);

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

        // TODO Area
        const todoArea = document.createElement('div');
        todoArea.className = 'note-todo-area';
        todoArea.style.padding = '10px';
        mainArea.appendChild(todoArea);

        // Tag Area
        const tagArea = document.createElement('div');
        tagArea.className = 'note-tag-area';
        tagArea.style.padding = '10px';
        mainArea.appendChild(tagArea);

        mainArea.appendChild(this.newLinkedView());
        mainArea.appendChild(this.newMatchesView());

        this.el.appendChild(mainArea);

        this.semanticEditor = new Edit(this.yDoc, this.app, null, null, null, this.app.getTagDefinition, this.app.schema);
        mainArea.appendChild(this.semanticEditor.el);

        // My Objects List
        const myObjectsArea = document.createElement('div');
        myObjectsArea.className = 'my-objects-area';
        myObjectsArea.style.padding = '10px';
        mainArea.appendChild(myObjectsArea);

        const myObjectsTitle = document.createElement('h2');
        myObjectsTitle.textContent = 'My Objects';
        myObjectsArea.appendChild(myObjectsTitle);

        const myObjectsList = document.createElement('ul');
        myObjectsArea.appendChild(myObjectsList);

        const createObjectButton = document.createElement('button');
        createObjectButton.textContent = 'Create New Object';
        myObjectsArea.appendChild(createObjectButton);

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
        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'note-priority-select';
        const priorities = ['High', 'Medium', 'Low'];
        priorities.forEach(priority => {
            const option = document.createElement('option');
            option.value = priority;
            option.textContent = priority;
            prioritySelect.appendChild(option);
        });
        prioritySelect.addEventListener('change', async (event) => {
            const priority = event.target.value;
            await this.updateNotePriority(this.selectedNote.id, priority);
        });
        return prioritySelect;
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
            const newObject = await this.app.saveOrUpdateObject({name: '', content: '', timestamp, private: true, tags: [], priority: 'Medium'});
            if (newObject) {
                await this.addNoteToList(newObject.id);
                await this.notesListComponent.fetchDataAndRender();
                this.showMessage('Saved');
                this.edit.contentHandler.deserialize(newObject.content);
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
                this.edit.contentHandler.deserialize(note.content);
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
                            this.edit.contentHandler.deserialize(yNoteMap.get("content"));
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

    async updateNotePrivacy(noteId, isPrivate) {
        try {
            const note = await this.app.db.get(noteId);
            if (note) {
                note.private = isPrivate;
                await this.app.db.saveObject(note);
                console.log(`Note ${noteId} privacy updated to ${isPrivate}`);
            } else {
                console.error(`Note ${noteId} not found`);
            }
        } catch (error) {
            console.error('Error updating note privacy:', error);
        }
    }

    async getNoteTags(noteId) {
        try {
            const note = await this.app.db.get(noteId);
            if (note && note.tags) {
                return note.tags;
            } else {
                return [];
            }
        } catch (error) {
            console.error('Error getting note tags:', error);
        }
    }

    updateNoteTitleDisplay() {
        if (this.selectedNote) {
            const titleInput = this.el.querySelector('.note-title-container input[type="text"]');
            if (titleInput) {
                titleInput.value = this.edit.yName.toString(); // Get name from Yjs
            }
        }
    }
    async updateNotePriority(noteId, priority) {
        try {
            const note = await this.app.db.get(noteId);
            if (note) {
                note.priority = priority;
                await this.app.db.saveObject(note);
                console.log(`Note ${noteId} priority updated to ${priority}`);
            } else {
                console.error(`Note ${noteId} not found`);
            }
        } catch (error) {
            console.error('Error updating note priority:', error);
        }
    }
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}