class Tag extends HTMLElement {
    /**
     * @param {TagDefinition} tagDefinition
     * @param {string} value
     * @param {string} condition
     * @param {function} onRemove
     */
    constructor(tagDefinition, value, condition, onRemove) {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.tagDefinition = tagDefinition;
        this.value = value;
        this.condition = condition;
        this.onRemove = onRemove;
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
                font-size: 0.85em;
            }

            .tag-remove-button {
                margin-left: 4px;
                cursor: pointer;
            }
        </style>
            <span class="tag-name">${this.tagDefinition.name}</span>${this.condition}${this.value}
            <span class="tag-remove-button">❌</span>
        `;

        this.shadow.querySelector('.tag-remove-button').addEventListener('click', () => {
            if (this.onRemove) {
                this.onRemove();
            }
        });
    }

    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }
}

customElements.define('tag-element', Tag);
