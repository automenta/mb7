import { Edit } from './edit/edit.js';
import { TagManager } from './tag-manager.js';
import * as Y from 'yjs';

import {NotesSidebar} from './note/note.sidebar.js';

import {GenericListComponent} from './generic-list.js';

import {Ontology} from '../core/ontology.js';
import {NoteListRenderer} from './note/note-list-item-renderer.js';

import {
    createPrivacyContainer,
    createPrioritySelect,
    createTitleInput,
    createTextView
} from './note/note.ui.js';

class NoteList {
    constructor(app, noteView, yNotesList, notesListComponent) {
        this.app = app;
        this.noteView = noteView;
        this.yNotesList = yNotesList;
        this.notesListComponent = notesListComponent;
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
                this.noteView.showMessage('Deleted');
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
            await this.noteView.selectNote(noteId);
        });

        return li;
    }
}

class NoteDetails extends HTMLElement {
    constructor(noteView) {
        super();
        this.noteView = noteView;
    }

    populateNoteDetails(note) {
        const titleInput = this.noteView.el.querySelector('.note-title-input');
        const privacyCheckbox = this.shadow.querySelector('.privacy-checkbox');
        const prioritySelect = this.shadow.querySelector('.priority-select');

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
}

if (!customElements.get('note-details')) {
    customElements.define('note-details', NoteDetails);
}

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

        this.sidebar = new NotesSidebar(app, this);
        this.noteDetails = new NoteDetails(this);

        this.mainArea = this.createMainArea();
        this.privacyContainer = createPrivacyContainer();
        this.privacyLabel = this.createPrivacyLabel();
        this.privacyCheckbox = this.createPrivacyCheckbox();
        this.contentArea = this.createContentArea();
        this.todoArea = this.createTodoArea();
        this.tagArea = this.createTagArea();
        this.myObjectsArea = this.createMyObjectsArea();

        this.el.appendChild(this.sidebar.render());

        this.mainArea.appendChild(this.newTitleEdit());
        this.privacyContainer.appendChild(this.privacyLabel);
        this.privacyContainer.appendChild(this.privacyCheckbox);
        this.mainArea.appendChild(this.newPrivacyEdit());

        this.noteDetailsComponent = new NoteDetails(this);
        this.mainArea.appendChild(this.noteDetailsComponent);

        this.mainArea.appendChild(this.contentArea);
        this.mainArea.appendChild(this.todoArea);
        this.mainArea.appendChild(this.newLinkedView());
        this.mainArea.appendChild(this.newMatchesView());

        this.editor = new Edit(this.selectedNote, this.yDoc, this.app, null, null, null, this.app.getTagDefinition, this.schema);
        this.mainArea.appendChild(this.editor.el);

        this.tagManager = new TagManager(this.app, this.selectedNote);
        this.mainArea.appendChild(this.tagManager);

        this.mainArea.appendChild(this.myObjectsArea);

        this.myObjectsListComponent = new GenericListComponent(this.renderMyObjectItem.bind(this), this.yMyObjectsList);
        this.myObjectsArea.appendChild(this.myObjectsListComponent.el);

        const createObjectButton = document.createElement('button');
        createObjectButton.textContent = 'Create New Object';
        this.myObjectsArea.appendChild(createObjectButton);

        this.noteListRenderer = NoteListRenderer;

        this.notesListComponent = new GenericListComponent(this.noteListRenderer, this.yNotesList);
        this.sidebar.elements.notesList.replaceWith(this.notesListComponent.el);
        this.sidebar.el.insertBefore(this.newAddButton(), this.notesListComponent.el);

        this.noteList = new NoteList(this.app, this, this.yNotesList, this.notesListComponent);

        this.el.appendChild(this.mainArea);

        this.selectedNote = null;
    }

    createPrivacyContainer() {
        const privacyContainer = document.createElement('div');
        privacyContainer.className = 'privacy-container';
        return privacyContainer;
    }

    createPrioritySelect() {
        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'note-priority-select';
        return prioritySelect;
    }

    createMainArea() {
        const mainArea = document.createElement('div');
        mainArea.style.flex = '1';
        mainArea.style.flexGrow = '1';
        mainArea.style.padding = '10px';
        return mainArea;
    }

    createContentArea() {
        const contentArea = document.createElement('div');
        contentArea.className = 'note-content-area';
        contentArea.style.padding = '10px';
        return contentArea;
    }

    createTodoArea() {
        const todoArea = document.createElement('div');
        todoArea.className = 'note-todo-area';
        todoArea.style.padding = '10px';
        return todoArea;
    }

    createTagArea() {
        const tagArea = document.createElement('div');
        tagArea.className = 'note-tag-area';
        tagArea.style.padding = '10px';
        return tagArea;
    }

    createMyObjectsArea() {
        const myObjectsArea = document.createElement('div');
        myObjectsArea.className = 'my-objects-area';
        myObjectsArea.style.padding = '10px';
        return myObjectsArea;
    }

    newTitleEdit() {
        return this.createTitleInput();
    }

    createTitleInput() {
        const titleInput = createTitleInput(() => {
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
        return createTextView('Linked View');
    }

    newMatchesView() {
        return createTextView('Matches View');
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
                await this.noteList.addNoteToList(newObject.id);
                await this.notesListComponent.fetchDataAndRender();
                this.showMessage('Saved');
                await this.selectNote(newObject.id);
                this.edit.contentHandler.deserialize(newObject.content);
                this.focusTitleInput();
            } else {
                console.error('Error creating note: newObject is null');
            }
        } catch (error) {
            console.error('Error creating note:', error);
        }
    }

    async selectNote(noteId) {
        try {
            const note = await this.app.db.get(noteId);
            if (note) {
                // Deselect previously selected note
                const previousSelected = this.el.querySelector('.note-list-item.selected');
                if (previousSelected) {
                    previousSelected.classList.remove('selected');
                }

                this.selectedNote = note;
                this.noteDetailsComponent.populateNoteDetails(note);
                if (this.edit && this.edit.contentHandler) {
                    this.edit.contentHandler.deserialize(note.content);
                }
                await this.displayTags(noteId);

                // Add 'selected' class to the clicked list item
                const listItem = this.el.querySelector(`.note-list-item[data-id="${noteId}"]`);
                if (listItem) {
                    listItem.classList.add('selected');
                }

                const yNoteMap = this.getYNoteMap(noteId);
                const nameElement = listItem?.querySelector('.note-name');
                if (yNoteMap && nameElement) {
                    yNoteMap.observe((event) => {
                        if (event.changes.keys.has("name")) {
                            nameElement.textContent = yNoteMap.get("name");
                        }
                        if (event.changes.keys.has("content") && this.edit.contentHandler) {
                            this.edit.contentHandler.deserialize(yNoteMap.get("content"));
                        }
                    });
                    nameElement.textContent = yNoteMap.get("name") || note.name;
                }
            }
        } catch (error) {
            this.app.errorHandler.handleError(error, 'Error selecting note');
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

    async displayTags(noteId) {
        const tagArea = this.mainArea.querySelector('.note-tag-area');
        tagArea.innerHTML = ''; // Clear existing tags

        try {
            const note = await this.app.db.get(noteId);
            if (note && note.tags) {
                note.tags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.textContent = `${tag.name}: ${tag.value} `;
                    tagArea.appendChild(tagElement);
                });
            } else {
                console.log('No tags found for this note.');
            }
        } catch (error) {
            console.error('Error getting note tags:', error);
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
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}
