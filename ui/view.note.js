import {Edit} from './edit/edit.js';
import * as Y from 'yjs';

import { NotesSidebar } from './note/note.sidebar.js';
import { NoteDetails } from './note/note.details.js';

import { GenericListComponent } from './generic-list.js';
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

        mainArea.appendChild(this.createTitleEdit());

        // Details
        mainArea.appendChild(noteDetails.render());

        // Content area
        const contentArea = document.createElement('div');
        contentArea.className = 'note-content-area';
        contentArea.style.padding = '10px';
        mainArea.appendChild(contentArea);

        mainArea.appendChild(this.createLinkedView());
        mainArea.appendChild(this.createMatchesView());

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
                this.notesListComponent.fetchDataAndRender(); // Re-render the list
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
    newNotesList() {
        // Removed - using GenericListComponent
    }

    newAddButton() {
        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        addButton.addEventListener('click', async () => {
            await this.createNote();
        });
        return addButton;
    }

    newLinkedView() {
        const linkedNObjectsContainer = document.createElement('div');
        linkedNObjectsContainer.className = 'note-linked-nobjects-container';
        linkedNObjectsContainer.style.padding = '10px';

        const linkedNObject = document.createElement('span');
        linkedNObject.textContent = '🔗 Idea: UI Design';
        linkedNObjectsContainer.appendChild(linkedNObject);

        const addLinkedNObjectButton = document.createElement('button');
        addLinkedNObjectButton.textContent = '[+ Link]';
        addLinkedNObjectButton.style.marginLeft = '10px';
        linkedNObjectsContainer.appendChild(addLinkedNObjectButton);
        return linkedNObjectsContainer;
    }

    newMatchesView() {
        const matchesRepliesContainer = document.createElement('div');
        matchesRepliesContainer.className = 'note-matches-replies-container';
        matchesRepliesContainer.style.padding = '10px';

        const matchesRepliesHeader = document.createElement('div');
        matchesRepliesHeader.textContent = '💬 Matches & Replies (3) 🔽';
        matchesRepliesContainer.appendChild(matchesRepliesHeader);

        const aliceReply = document.createElement('div');
        aliceReply.textContent = '> Alice (10m): I like the direction...';
        matchesRepliesContainer.appendChild(aliceReply);

        const bobReply = document.createElement('div');
        bobReply.textContent = '> Bob (30m): +1 on minimalist... [🔗 Design Resources]';
        matchesRepliesContainer.appendChild(bobReply);

        const systemMatch = document.createElement('div');
        systemMatch.textContent = '> System (2h): Match: "UI/UX Best Practices" [💡 UI/UX Best Practices]';
        matchesRepliesContainer.appendChild(systemMatch);

        const showAllLink = document.createElement('a');
        showAllLink.textContent = '[ Show all ]';
        matchesRepliesContainer.appendChild(showAllLink);
        return matchesRepliesContainer;
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

    newTitleEdit() {
        const c = document.createElement('div');
        c.className = 'note-title-container';
        c.style.padding = '10px';

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'My Current Note Title';
        titleInput.style.marginLeft = '5px';

        // Bind input to Yjs
        titleInput.addEventListener('input', (e) => {
            console.log('Title input changed:', e.target.value);
            this.yDoc.transact(() => {
                this.yName.delete(0, this.yName.length);
                this.yName.insert(0, e.target.value);
                console.log('Yjs name updated to:', this.yName.toString());
            });
        });

        // Observe Yjs changes
        this.yName.observe(event => {
            console.log('Yjs name changed:', this.yName.toString());
            titleInput.value = this.yName.toString();
        });

        c.appendChild(titleInput);
        return c;
    }

    handleDeleteNote = async (note) => {
        await this.deleteNote(note);
    }

    async createNote() {
        console.log("createNote - start");
        try {
            const timestamp = Date.now();
            const newObject = await this.app.createNewObject({name: '', content: '', timestamp});
            if (newObject) {
                this.selectedNote = newObject;
                await this.addNoteToList(newObject.id);
                console.log("createNote - newObject.id after addNoteToList:", newObject.id);
                this.notesListComponent.fetchDataAndRender();
                this.showMessage('Saved');
            } else {
                console.error('Error creating note: newObject is null');
            }
            console.log("createNote - end");
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
            console.log("noteId in addNoteToList:", noteId, typeof noteId);
            console.log("noteId type in addNoteToList before push:", typeof noteId);
            this.yNotesList.push([noteId]);
            console.log("noteId type in addNoteToList after push:", typeof this.yNotesList.get(this.yNotesList.length - 1)[0]);
        });
    }

    render() {
        return this.el;
    }

    renderNoteItem(noteIdArray) { // Renamed from renderNObject to renderNoteItem, used by GenericListComponent, now receives noteId
        console.log("renderNoteItem - noteIdArray:", noteIdArray);
    const noteId = noteIdArray[0];
        console.log("renderNoteItem - noteId:", noteId);
    const li = document.createElement('li');
        li.dataset.id = noteId;
        const nameElement = document.createElement('div');
        nameElement.style.fontWeight = 'bold';
        li.appendChild(nameElement);
        li.addEventListener('click', async () => {
            const note = await this.app.db.get(noteId);
            if (note) {
                this.selectedNote = note;
            }
        });

        console.log("renderNoteItem - before db.get:", noteId);
    this.app.db.get(noteId).then(note => {
            console.log("renderNoteItem - after db.get - then:", noteId);
    console.log("renderNoteItem - noteId:", noteId, typeof noteId);
            console.log("renderNoteItem - db.get result:", note);
            if (note) {
                 console.log("getYNoteMap returned:", yNoteMap, "for noteId:", noteId);
                const yNoteMap = this.getYNoteMap(noteId);
                if (yNoteMap) {
                    yNoteMap.observe((event) => {
                        if (event.changes.keys.has("name")) {
                            console.log("Yjs name observer triggered in renderNoteItem for noteId:", noteId);
                            nameElement.textContent = yNoteMap.get("name");
                             console.log("Yjs name observer triggered in renderNoteItem for noteId:", noteId, yNoteMap.get("name"));
                        }
                    });
                    console.log("Initial name in renderNoteItem:", note.name, "for noteId:", noteId);
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

    createTitleEdit() {
        const c = document.createElement('div');
        c.className = 'note-title-container';
        c.style.padding = '10px';

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'My Current Note Title';
        titleInput.style.marginLeft = '5px';

        c.appendChild(titleInput);
        return c;
    }

    createLinkedView() {
        const linkedNObjectsContainer = document.createElement('div');
        linkedNObjectsContainer.className = 'note-linked-nobjects-container';
        linkedNObjectsContainer.style.padding = '10px';

        const linkedNObject = document.createElement('span');
        linkedNObject.textContent = '🔗 Idea: UI Design';
        linkedNObjectsContainer.appendChild(linkedNObject);

        const addLinkedNObjectButton = document.createElement('button');
        addLinkedNObjectButton.textContent = '[+ Link]';
        addLinkedNObjectButton.style.marginLeft = '10px';
        linkedNObjectsContainer.appendChild(addLinkedNObjectButton);
        return linkedNObjectsContainer;
    }

    createMatchesView() {
        const matchesRepliesContainer = document.createElement('div');
        matchesRepliesContainer.className = 'note-matches-replies-container';
        matchesRepliesContainer.style.padding = '10px';

        const matchesRepliesHeader = document.createElement('div');
        matchesRepliesHeader.textContent = '💬 Matches & Replies (3) 🔽';
        matchesRepliesContainer.appendChild(matchesRepliesHeader);

        const aliceReply = document.createElement('div');
        aliceReply.textContent = '> Alice (10m): I like the direction...';
        matchesRepliesContainer.appendChild(aliceReply);

        const bobReply = document.createElement('div');
        bobReply.textContent = '> Bob (30m): +1 on minimalist... [🔗 Design Resources]';
        matchesRepliesContainer.appendChild(bobReply);

        const systemMatch = document.createElement('div');
        systemMatch.textContent = '> System (2h): Match: "UI/UX Best Practices" [💡 UI/UX Best Practices]';
        matchesRepliesContainer.appendChild(systemMatch);

        const showAllLink = document.createElement('a');
        showAllLink.textContent = '[ Show all ]';
        matchesRepliesContainer.appendChild(showAllLink);

        return matchesRepliesContainer;
    }
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}