import { createElement } from './utils';
import { TagInput } from './tag-input';

class Tag extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
        this.tagDefinition = JSON.parse(this.getAttribute('tag-definition'));
        this.value = this.getAttribute('value') || '';
        this.condition = this.getAttribute('condition') || 'is';
        this.render();
    }

    static get observedAttributes() {
        return ['tag-definition', 'value', 'condition'];
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
            detail: { tag: this },
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
            </style>
        `;
        this.el = document.createElement('div');
        this.el.className = 'tag';
        this.el.dataset.tagName = this.tagDefinition.name;

        if (this.tagDefinition.conditions && this.tagDefinition.conditions.length) {
            this.el.classList.add('conditional');
        }

        const icon = this.tagDefinition.ui?.icon || '🏷️';
        const display = createElement('span', {}, `${icon} ${this.tagDefinition.name}: ${this.value} `);
        this.el.appendChild(display);

        this.editButton = createElement('button', { className: 'edit-tag-button' }, 'Edit');
        this.editButton.addEventListener('click', () => {
            this.editTag();
        });
        this.el.appendChild(this.editButton);

        const removeButton = createElement('button', { className: 'remove-tag-button' }, 'X');
        removeButton.addEventListener('click', () => {
            this.remove();
        });
        this.el.appendChild(removeButton);

        if (!this.tagDefinition.validate(this.value, this.condition)) {
            this.el.classList.add('invalid');
            this.el.title = 'Invalid tag value'; // Add tooltip
        }

        this.shadow.appendChild(this.el);
    }

    isValid() {
        return this.tagDefinition.validate(this.value, this.condition);
    }

    editTag() {
        this.shadow.innerHTML = '';
        const tagInput = new TagInput(this.tagDefinition, this.value, (newValue) => {
            this.value = newValue;
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

    getTagDefinition() {
        return this.tagDefinition;
    }
}

if (!customElements.get('data-tag')) {
    customElements.define('data-tag', Tag);
}

export { Tag };
