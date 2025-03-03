import {Ontology} from '../../core/ontology.js';

export class NoteDetails extends HTMLElement {
    constructor(noteView) {
        super();
        this.noteView = noteView;

        this.el = document.createElement('div');
        this.el.className = 'note-details-container';

        this.el.addEventListener('tag-removed', this.handleTagRemoved.bind(this));
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
        if (!this.privacyContainer) {
            this.privacyContainer = document.createElement('div');
            this.privacyContainer.className = 'privacy-container';

            const label = document.createElement('label');
            label.textContent = 'Private ';
            this.privacyContainer.appendChild(label);

            this.privacyCheckbox = document.createElement('input');
            this.privacyCheckbox.type = 'checkbox';
            this.privacyCheckbox.checked = true; // Default to private
            label.appendChild(this.privacyCheckbox);

            this.privacyCheckbox.addEventListener('change', () => {
                const noteId = this.noteView.selectedNote.id;
                const isPrivate = this.privacyCheckbox.checked;
                this.noteView.updateNotePrivacy(noteId, isPrivate);
            });

            this.privacyContainer.appendChild(label);
        }
        return this.privacyContainer;
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

    async createTag(tagName, tagValue = '', tagCondition = 'is') {
        this.noteView.addTagToNote(tagName, tagValue, tagCondition);
    }

    render() {
        this.el.innerHTML = `
            ${this.createPriorityEdit().outerHTML}
            ${this.createPrivacyEdit().outerHTML}
            <div class="tag-input-container">
                <input type="text" class="new-tag-input" placeholder="Add a tag"/>
                <button class="add-tag-button">Add Tag</button>
            </div>
            <ul class="note-tag-list"></ul>
        `;

        const addTagButton = this.el.querySelector('.add-tag-button');
        const newTagInput = this.el.querySelector('.new-tag-input');

        addTagButton.addEventListener('click', () => {
            const tagName = newTagInput.value.trim();
            if (tagName) {
                this.createTag(tagName);
                newTagInput.value = '';
            }
        });

        return this.el;
    }
}

if (!customElements.get('note-details')) {
    customElements.define('note-details', NoteDetails);
}
