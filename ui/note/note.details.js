import { Ontology } from '../../core/ontology.js';
import { createElement } from '../utils.js';

export class NoteDetails extends HTMLElement {
    constructor(noteView) {
        super();
        this.noteView = noteView;
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.shadow.addEventListener('tag-removed', this.handleTagRemoved.bind(this));
    }

    handleTagRemoved(event) {
        event.stopPropagation();
    }

    createDetailEdit(text, icon) {
        const label = createElement('span', { class: 'margin-left' }, `${icon} ${text}`);
        return label;
    }

    createShareEdit() {
        return this.createDetailEdit('No One', '👥');
    }

    createPrivacyEdit() {
        const privacyContainer = createElement('div', { class: 'privacy-container' });

        const label = createElement('label', { class: 'privacy-label' }, 'Private');
        privacyContainer.appendChild(label);

        this.privacyCheckbox = createElement('input', {
            class: 'privacy-checkbox',
            type: 'checkbox',
            checked: true // Default to private
        });
        privacyContainer.appendChild(this.privacyCheckbox);

        this.privacyCheckbox.addEventListener('change', () => {
            const noteId = this.noteView.selectedNote.id;
            const isPrivate = this.privacyCheckbox.checked;
            this.noteView.updateNotePrivacy(noteId, isPrivate);
        });

        return privacyContainer;
    }

    createPriorityEdit() {
        const priorityContainer = createElement('div', { class: 'priority-container' });

        const label = createElement('label', { class: 'priority-label' }, 'Priority:');
        priorityContainer.appendChild(label);

        const prioritySelect = createElement('select', { class: 'priority-select' });
        ['High', 'Medium', 'Low'].forEach(option => {
            const optionElement = createElement('option', { value: option }, option);
            prioritySelect.appendChild(optionElement);
        });

        priorityContainer.appendChild(prioritySelect);

        return priorityContainer;
    }

    createTagsSection() {
        const tagsContainer = createElement('div', { class: 'note-tags-container' });
        return tagsContainer;
    }

    async createTag(tagName, tagValue = '', tagCondition = 'is') {
        this.noteView.addTagToNote(tagName, tagValue, tagCondition);
    }

    render() {
        this.shadow.innerHTML = `
            <style>
                .note-details-container {
                    padding: 10px;
                }
                .privacy-container {
                    display: flex;
                    align-items: center;
                    margin-bottom: 5px;
                }
                .privacy-label {
                    margin-right: 5px;
                }
                .priority-container {
                    display: flex;
                    align-items: center;
                    margin-bottom: 5px;
                }
                .priority-label {
                    margin-right: 5px;
                }
                .note-tags-container {
                    margin-top: 10px;
                    padding: 5px;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                }
            </style>
            <div class="note-details-container">
                <div class="priority-edit-container">${this.createPriorityEdit().outerHTML}</div>
                ${this.createPrivacyEdit().outerHTML}
                <div class="note-tags-container"></div>
            </div>
        `;
        this.renderTags();
    }

    async renderTags() {
        const tagsContainer = this.shadow.querySelector('.note-tags-container');
        tagsContainer.innerHTML = ''; // Clear existing tags

        if (this.noteView.selectedNote && this.noteView.selectedNote.tags) {
            this.noteView.selectedNote.tags.forEach(tag => {
                const tagElement = document.createElement('data-tag');
                tagElement.setAttribute('tag-definition', JSON.stringify(tag));
                tagElement.setAttribute('value', tag.value || '');
                tagElement.setAttribute('condition', tag.condition || 'is');
                tagsContainer.appendChild(tagElement);
            });
        }
    }
}

if (!customElements.get('note-details')) {
    customElements.define('note-details', NoteDetails);
}
