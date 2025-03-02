import {Edit} from './edit/edit.js';
import * as Y from 'yjs';

import { NotesToolbar } from './note/note.toolbar.js';
import { NotesSidebar } from './note/note.sidebar.js';
import { NoteDetails } from './note/note.details.js';

export class NoteView extends HTMLElement {
    constructor(app) {
        super();
        this.app = app;
        const sidebar = this.sidebar = new NotesSidebar(app);

        this.yDoc = new Y.Doc();
        this.notesListId = 'notesList';
        this.yMap = this.yDoc.getMap('notes');
        this.yName = this.yDoc.getText('name');

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

        this.edit = new Edit(this.yDoc);
        mainArea.appendChild(this.edit.el);
        this.selectedNote = null;

        this.loadNotes();

        // Observe Yjs changes
        this.yMap.observe(event => {
            console.log('Yjs observer triggered');
            this.loadNotes();
        });

        this.sidebar.elements.notesList.addEventListener('click', async (e) => {
            if (e.target.tagName === 'LI') {
                const noteId = e.target.dataset.id;
                const note = await this.app.db.get(noteId);
                if (note) {
                    this.edit.setContent(note.content);
                    this.edit.setName(note.name);
                    this.selectedNote = note;
                }
            }
        });
    }

    /** TODO dynamically refresh when the list or the item name changes */
    newNotesList() {
        const notesList = document.createElement('ul');
        notesList.className = 'notes-list';
        notesList.style.listStyleType = 'none';
        notesList.style.padding = '0';
        return notesList;
    }

    newAddButton() {
        const addButton = document.createElement('button');
        addButton.textContent = 'Add';
        addButton.addEventListener('click', () => {
            this.createNote({name: '', content: ''});
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
        systemMatch.textContent = '> System (2h): Match: \"UI/UX Best Practices\" [💡 UI/UX Best Practices]';
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

        // const titleCheckbox = document.createElement('input');
        // titleCheckbox.type = 'checkbox';
        // titleContainer.appendChild(titleCheckbox);

        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'My Current Note Title';
        titleInput.style.marginLeft = '5px';

        c.appendChild(titleInput);
        return c;
    }

    handleDeleteNote = async (note) => {
        await this.deleteNote(note);
    }

    async createNote(newNote) {
        try {
            const timestamp = Date.now();
            const newObject = await this.app.createNewObject(null, {...newNote, timestamp});
            if (newObject) {
                this.edit.setContent(newObject.content);
                this.edit.setName(newObject.name);
                this.selectedNote = newObject;
                await this.app.saveOrUpdateObject(newObject);
                await this.addNoteToList(newObject.id);
                this.showMessage('Saved');
            }
            await this.loadNotes();
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
        let notesList = this.yMap.get(this.notesListId) ?? [];
        notesList.push(noteId);
        this.yMap.set(this.notesListId, notesList);
    }

    async loadNotes(limit = 10) {
        let notesList = this.yMap.get(this.notesListId) ?? [];

        // Fetch notes from db and sort by timestamp
        const notes = [];
        for (const noteId of notesList) {
            const note = await this.app.db.get(noteId);
            if (note) {
                notes.push(note);
            }
        }

        
                notes.sort((a, b) => b.timestamp - a.timestamp);
        
                this.sidebar.elements.notesList.innerHTML = '';
                console.log('Notes to render:', notes);
                for (const note of notes.slice(0, limit)) {
                    const noteElement = this.renderNObject(note);
                    this.sidebar.elements.notesList.append(noteElement);
            // Update title input value
            const titleInput = document.querySelector('.note-title-container input[type="text"]');
            if (titleInput)
                titleInput.value = note.name;
        }

        // Display the content of the first note in the main area
        if (notesList.length > 0) {
            const firstNoteId = notesList[0];
            const firstNote = await this.app.db.get(firstNoteId);
            if (firstNote) {
                this.edit.setContent(firstNote.content);
                this.edit.setName(firstNote.name);
                this.selectedNote = firstNote;
            }
        }
    }

    render() {
        return this.el;
    }

    renderNObject(note) {
        const li = document.createElement('li');
        li.dataset.id = note.id;
        const nameElement = document.createElement('div');
        nameElement.textContent = note.name;
        nameElement.style.fontWeight = 'bold';
        li.appendChild(nameElement);
        return li;
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
}

if (!customElements.get('notes-view')) {
    customElements.define('notes-view', NoteView);
}