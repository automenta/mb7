import {Ontology} from '../../core/ontology.js';

export class NoteDetails extends HTMLElement {
    constructor(noteView) {
        super();
        this.noteView = noteView;

        this.el = document.createElement('div');
        this.el.className = 'note-details-container';

        this.el.addEventListener('tag-removed', this.handleTagRemoved.bind(this));
    }

    handleTagRemoved(event) {
        event.stopPropagation();
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
        const privacyContainer = document.createElement('div');
        privacyContainer.className = 'privacy-container';

        const label = document.createElement('label');
        label.className = 'privacy-label';
        label.textContent = 'Private';
        privacyContainer.appendChild(label);

        this.privacyCheckbox = document.createElement('input');
        this.privacyCheckbox.className = 'privacy-checkbox';
        this.privacyCheckbox.type = 'checkbox';
        this.privacyCheckbox.checked = true; // Default to private
        privacyContainer.appendChild(this.privacyCheckbox);

        this.privacyCheckbox.addEventListener('change', () => {
            const noteId = this.noteView.selectedNote.id;
            const isPrivate = this.privacyCheckbox.checked;
            this.noteView.updateNotePrivacy(noteId, isPrivate);
        });

        return privacyContainer;
    }

    createPriorityEdit() {
        const priorityContainer = document.createElement('div');
        priorityContainer.className = 'priority-container';

        const label = document.createElement('label');
        label.className = 'priority-label';
        label.textContent = 'Priority:';
        priorityContainer.appendChild(label);

        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'priority-select';
        ['High', 'Medium', 'Low'].forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option;
            prioritySelect.appendChild(optionElement);
        });

        priorityContainer.appendChild(prioritySelect);

        return priorityContainer;
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
            <div class="priority-edit-container">${this.createPriorityEdit().outerHTML}</div>
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
