import { Edit } from './edit/edit.js';
import { TagManager } from './tag-manager.js';
import * as Y from 'yjs';
import { NotesSidebar } from './note/note.sidebar.js';
import { GenericListComponent } from './generic-list.js';
import { NoteUI } from './note/note.ui.js';
import {NoteList} from "./note/note-list";
import {NoteDetails} from "./note/note-details";
import {TagDisplay} from "./tag-display";
import {MyObjectsList} from "./my-objects-list";
import { createElement } from '../utils.js';
import { YjsHelper } from '../../core/yjs-helper';

class NoteViewRenderer {
    constructor(noteView, noteUI) {
        this.noteView = noteView;
        this.noteUI = noteUI;
    }

    renderMainArea() {
        const mainArea = this.noteUI.createMainArea();
        mainArea.appendChild(this.noteUI.createTitleInput(this.noteView.handleTitleInputChange.bind(this.noteView)));
        mainArea.appendChild(this.noteUI.createPrivacyEdit());
        mainArea.appendChild(this.noteView.noteDetails.el);
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

class NoteYjsManager {
    constructor(yDoc) {
        this.yDoc = yDoc;
        this.yMap = this.yDoc.getMap('notes');
        this.yName = this.yDoc.getText('name');
        this.yNotesList = this.yDoc.getArray('notesList');
        this.yMyObjectsList = this.yDoc.getArray('myObjectsList');
    }

    getYNoteMap(noteId) {
        return this.yMap.get(noteId);
    }

    updateNoteTitle(title) {
        this.yDoc.transact(() => {
            this.yName.delete(0, this.yName.length);
            this.yName.insert(0, title);
        });
    }
}

class NoteSelector {
    constructor(noteView) {
        this.noteView = noteView;
    }

    async selectNote(noteId) {
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

                const yNoteMap = this.noteView.noteYjsManager.getYNoteMap(noteId);
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

                // Subscribe to match events for the selected note
                this.noteView.app.nostr.subscribeToMatches(noteId, (event) => {
                    console.log(`Match received for note ${noteId}:`, event);
                    this.noteView.app.notificationManager.showNotification(`Match received: ${event.content}`, 'success');
                });
            }
        } catch (error) {
            this.noteView.app.errorHandler.handleError(error, 'Error selecting note');
        }
    }
}

class NoteCreator {
    constructor(noteView) {
        this.noteView = noteView;
    }

    async createNote() {
        try {
            const newObject = await this.noteView.app.noteManager.createNote();
            if (newObject) {
                const yNoteMap = this.noteView.noteYjsManager.getYNoteMap(newObject.id);
                if (!yNoteMap) {
                    this.noteView.yDoc.transact(() => {
                        const newYNoteMap = new Y.Map();
                        newYNoteMap.set('name', 'New Note');
                        newYNoteMap.set('content', '');
                        this.noteView.noteYjsManager.yMap.set(newObject.id, newYNoteMap);
                    });
                }
                await this.noteView.noteList.addNoteToList(newObject.id);
                await this.noteView.notesListComponent.fetchDataAndRender();
                this.noteView.app.notificationManager.showNotification('Saved', 'success');
                await this.noteView.noteSelector.selectNote(newObject.id);
                this.noteView.editor.contentHandler.deserialize(newObject.content);
                this.noteView.focusTitleInput();
            } else {
                console.error('Error creating note: newObject is null');
            }
        } catch (error) {
            console.error('Error creating note:', error);
        }
    }
}

class NoteViewElements {
    constructor() {
        this.el = document.createElement('div');
        this.el.className = 'notes-view';
        this.el.style.flexDirection = 'row';
        this.el.style.display = 'flex';
    }

    createElement(type, options = {}, text = '') {
        const element = document.createElement(type);
        Object.assign(element, options);
        if (text) {
            element.textContent = text;
        }
        return element;
    }
}

export class NoteView extends HTMLElement {
    constructor(app, db, nostr) {
        super();
        this.app = app;
        this.db = db;
        this.nostr = nostr;

        this.yDoc = new Y.Doc();
        this.noteYjsManager = new NoteYjsManager(this.yDoc);

        YjsHelper.setSyncLatencyHook(this.yDoc, this.app.monitoring.addSyncLatency.bind(this.app.monitoring)); // Set sync latency hook

        this.elements = new NoteViewElements();
        this.el = this.elements.el;

        this.noteUI = new NoteUI();
        this.sidebar = new NotesSidebar(app, this);
        this.noteDetails = new NoteDetails(this, app);
        this.tagDisplay = new TagDisplay(app);
        this.myObjectsList = new MyObjectsList(this, this.noteYjsManager.yMyObjectsList);

        this.contentArea = this.noteUI.createContentArea();
        this.todoArea = this.noteUI.createTodoArea();

        this.editor = new Edit(this.selectedNote, this.yDoc, this.app);

        this.tagManager = new TagManager(this.app, this.selectedNote);

        this.noteList = new NoteList(this.app, this, this.yDoc, this.noteYjsManager.yNotesList);
        this.notesListComponent = new GenericListComponent(this.noteList.renderNoteItem.bind(this.noteList), this.noteYjsManager.yNotesList);
        this.sidebar.elements.notesList.replaceWith(this.notesListComponent.el);
        this.sidebar.el.insertBefore(this.newAddButton(), this.notesListComponent.el);

        this.noteViewRenderer = new NoteViewRenderer(this, this.noteUI);
        this.mainArea = this.noteViewRenderer.renderMainArea();
        this.el.appendChild(this.sidebar.render());
        this.el.appendChild(this.mainArea);

        this.noteSelector = new NoteSelector(this);
        this.noteCreator = new NoteCreator(this);

        this.selectedNote = null;
    }

    handleTitleInputChange(title) {
        this.noteYjsManager.updateNoteTitle(title);
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
        await this.noteCreator.createNote();
    }

    async selectNote(noteId) {
        await this.noteSelector.selectNote(noteId);
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
                titleInput.value = this.noteYjsManager.yName.toString();
            }
        }
    }
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}
