import { Edit } from './edit/edit.js';
import { TagManager } from './tag-manager.js';
import * as Y from 'yjs';
import { NotesSidebar } from './note/note.sidebar.js';
import { GenericListComponent } from './generic-list.js';
import { NoteUI } from './note/note.ui.js';
import {NoteList} from "./note/note-list";
import {NoteDetails} from "./note/note-details";
import {TagDisplay} from "./note/tag-display";
import {NoteYjsHandler} from "./note/note-yjs-handler";
import {MyObjectsList} from "./note/my-objects-list";

class NoteViewRenderer {
    constructor(noteView, noteUI) {
        this.noteView = noteView;
        this.noteUI = noteUI;
    }

    renderMainArea() {
        const mainArea = this.noteUI.createMainArea();
        mainArea.appendChild(this.noteUI.createTitleInput(this.noteView.handleTitleInputChange.bind(this.noteView)));
        mainArea.appendChild(this.noteUI.createPrivacyEdit());
        mainArea.appendChild(this.noteView.noteDetails);
        mainArea.appendChild(this.noteView.contentArea);
        mainArea.appendChild(this.noteView.todoArea);
        mainArea.appendChild(this.noteUI.createLinkedView());
        mainArea.appendChild(this.noteUI.createMatchesView());
        mainArea.appendChild(this.noteView.editor.el);
        mainArea.appendChild(this.noteView.tagManager);
        mainArea.appendChild(this.noteView.myObjectsList.render());
        return mainArea;
    }
}

class NoteViewEventHandler {
    constructor(noteView) {
        this.noteView = noteView;
    }

    async handleCreateNote() {
        try {
            const newObject = await this.noteView.app.noteManager.createNote();
            if (newObject) {
                const yNoteMap = this.noteView.noteYjsHandler.getYNoteMap(newObject.id);
                if (!yNoteMap) {
                    this.noteView.yDoc.transact(() => {
                        const newYNoteMap = new Y.Map();
                        newYNoteMap.set('name', 'New Note');
                        newYNoteMap.set('content', '');
                        this.noteView.noteYjsHandler.yMap.set(newObject.id, newYNoteMap);
                    });
                }
                await this.noteView.noteList.addNoteToList(newObject.id);
                await this.noteView.notesListComponent.fetchDataAndRender();
                this.noteView.app.notificationManager.showNotification('Saved', 'success');
                await this.noteView.selectNote(newObject.id);
                this.noteView.editor.contentHandler.deserialize(newObject.content);
                this.noteView.focusTitleInput();
            } else {
                console.error('Error creating note: newObject is null');
            }
        } catch (error) {
            console.error('Error creating note:', error);
        }
    }

    async handleSelectNote(noteId) {
        try {
            const note = await this.noteView.app.db.get(noteId);
            if (note) {
                const previousSelected = this.noteView.el.querySelector('.note-list-item.selected');
                if (previousSelected) {
                    previousSelected.classList.remove('selected');
                }

                this.noteView.selectedNote = note;
                this.noteView.noteDetails.populateNoteDetails(note);
                if (this.noteView.editor && this.noteView.editor.contentHandler) {
                    this.noteView.editor.contentHandler.deserialize(note.content);
                }
                await this.noteView.tagDisplay.displayTags(this.noteView, noteId);

                const listItem = this.noteView.el.querySelector(`.note-list-item[data-id="${noteId}"]`);
                if (listItem) {
                    listItem.classList.add('selected');
                }

                const yNoteMap = this.noteView.noteYjsHandler.getYNoteMap(noteId);
                const nameElement = listItem?.querySelector('.note-name');
                if (yNoteMap && nameElement) {
                    yNoteMap.observe((event) => {
                        if (event.changes.keys.has("name")) {
                            nameElement.textContent = yNoteMap.get("name");
                        }
                        if (event.changes.keys.has("content") && this.noteView.editor.contentHandler) {
                            this.noteView.editor.contentHandler.deserialize(yNoteMap.get("content"));
                        }
                    });
                    nameElement.textContent = yNoteMap.get("name") || note.name;
                }
            }
        } catch (error) {
            this.noteView.app.errorHandler.handleError(error, 'Error selecting note');
        }
    }
}

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

        this.contentArea = this.noteUI.createContentArea();
        this.todoArea = this.noteUI.createTodoArea();

        this.editor = new Edit(this.selectedNote, this.yDoc, this.app, null, null, null, this.app.getTagDefinition, this.schema);

        this.tagManager = new TagManager(this.app, this.selectedNote);

        this.noteList = new NoteList(this.app, this, this.yDoc, this.noteYjsHandler.yNotesList, null);
        this.notesListComponent = new GenericListComponent(this.noteList.renderNoteItem.bind(this.noteList), this.noteYjsHandler.yNotesList);
        this.sidebar.elements.notesList.replaceWith(this.notesListComponent.el);
        this.sidebar.el.insertBefore(this.newAddButton(), this.notesListComponent.el);

        this.noteViewRenderer = new NoteViewRenderer(this, this.noteUI);
        this.mainArea = this.noteViewRenderer.renderMainArea();
        this.el.appendChild(this.sidebar.render());
        this.el.appendChild(this.mainArea);

        this.noteViewEventHandler = new NoteViewEventHandler(this);

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
        await this.noteViewEventHandler.handleCreateNote();
    }

    async selectNote(noteId) {
        await this.noteViewEventHandler.handleSelectNote(noteId);
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
                titleInput.value = this.noteYjsHandler.yName.toString();
            }
        }
    }
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}
