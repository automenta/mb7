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

        this.sidebar = new NotesSidebar(app, this);
        this.noteDetails = new NoteDetails(this);

        this.mainArea = this.createMainArea();
        this.privacyContainer = this.createPrivacyContainer();
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
        this.mainArea.appendChild(this.noteDetails.render());
        this.mainArea.appendChild(this.contentArea);
        this.mainArea.appendChild(this.todoArea);
        this.mainArea.appendChild(this.newLinkedView());
        this.mainArea.appendChild(this.newMatchesView());

        this.editor = new Edit(this.selectedNote, this.yDoc, this.app, null, null, null, this.app.getTagDefinition, this.schema);
        this.mainArea.appendChild(this.editor.el);

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
        await this.loadNote(noteId);
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
            await this.selectNote(noteId);
        });

        return li;
    }

    async loadNote(noteId) {
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
                if (this.edit && this.edit.contentHandler) {
                    this.edit.contentHandler.deserialize(note.content);
                }
                this.displayTags(noteId);

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
         const prioritySelect = this.el.querySelector('.priority-select');
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
                tagItem.className = 'tag-item';
                const tagDefinition = this.app.getTagDefinition(tag.name);
                const tagComponent = new Tag(tagDefinition, tag.value, tag.condition, (updatedTag) => {
                    this.updateTag(noteId, tag.name, updatedTag.getValue(), updatedTag.getCondition());
                });
                tagItem.addEventListener('tag-removed', () => {
                    this.removeTagFromNote(noteId, tag.name);
                });
                tagItem.appendChild(tagComponent);
                tagList.appendChild(tagItem);
            });
        });
    }

    async updateTag(noteId, tagName, newValue, newCondition) {
        try {
            const note = await this.app.db.get(noteId);
            if (note) {
                const tagIndex = note.tags.findIndex(tag => tag.name === tagName);
                if (tagIndex !== -1) {
                    note.tags[tagIndex].value = newValue;
                    note.tags[tagIndex].condition = newCondition;
                    await this.app.db.saveObject(note, false);
                    this.displayTags(noteId);
                } else {
                    console.error('Tag not found');
                }
            } else {
                console.error('Note not found');
            }
        } catch (error) {
            console.error('Error updating tag:', error);
        }
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
                this.edit.contentHandler.insertTagAtSelection(tagName);
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
