import {createElement} from './utils';
import {TagInput} from './tag-input';

class Tag extends HTMLElement {
    constructor() {
        super();
        this.app = null;
        this.shadow = this.attachShadow({mode: 'open'});
    }

    static get observedAttributes() {
        return ['tag-definition', 'value', 'condition'];
    }

    connectedCallback() {
        this.tagDefinition = JSON.parse(this.getAttribute('tag-definition'));
        this.value = this.getAttribute('value') || '';
        this.condition = this.getAttribute('condition') || 'is';
        this.app = this.getApp();
        this.render();
    }

    getApp() {
        // Traverse up the DOM tree to find the app instance
        return document.querySelector('notes-view')?.app;
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'tag-definition') {
            this.tagDefinition = JSON.parse(newValue);
        }
        if (this.isConnected) {
            this.render();
        }
    }

    remove() {
        const event = new CustomEvent('tag-removed', {
            detail: {tag: this},
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }

    render() {
        this.shadow.innerHTML = `
            <style>
                .tag {
                    display: inline-flex;
                    align-items: center;
                    background-color: #f0f0f0;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    padding: 2px 4px;
                    margin: 2px;
                    font-size: 0.8em;
                    transition: background-color 0.2s ease-in-out;
                }

                .tag.conditional {
                    background-color: #e0e0e0;
                }

                .tag.invalid {
                    background-color: #ffdddd;
                }

                .tag > span {
                    margin-right: 4px;
                }

                .tag-condition {
                    font-style: italic;
                    margin-right: 4px;
                }

                .tag > button {
                    background-color: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 1em;
                    padding: 0;
                    margin: 0;
                }

                .tag > button:hover {
                    color: #007bff;
                }

                .tag:hover {
                    background-color: #ddd;
                }
            </style>
        `;
        const el = document.createElement('div');
        el.className = 'tag';
        el.dataset.tagName = this.tagDefinition.name;

        if (this.tagDefinition.conditions && this.tagDefinition.conditions.length) {
            el.classList.add('conditional');
        }

        const {ui, name} = this.tagDefinition;
        const icon = ui?.icon || '🏷️';
        const display = createElement('span', {}, `${icon} ${name}:`);
        el.appendChild(display);

        if (this.condition) {
            const conditionSpan = createElement('span', {className: 'tag-condition'}, this.condition);
            el.appendChild(conditionSpan);
        }

        const valueSpan = createElement('span', {className: 'tag-value'}, this.value || '');
        el.appendChild(valueSpan);

        this.editButton = createElement('button', {
            className: 'edit-tag-button',
            title: `Edit ${name} Value`
        }, 'Edit');
        this.editButton.addEventListener('click', () => {
            this.editTag();
        });
        el.appendChild(this.editButton);

        const removeButton = createElement('button', {
            className: 'remove-tag-button',
            title: `Remove ${name}`
        }, 'X');
        removeButton.addEventListener('click', () => {
            this.removeTag();
        });
        el.appendChild(removeButton);

        if (!this.tagDefinition.validate(this.value, this.condition)) {
            el.classList.add('invalid');
            el.title = 'Invalid tag value'; // Add tooltip
        }

        this.shadow.appendChild(el);
    }

    isValid() {
        return this.tagDefinition.validate(this.value, this.condition);
    }

    editTag() {
        this.shadow.innerHTML = '';
        const tagInput = new TagInput(this.tagDefinition, this.value, this.condition, (newValue, newCondition) => {
            this.value = newValue;
            this.condition = newCondition;
            this.render();
        });
        this.shadow.appendChild(tagInput);
    }

    getValue() {
        return this.value;
    }

    getCondition() {
        return this.condition;
    }

    async removeTag() {
        try {
            const tagName = this.tagDefinition.name;
            const noteDetails = this.closest('note-details');
            if (noteDetails) {
                const noteView = noteDetails.noteView;
                if (noteView && noteView.selectedNote) {
                    const note = noteView.selectedNote;
                    const tagIndex = note.tags.findIndex(tag => tag.name === tagName);
                    if (tagIndex !== -1) {
                        note.tags.splice(tagIndex, 1);
                        await noteView.app.db.saveObject(note, false);
                        noteDetails.renderTags();
                        noteView.displayTags(note.id);
                    } else {
                        console.error('Tag not found');
                    }
                } else {
                    console.error('NoteView or selectedNote not found');
                }
            } else {
                console.error('NoteDetails component not found');
            }
        } catch (error) {
            console.error('Error removing tag:', error);
        }
    }

    getTagDefinition() {
        return this.tagDefinition;
    }
}

if (!customElements.get('data-tag')) {
    customElements.define('data-tag', Tag);
}
