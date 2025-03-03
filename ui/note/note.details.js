import {Ontology} from '../../core/ontology.js';

export class NoteDetails extends HTMLElement {
    constructor(noteView) {
        super();
        this.noteView = noteView;

        this.el = document.createElement('div');
        this.el.className = 'note-details-container';

        this.el.addEventListener('tag-removed', this.handleTagRemoved.bind(this));

        this.el.innerHTML = `
            ${this.createPriorityEdit().outerHTML}
            ${this.createPrivacyEdit().outerHTML}
            ${this.createShareEdit().outerHTML}
            ${this.createTagsSection().outerHTML}
            <ul class="note-tag-list"></ul>
        `;
    }

    createDetailEdit(text, icon) {
        const label = document.createElement('span');
        label.textContent = `${icon} ${text}`;
        label.classList.add('margin-left');
        return label;
    }

    createShareEdit() {
        return this.createDetailEdit('No One', '👥');
    }

    createPrivacyEdit() {
        const container = document.createElement('div');
        container.className = 'privacy-container';

        const label = document.createElement('label');
        label.textContent = 'Private ';
        container.appendChild(label);

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = true; // Default to private
        label.appendChild(toggle);

        toggle.addEventListener('change', () => {
            const noteId = this.noteView.selectedNote.id;
            const isPrivate = toggle.checked;
            this.noteView.updateNotePrivacy(noteId, isPrivate);
        });

        container.appendChild(label);
        return container;
    }

    async handleTagRemoved(event) {
        const tagToRemove = event.detail.tag;
        const noteId = this.noteView.selectedNote.id;

        const note = await this.noteView.app.db.get(noteId);
        if (note) {
            // Find the index of the tag to remove
            const tagIndex = note.tags.findIndex(tag =>
                tag.name === tagToRemove.tagDefinition.name &&
                tag.value === tagToRemove.value &&
                tag.condition === tagToRemove.condition
            );

            if (tagIndex > -1) {
                note.tags.splice(tagIndex, 1); // Remove the tag from the array
                await this.noteView.app.db.save(note, false); // Save the updated note
                this.noteView.displayTags(noteId); // Update tag display in NoteView
                this.noteView.showMessage('Tag removed');
            } else {
                console.warn('Tag not found in note:', tagToRemove);
            }
        } else {
            console.warn('Note not found:', noteId);
        }
    }

    createPriorityEdit() {
        return this.noteView.newPriEdit();
    }

    createTagsSection() {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'note-tags-container';
        return tagsContainer;
    }

    async createTag(tagName) {
        const noteId = this.noteView.selectedNote.id;
        const newTag = {
            name: tagName,
            type: 'text',
            value: ''
        };
        const note = await this.noteView.app.db.get(noteId);
        if (note) {
            // Check if the tag already exists
            const tagExists = note.tags.some(tag =>
                tag.name === newTag.name && tag.value === newTag.value && tag.condition === newTag.condition
            );

            if (!tagExists) {
                note.tags.push(newTag);
                await this.noteView.app.db.save(note, false);
                this.noteView.displayTags(noteId); // Update tag display in NoteView
                this.noteView.showMessage('Tag added');
            } else {
                this.noteView.showMessage('Tag already exists', 'warning');
            }
        }
    }

    render() {
        this.el.innerHTML = `
            ${this.createPriorityEdit().outerHTML}
            ${this.createPrivacyEdit().outerHTML}
            ${this.createShareEdit().outerHTML}
            <ul class="note-tag-list"></ul>
        `;
        return this.el;
    }
}

if (!customElements.get('note-details')) {
    customElements.define('note-details', NoteDetails);
}
