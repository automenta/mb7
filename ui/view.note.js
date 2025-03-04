import { Edit } from './edit/edit.js';
import { TagManager } from './tag-manager.js';
import * as Y from 'yjs';
import { NotesSidebar } from './note/note.sidebar.js';
import { GenericListComponent } from './generic-list.js';
import { NoteUI } from './note/note.ui.js';
import {NoteList} from "./note/note-list";
import {NoteDetails} from "./note-details";
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
        this.noteView.matchesView = this.noteUI.createMatchesView(); // Store matchesView in NoteView
        mainArea.appendChild(this.noteView.matchesView);
        this.noteView.originalNoteView = this.noteUI.createOriginalNoteView(); // Create originalNoteView
        mainArea.appendChild(this.noteView.originalNoteView); // Append originalNoteView
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
                this.updateSelectedNoteUI(noteId, note);
                this.setupYNoteMapObservation(noteId);
                this.subscribeToMatchEvents(noteId);

                // Check for 'e' tag and load original note if it exists
                const originalNoteId = note.tags.find(tag => tag[0] === 'e')?.[1];
                if (originalNoteId) {
                    await this.displayOriginalNote(originalNoteId);
                } else {
                    this.clearOriginalNote();
                }
            }
        } catch (error) {
            this.noteView.app.errorHandler.handleError(error, 'Error selecting note');
        }
    }

    updateSelectedNoteUI(noteId, note) {
        this.clearPreviousSelection();
        this.noteView.selectedNote = note;
        this.noteView.noteDetails.populateNoteDetails(note);
        if (this.noteView.editor && this.noteView.editor.contentHandler) {
            this.noteView.editor.contentHandler.deserialize(note.content);
        }
        this.noteView.tagDisplay.displayTags(this.noteView, noteId);
        this.highlightSelectedListItem(noteId);
    }

    clearPreviousSelection() {
        const previousSelected = this.noteView.el.querySelector('.note-list-item.selected');
        if (previousSelected) {
            previousSelected.classList.remove('selected');
        }
    }

    highlightSelectedListItem(noteId) {
        const listItem = this.noteView.el.querySelector(`.note-list-item[data-id="${noteId}"]`);
        if (listItem) {
            listItem.classList.add('selected');
        }
    }

    setupYNoteMapObservation(noteId) {
        const yNoteMap = this.noteView.noteYjsManager.getYNoteMap(noteId);
        const listItem = this.noteView.el.querySelector(`.note-list-item[data-id="${noteId}"]`);
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
            nameElement.textContent = yNoteMap.get("name") || this.noteView.selectedNote.name;
        }
    }

    subscribeToMatchEvents(noteId) {
        this.noteView.app.nostr.subscribeToMatches(noteId, (event) => {
            console.log(`Match received for note ${noteId}:`, event);
            this.displayMatch(event); // Display the match in the UI
            this.noteView.app.notificationManager.showNotification(`Match received: ${event.content}`, 'success');
        });
    }

    async displayOriginalNote(originalNoteId) {
        try {
            const originalNote = await this.noteView.app.db.get(originalNoteId);
            if (originalNote) {
                // Fetch the author's profile from Nostr
                const authorProfile = await this.getAuthorProfile(originalNote.pubkey);

                this.noteView.originalNoteView.innerHTML = `
                    <h3>Original Note:</h3>
                    <div style="border: 1px solid #ccc; padding: 5px; margin: 5px;">
                        <p><strong>Author:</strong> ${authorProfile?.name || originalNote.pubkey}</p>
                        <p><strong>Timestamp:</strong> ${new Date(originalNote.createdAt).toLocaleString()}</p>
                        <p><strong>Content:</strong> ${originalNote.content}</p>
                    </div>
                `;
            } else {
                this.noteView.originalNoteView.innerHTML = `
                    <h3>Original Note:</h3>
                    <p>Original note not found.</p>
                `;
            }
        } catch (error) {
            console.error('Error loading original note:', error);
            this.noteView.originalNoteView.innerHTML = `
                <h3>Original Note:</h3>
                <p>Error loading original note.</p>
            `;
        }
    }

    async getAuthorProfile(pubkey) {
        return new Promise((resolve) => {
            this.noteView.app.nostr.subscribeToPubkey(pubkey, (event) => {
                try {
                    const profile = JSON.parse(event.content);
                    resolve(profile);
                    // Unsubscribe after receiving the profile to avoid memory leaks
                    this.noteView.app.nostr.unsubscribeToPubkey(`friend-profile-${pubkey}`);
                } catch (error) {
                    console.error("Error parsing profile", error);
                    resolve({ name: pubkey }); // Fallback to pubkey if parsing fails
                }
            });
        });
    }

    clearOriginalNote() {
        this.noteView.originalNoteView.innerHTML = '';
    }

    displayMatch(event) {
        // Create a new element to display the match
        const matchElement = document.createElement('div');
        matchElement.style.border = '1px solid #ccc';
        matchElement.style.padding = '5px';
        matchElement.style.margin = '5px';

        // Display the author's name
        const authorElement = document.createElement('div');
        authorElement.textContent = `Author: ${event.pubkey}`; // Replace with actual name if available
        matchElement.appendChild(authorElement);

        // Display the timestamp
        const timestampElement = document.createElement('div');
        const date = new Date(event.created_at * 1000);
        timestampElement.textContent = `Timestamp: ${date.toLocaleString()}`;
        matchElement.appendChild(timestampElement);

        // Display the content
        const contentElement = document.createElement('div');
        contentElement.textContent = `Content: ${event.content}`;
        matchElement.appendChild(contentElement);

        // Add a "Reply" button
        const replyButton = document.createElement('button');
        replyButton.textContent = 'Reply';
        replyButton.addEventListener('click', () => this.replyToMatch(event));
        matchElement.appendChild(replyButton);

        // Append the match element to the matchesView container
        this.noteView.matchesView.appendChild(matchElement);
    }

    async replyToMatch(event) {
        // Create a new note with the content of the match and a reference to the original note
        const newNote = await this.noteView.app.noteManager.createNote(`Reply to ${this.noteView.selectedNote.name}`);
        newNote.content = event.content;
        newNote.tags.push(['e', this.noteView.selectedNote.id]); // Add a tag to reference the original note
        await this.noteView.app.db.saveObject(newNote);

        // Select the new note
        await this.selectNote(newNote.id);
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
