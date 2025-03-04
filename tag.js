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
        return ['value', 'condition'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'value' && this.value !== newValue) {
            this.value = newValue;
        }
        if (name === 'condition' && this.condition !== newValue) {
            this.condition = newValue;
        }
        this.render();
    }

    getValue() {
        return this.value;
    }

    getCondition() {
        return this.condition;
    }

    render() {
        this.shadow.innerHTML = `
            <style>
                .tag {
                    display: inline-flex;
                    align-items: center;
                    padding: 2px 8px;
                    border-radius: 4px;
                    background-color: #f0f0f0;
                    color: #333;
                    font-size: 0.85em;
                    margin: 2px;
                }

                .tag-name {
                    font-weight: bold;
                    margin-right: 4px;
                }

                .tag-value {
                    margin-left: 4px;
                }

                .remove-button {
                    background: none;
                    border: none;
                    color: #666;
                    cursor: pointer;
                    padding: 0;
                    margin-left: 4px;
                }

                .remove-button:hover {
                    color: #333;
                }
            </style>
            <div class="tag">
                <span class="tag-name">${this.tagDefinition.name}</span>
                <span class="tag-value">${this.value}</span>
                <button class="remove-button">❌</button>
            </div>
        `;

        const removeButton = this.shadow.querySelector('.remove-button');
        removeButton.addEventListener('click', this.remove.bind(this));
    }

    remove() {
        const event = new CustomEvent('tag-removed', {
            detail: { tag: this },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
    }
}

if (!customElements.get('data-tag')) {
    customElements.define('data-tag', Tag);
}
