import {Edit} from './edit/edit.js';
import * as Y from 'yjs';

import {NotesSidebar} from './note/note.sidebar.js';
import {NoteDetails} from './note/note.details.js';

import {GenericListComponent} from './generic-list.js';

import {Ontology} from '../core/ontology.js';
import {NoteListRenderer} from './note/note-list-item-renderer.js';

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
        this.yMyObjectsList = this.yDoc.getArray('myObjectsList'); // Yjs array for my objects list

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
        this.privacyContainer = this.createPrivacyContainer();
        this.privacyLabel = this.createPrivacyLabel();
        this.privacyCheckbox = this.createPrivacyCheckbox();

        this.privacyContainer.appendChild(this.privacyLabel);
        this.privacyContainer.appendChild(this.privacyCheckbox);

        mainArea.appendChild(this.newPrivacyEdit());
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
        mainArea.appendChild(this.newLinkedView());
        mainArea.appendChild(this.newMatchesView());

        this.el.appendChild(mainArea);

        this.editor = new Edit(this.yDoc, this.app, null, null, null, this.app.getTagDefinition, this.app.schema);
        mainArea.appendChild(this.editor.el);

        // My Objects List
        const myObjectsArea = document.createElement('div');
        myObjectsArea.className = 'my-objects-area';
        myObjectsArea.style.padding = '10px';
        mainArea.appendChild(myObjectsArea);

        const myObjectsTitle = document.createElement('h2');
        myObjectsTitle.textContent = 'My Objects';
        myObjectsArea.appendChild(myObjectsTitle);

        this.myObjectsListComponent = new GenericListComponent(this.renderMyObjectItem.bind(this), this.yMyObjectsList);
        myObjectsArea.appendChild(this.myObjectsListComponent.el);

        const createObjectButton = document.createElement('button');
        createObjectButton.textContent = 'Create New Object';
        myObjectsArea.appendChild(createObjectButton);
        this.noteListRenderer = NoteListRenderer;

        // Initialize GenericListComponent for notes list
        this.notesListComponent = new GenericListComponent(this.noteListRenderer, this.yNotesList);
        sidebar.elements.notesList.replaceWith(this.notesListComponent.el);
        sidebar.el.insertBefore(this.newAddButton(), this.notesListComponent.el);
        this.selectedNote = null;

        this.loadInitialNotes(); // Load initial notes
    }

    showNoNotesMessage() {
        const message = document.createElement('div');
        message.textContent = 'No notes found. Click "Add" to create a new note.';
        message.className = 'no-notes-message';
        this.sidebar.elements.notesList.replaceWith(message);
    }

    /** TODO dynamically refresh when the list or the item name changes */
    /** Removed - using GenericListComponent */
    newAddButton() {
        addButton.textContent = 'Add';
        addButton.addEventListener('click', async () => {
            await this.createNote();
        });
        return addButton;
    }

    newPrivacyEdit() {
        return this.privacyContainer;
    }

    createPrivacyContainer() {
        const privacyContainer = document.createElement('div');
        privacyContainer.className = 'privacy-container';
        return privacyContainer;
    }

    newPriEdit() {
        const prioritySelect = this.createPrioritySelect();
        const priorities = ['High', 'Medium', 'Low'];
        priorities.forEach(priority => {
            const option = this.createPriorityOption(priority);
            prioritySelect.appendChild(option);
        });
        prioritySelect.addEventListener('change', async (event) => {
            const priority = event.target.value;
            await this.updateNotePriority(this.selectedNote.id, priority);
        });
        return prioritySelect;
    }

    createPrioritySelect() {
        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'note-priority-select';
        return prioritySelect;
    }

    createPriorityOption(priority) {
        const option = document.createElement('option');
        option.value = priority;
        option.textContent = priority;
        return option;
    }

    async handleDeleteNote(note) {
        try {
            if (note) {
                await this.app.db.delete(note.id);
                this.yDoc.transact(() => {
                    const index = this.yNotesList.toArray().findIndex(item => item[0] === note.id);
                    if (index !== -1) {
                        this.yNotesList.delete(index);
                    }
                });
                await this.notesListComponent.fetchDataAndRender();
                this.showMessage('Deleted');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    newTitleEdit() {
        return this.createTitleInput();
    }

    createTitleInput() {
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Note Title';
        titleInput.className = 'note-title-input';
        titleInput.addEventListener('input', () => {
            this.yDoc.transact(() => {
                this.yName.delete(0, this.yName.length); // Clear existing content
                this.yName.insert(0, titleInput.value); // Insert new content
            });
        });

        return titleInput;
    }

    focusTitleInput() {
        const titleInput = this.el.querySelector('.note-title-input');
        if (titleInput) {
            setTimeout(() => {
                titleInput.focus();
            }, 0);
        }
    }

    updateNoteTitleDisplay() {
        if (this.selectedNote) {
            const titleInput = this.el.querySelector('.note-title-input');
            if (titleInput) {
                titleInput.value = this.selectedNote.name; // Get name from selectedNote
            }
        }
    }

    newLinkedView() {
        return this.createTextView('Linked View');
    }

    newMatchesView() {
        return this.createTextView('Matches View');
    }

    createTextView(text) {
        const view = document.createElement('div');
        view.textContent = text;
        return view;
    }

    async createNote() {
        console.time('createNote');
        try {
            const timestamp = Date.now();
            // Log the state of this.editor and this.editor.contentHandler
            console.log('createNote function called');
            console.log('app.saveOrUpdateObject called');
            console.log("createNote: this.editor", this.editor);
            if (this.editor) {
                console.log("createNote: this.editor.contentHandler", this.editor.contentHandler);
            }

            const newObject = await this.app.db.save({
                id: timestamp.toString(),
                name: 'New Note',
                content: '',
                private: true,
                tags: [],
                priority: 'Medium',
                isPersistentQuery: false
            });
            console.timeEnd('createNote');
            if (newObject) {
                const yNoteMap = this.getYNoteMap(newObject.id);
                if (!yNoteMap) {
                    this.yDoc.transact(() => {
                        const newYNoteMap = new Y.Map();
                        newYNoteMap.set('name', 'New Note');
                        newYNoteMap.set('content', '');
                        this.yMap.set(newObject.id, newYNoteMap);
                    });
                }
                await this.addNoteToList(newObject.id);
                await this.notesListComponent.fetchDataAndRender();
                this.showMessage('Saved');
                this.edit.contentHandler.deserialize(newObject.content);
                this.focusTitleInput();
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
        console.log('yDoc in addNoteToList:', this.yDoc);
        console.log('yNotesList in addNoteToList:', this.yNotesList);
        try {
            this.yDoc.transact(() => {
                this.yNotesList.push([noteId]);
            });
        } catch (error) {
            console.error("Yjs error:", error);
        }
    }

    render() {
        return this.el;
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
            const note = await this.app.db.get(noteId);
            if (note) {
                await this.handleDeleteNote(note);
            }
        });
        li.appendChild(deleteButton);

        li.addEventListener('click', async () => {
            try {
                const note = await this.app.db.get(noteId);
                if (note) {
                    // Deselect previously selected note
                    const previousSelected = this.el.querySelector('.note-list-item.selected');
                    if (previousSelected) {
                        previousSelected.classList.remove('selected');
                    }

                    this.selectedNote = note;
                    this.populateNoteDetails(note);
                    this.edit.contentHandler.deserialize(note.content);

                    // Add 'selected' class to the clicked list item
                    li.classList.add('selected');
                }
            } catch (error) {
                this.app.errorHandler.handleError(error, 'Error selecting note');
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
                    nameElement.textContent = yNoteMap.get("name") || note.name;
                }
                nameElement.classList.add('note-name');
            } else {
                nameElement.textContent = 'Error loading note - DEBUG';
            }
        });

        return li;
    }

    populateNoteDetails(note) {
        const titleInput = this.el.querySelector('.note-title-input');
        const privacyCheckbox = this.el.querySelector('.privacy-checkbox');
        const prioritySelect = this.el.querySelector('.note-priority-select');

        if (titleInput) {
            titleInput.value = note.name;
        }
        if (privacyCheckbox) {
            privacyCheckbox.checked = note.private;
        }
        if (prioritySelect) {
            prioritySelect.value = note.priority;
        }
    }

    renderMyObjectItem(objectId) {
        const li = document.createElement('li');
        li.textContent = objectId;
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
                await this.app.db.saveObject(note, false);
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
            const titleInput = this.el.querySelector('.note-title-input');
            if (titleInput) {
                titleInput.value = this.yName.toString(); // Get name from Yjs
            }
        }
    }

    async updateNotePriority(noteId, priority) {
        try {
            const note = await this.app.db.get(noteId);
            if (note) {
                note.priority = priority;
                await this.app.db.saveObject(note, false);
                console.log(`Note ${noteId} priority updated to ${priority}`);
            } else {
                console.error(`Note ${noteId} not found`);
            }
        } catch (error) {
            console.error('Error updating note priority:', error);
        }
    }

    displayTags(noteId) {
        const tagList = this.el.querySelector('.note-tag-list');
        while (tagList.firstChild) {
            tagList.removeChild(tagList.firstChild);
        }
        this.getNoteTags(noteId).then(tags => {
            tags.forEach(tag => {
                const tagItem = document.createElement('li');
                tagItem.className = 'tag-item'; // Add a class for styling
                const tagDefinition = this.app.getTagDefinition(tag.name);
                const tagInput = new TagInput(tagDefinition, tag.value, (newValue) => {
                    // Handle tag value change
                    console.log('Tag value changed:', newValue);
                    this.updateTagValue(noteId, tag.name, newValue);
                });
                tagItem.appendChild(tagInput);
                tagList.appendChild(tagItem);
            });
        });
    }

    async removeTagFromNote(noteId, tagName) {
        try {
            const note = await this.app.db.get(noteId);
            if (note) {
                note.tags = note.tags.filter(tag => tag.name !== tagName);
                await this.app.db.saveObject(note, false);
                this.displayTags(noteId);
            } else {
                console.error('Note not found');
            }
        } catch (error) {
            console.error('Error removing tag from note:', error);
        }
    }

    // displayTagSuggestions(suggestions) {
    //
    //     const tagArea = this.el.querySelector('.note-tag-area');
    //     let suggestionsList = tagArea.querySelector('.note-tag-suggestions');
    //     if (!suggestionsList) {
    //         suggestionsList = document.createElement('ul');
    //         suggestionsList.className = 'note-tag-suggestions';
    //         tagArea.appendChild(suggestionsList);
    //     }
    //     while (suggestionsList.firstChild) {
    //         suggestionsList.removeChild(suggestionsList.firstChild);
    //     }
    //     suggestions.forEach(suggestion => {
    //         const suggestionItem = document.createElement('li');
    //         suggestionItem.textContent = suggestion;
    //         suggestionItem.addEventListener('click', () => {
    //             const tagInput = this.el.querySelector('.note-tag-input');
    //             tagInput.value = suggestion;
    //             this.addTagToNote(suggestion);
    //             while (suggestionsList.firstChild) {
    //                 suggestionsList.removeChild(suggestionsList.firstChild);
    //             }
    //         });
    //         suggestionsList.appendChild(suggestionItem);
    //     });
    // }

    async addTagToNote(tagName, tagValue = '', tagCondition = 'is') {
        try {
            if (!this.selectedNote || !this.selectedNote.id) {
                console.error('No note selected');
                return;
            }
            const noteId = this.selectedNote.id;
            const note = await this.app.db.get(noteId);
            if (note) {
                if (!note.tags) {
                    note.tags = [];
                }
                note.tags.push({name: tagName, value: tagValue, condition: tagCondition});
                await this.app.db.saveObject(note, false);
                this.displayTags(noteId);
                this.edit.contentHandler.insertTagAtSelection(tagName); // Update editor content
            } else {
                console.error('Note not found');
            }
        } catch (error) {
            console.error('Error adding tag to note:', error);
        }
    }
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}
