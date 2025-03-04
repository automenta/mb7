import { Edit } from './edit/edit.js';
import { TagManager } from './tag-manager.js';
import * as Y from 'yjs';

import { NotesSidebar } from './note/note.sidebar.js';
import { GenericListComponent } from './generic-list.js';
import { NoteUI } from './note/note.ui.js';
import { createElement } from '../utils.js';
import {NoteList} from "./note/note-list";
import {NoteDetails} from "./note/note-details";
import {TagDisplay} from "./note/tag-display";
import {NoteYjsHandler} from "./note/note-yjs-handler";
import {MyObjectsList} from "./note/my-objects-list";

export class NoteView extends HTMLElement {
    constructor(app, db, nostr) {
        super();
        this.app = app;
        this.db = db;
        this.nostr = nostr;

        this.yDoc = new Y.Doc();
        this.noteYjsHandler = new NoteYjsHandler(this.yDoc);

        this.el = document.createElement('div');
        this.el.className = 'notes-view';
        this.el.style.flexDirection = 'row';
        this.el.style.display = 'flex';

        this.noteUI = new NoteUI();
        this.sidebar = new NotesSidebar(app, this);
        this.noteDetails = new NoteDetails(this, app);
        this.tagDisplay = new TagDisplay(app);
        this.myObjectsList = new MyObjectsList(this, this.noteYjsHandler.yMyObjectsList);

        this.mainArea = this.noteUI.createMainArea();
        this.contentArea = this.noteUI.createContentArea();
        this.todoArea = this.noteUI.createTodoArea();
        this.tagArea = this.noteUI.createTagArea();

        this.el.appendChild(this.sidebar.render());

        this.mainArea.appendChild(this.noteUI.createTitleInput(this.handleTitleInputChange.bind(this)));
        this.mainArea.appendChild(this.noteUI.createPrivacyEdit());

        this.mainArea.appendChild(this.noteDetails);

        this.mainArea.appendChild(this.contentArea);
        this.mainArea.appendChild(this.todoArea);
        this.mainArea.appendChild(this.noteUI.createLinkedView());
        this.mainArea.appendChild(this.noteUI.createMatchesView());

        this.editor = new Edit(this.selectedNote, this.yDoc, this.app, null, null, null, this.app.getTagDefinition, this.schema);
        this.mainArea.appendChild(this.editor.el);

        this.tagManager = new TagManager(this.app, this.selectedNote);
        this.mainArea.appendChild(this.tagManager);

        this.mainArea.appendChild(this.myObjectsList.render());

        this.noteList = new NoteList(this.app, this, this.yDoc, this.noteYjsHandler.yNotesList, this.notesListComponent);
        this.notesListComponent = new GenericListComponent(this.noteList.renderNoteItem.bind(this.noteList), this.noteYjsHandler.yNotesList);
        this.sidebar.elements.notesList.replaceWith(this.notesListComponent.el);
        this.sidebar.el.insertBefore(this.newAddButton(), this.notesListComponent.el);

        this.el.appendChild(this.mainArea);

        this.selectedNote = null;
    }

    handleTitleInputChange(title) {
        this.noteYjsHandler.updateNoteTitle(title);
    }

    newAddButton() {
        const addButton = document.createElement('button');
        addButton.textContent = 'Add Note';
        addButton.addEventListener('click', async () => {
            await this.createNote();
        });
        return addButton;
    }

    focusTitleInput() {
        const titleInput = this.el.querySelector('.note-title-input');
        if (titleInput) {
            setTimeout(() => {
                titleInput.focus();
            }, 0);
        }
    }

    async createNote() {
        console.time('createNote');
        try {
            const newObject = await this.app.noteManager.createNote();
            console.timeEnd('createNote');
            if (newObject) {
                const yNoteMap = this.noteYjsHandler.getYNoteMap(newObject.id);
                if (!yNoteMap) {
                    this.yDoc.transact(() => {
                        const newYNoteMap = new Y.Map();
                        newYNoteMap.set('name', 'New Note');
                        newYNoteMap.set('content', '');
                        this.noteYjsHandler.yMap.set(newObject.id, newYNoteMap);
                    });
                }
                await this.noteList.addNoteToList(newObject.id);
                await this.notesListComponent.fetchDataAndRender();
                this.app.notificationManager.showNotification('Saved', 'success');
                await this.selectNote(newObject.id);
                this.editor.contentHandler.deserialize(newObject.content);
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
                this.noteDetails.populateNoteDetails(note);
                if (this.editor && this.editor.contentHandler) {
                    this.editor.contentHandler.deserialize(note.content);
                }
                await this.tagDisplay.displayTags(this, noteId);

                // Add 'selected' class to the clicked list item
                const listItem = this.el.querySelector(`.note-list-item[data-id="${noteId}"]`);
                if (listItem) {
                    listItem.classList.add('selected');
                }

                const yNoteMap = this.noteYjsHandler.getYNoteMap(noteId);
                const nameElement = listItem?.querySelector('.note-name');
                if (yNoteMap && nameElement) {
                    yNoteMap.observe((event) => {
                        if (event.changes.keys.has("name")) {
                            nameElement.textContent = yNoteMap.get("name");
                        }
                        if (event.changes.keys.has("content") && this.editor.contentHandler) {
                            this.editor.contentHandler.deserialize(yNoteMap.get("content"));
                        }
                    });
                    nameElement.textContent = yNoteMap.get("name") || note.name;
                }
            }
        } catch (error) {
            this.app.errorHandler.handleError(error, 'Error selecting note');
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
                titleInput.value = this.noteYjsHandler.yName.toString(); // Get name from Yjs
            }
        }
    }
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}
