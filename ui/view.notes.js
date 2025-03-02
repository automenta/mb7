import {Edit} from './edit/edit';
import * as Y from 'yjs';

export class NotesView extends HTMLElement {
    constructor(app) {
        super();
        this.app = app;

        this.yDoc = new Y.Doc();
        this.notesListId = 'notesList';
        this.yMap = this.yDoc.getMap('notes');
        this.yName = this.yDoc.getText('name');

        this.el = document.createElement('div');
        this.el.className = 'notes-view';
        this.el.style.flexDirection = 'row';
        this.el.style.display = 'flex';

        const toolbar = document.createElement('div');
        toolbar.className = 'notes-toolbar';
        toolbar.style.display = 'flex';
        toolbar.style.justifyContent = 'space-between';
        toolbar.style.alignItems = 'center';
        toolbar.style.padding = '10px';

        const title = document.createElement('span');
        title.textContent = 'Notes';
        toolbar.appendChild(title);

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '10px';
        toolbar.appendChild(actions);

        const searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        actions.appendChild(searchButton);

        const addNoteButton = document.createElement('button');
        addNoteButton.textContent = 'Add';
        addNoteButton.addEventListener('click', () => {
            this.createNote({name: '', content: ''});
        });
        actions.appendChild(addNoteButton);

        // const settingsButton = document.createElement('button');
        // settingsButton.textContent = 'Settings';
        // actions.appendChild(settingsButton);


        const sidebar = document.createElement('div');
        sidebar.style.width = '200px';
        sidebar.style.borderRight = '1px solid #ccc';
        sidebar.style.padding = '10px';
        sidebar.style.minWidth = '200px';

        const notesList = this.newNotesList();

        this.elements = {
            notesList: notesList
        };

        sidebar.appendChild(toolbar);
        sidebar.appendChild(notesList);

        const mainArea = document.createElement('div');
        mainArea.style.flex = '1';
        mainArea.style.flexGrow = '1';
        mainArea.style.padding = '10px';

        this.el.appendChild(sidebar);

        mainArea.appendChild(this.newTitleEdit());

        // Details
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'note-details-container';
        detailsContainer.style.padding = '10px';
        mainArea.appendChild(detailsContainer);

        detailsContainer.appendChild(this.newPriEdit());
        detailsContainer.appendChild(this.newPrivacyEdit());
        detailsContainer.appendChild(this.newShareEdit());

        // const editDetailsButton = document.createElement('button');
        // editDetailsButton.textContent = '[Edit Details ✏️]';
        // editDetailsButton.style.marginLeft = '10px';
        // detailsContainer.appendChild(editDetailsButton);

        // Content area
        const contentArea = document.createElement('div');
        contentArea.className = 'note-content-area';
        contentArea.style.padding = '10px';
        mainArea.appendChild(contentArea);

        // Tags
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'note-tags-container';
        tagsContainer.style.padding = '10px';
        mainArea.appendChild(tagsContainer);

        const ideaTag = document.createElement('span');
        ideaTag.textContent = '🏷️ Idea, Development';
        tagsContainer.appendChild(ideaTag);

        const addTagButton = document.createElement('button');
        addTagButton.textContent = '[+ Tag]';
        addTagButton.style.marginLeft = '10px';
        tagsContainer.appendChild(addTagButton);

        // // Attachments
        // const attachmentsContainer = document.createElement('div');
        // attachmentsContainer.className = 'note-attachments-container';
        // attachmentsContainer.style.padding = '10px';
        // mainArea.appendChild(attachmentsContainer);
        //
        // const fileAttachment = document.createElement('span');
        // fileAttachment.textContent = '📎 file1.pdf, image.png';
        // attachmentsContainer.appendChild(fileAttachment);
        //
        // const addAttachmentButton = document.createElement('button');
        // addAttachmentButton.textContent = '[+ Attach]';
        // addAttachmentButton.style.marginLeft = '10px';
        // attachmentsContainer.appendChild(addAttachmentButton);

        mainArea.appendChild(this.newLinkedView());
        mainArea.appendChild(this.newMatchesView());

        this.el.appendChild(mainArea);

        this.edit = new Edit(this.yDoc);
        mainArea.appendChild(this.edit.el);
        this.selectedNote = null;

        this.loadNotes();

        // Observe Yjs changes
        this.yMap.observe(event => {
            this.loadNotes();
        });

        notesList.addEventListener('click', async (e) => {
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
            const newObject = await this.app.createNewObject(null, newNote);
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

    async loadNotes() {
        let notesList = this.yMap.get(this.notesListId) ?? [];

        this.elements.notesList.innerHTML = '';
        for (const noteId of notesList) {
            const note = await this.app.db.get(noteId);
            if (note) {
                const noteElement = this.renderNObject(note);
                this.elements.notesList.append(noteElement);

                // Update title input value
                const titleInput = document.querySelector('.note-title-container input[type="text"]');
                if (titleInput)
                    titleInput.value = note.name;
            }
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

customElements.define('notes-view', NotesView);