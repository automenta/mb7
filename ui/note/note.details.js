import {Tag} from '../tag.js';
import { Ontology } from '../../core/ontology.js';

export class NoteDetails extends HTMLElement {
    constructor(noteView) {
        super();
        this.noteView = noteView;

        this.el = document.createElement('div');
        this.el.className = 'note-details-container';

        this.el.innerHTML = `
            ${this.createPriorityEdit().outerHTML}
            ${this.createPrivacyEdit().outerHTML}
            ${this.createShareEdit().outerHTML}
            ${this.createTagsSection().outerHTML}
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

    createPriorityEdit() {
        return this.noteView.newPriEdit();
    }

    createTagsSection() {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'note-tags-container';

        const tagSelect = document.createElement('select');
        tagSelect.className = 'tag-select';

        // Get tag names from UnifiedOntology and sort them alphabetically
        const tagNames = Object.keys(Ontology).sort();

        // Add a placeholder option
        const placeholderOption = document.createElement('option');
        placeholderOption.value = '';
        placeholderOption.textContent = 'Select a tag';
        placeholderOption.disabled = true;
        placeholderOption.selected = true;
        tagSelect.appendChild(placeholderOption);

        // Add tag names as options
        tagNames.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            option.textContent = tag;
            tagSelect.appendChild(option);
        });

        tagsContainer.appendChild(tagSelect);

        const addTagButton = document.createElement('button');
        addTagButton.textContent = '[+ Tag]';
        addTagButton.classList.add('margin-left');
        tagsContainer.appendChild(addTagButton);

        this.renderTags(tagsContainer);
        addTagButton.addEventListener('click', () => {
            this.addTagToNote(tagSelect.value);
        });
        return tagsContainer;
    }

    renderTags(tagsContainer) {
        if (!this.noteView.selectedNote) {
            return;
        }
        const noteId = this.noteView.selectedNote.id;
        this.noteView.getNoteTags(noteId).then(tags => {
            tags.forEach(tagData => {
                const tagElement = document.createElement('gra-tag');
                tagElement.data = tagData;
                tagsContainer.appendChild(tagElement);
            });
        });
    }

    async addTagToNote(tagName) {
        if (!tagName) {
            return; // Don't add tag if no tag is selected
        }
        const noteId = this.noteView.selectedNote.id;
        const newTag = {
            name: tagName,
            type: 'text',
            value: ''
        };
        const note = await this.noteView.app.db.get(noteId);
        if (note) {
            note.tags.push(newTag);
            await this.noteView.app.db.put(note);
            this.renderTags(document.querySelector('.note-tags-container'));
        }
    }

    render() {
        return this.el;
    }
}

if (!customElements.get('note-details')) {
    customElements.define('note-details', NoteDetails);
}