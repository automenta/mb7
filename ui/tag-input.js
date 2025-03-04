/**
 * @typedef TagDefinition
 * @property {string} name
 */

 class TagInput extends HTMLElement {
    /**
     * @param {TagDefinition} tagDefinition
     * @param {string} value
     * @param {string} condition
     * @param {function} onChange
     */
    constructor(tagDefinition, value, condition, onChange) {
        super();
        this.tagDefinition = tagDefinition;
        this.value = value;
        this.condition = condition;
        this.onChange = onChange;
    }

    render() {
        this.innerHTML = /*html*/`
            <style>

            .tag-input-container {
                display: flex;
                align-items: center;
            }

            .tag-input {
                flex-grow: 1;
                padding: 8px;
                border: 1px solid #ccc;
                border-radius: 4px;
                margin-right: 5px;
            }

            .tag-condition {
                padding: 8px;
            }

            .tag-remove-button {
                background-color: #f44336;
                color: white;
                border: none;
                padding: 8px 12px;
                border-radius: 4px;
                margin-left: 5px;
                cursor: pointer;
            }
            </style>

        <div class="tag-input-container">
            <span class="tag-name">${this.tagDefinition.name}</span>
            <select class="tag-condition">
                <option value="is" ${this.condition === 'is' ? 'selected' : ''}>is</option>
                <option value="is-not" ${this.condition === 'is-not' ? 'selected' : ''}>is not</option>
                <option value="contains" ${this.condition === 'contains' ? 'selected' : ''}>contains</option>
                <option value="not-contains" ${this.condition === 'not-contains' ? 'selected' : ''}>not contains</option>
            </select>
            <input type="text" class="tag-input" value="${this.value}" placeholder="Enter tag value">
            <button class="tag-remove-button">❌</button>
        </div>
        `;

        this.querySelector('.tag-input').addEventListener('input', (event) => {
            this.value = event.target.value;
            this.onChange(this.tagDefinition, this.condition, this.value);
        });

        this.querySelector('.tag-condition').addEventListener('change', (event) => {
            this.condition = event.target.value;
            this.onChange(this.tagDefinition, this.condition, this.value);
        });

        this.querySelector('.tag-remove-button').addEventListener('click', () => {
            this.onChange(this.tagDefinition, null, null); // Indicate removal
        });
    }

    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }
}

customElements.define('tag-input', TagInput);
