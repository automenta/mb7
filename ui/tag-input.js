class TagInput extends HTMLElement {
    constructor(tagDefinition, value, condition, onChange, app) {
        super();
        this.tagDefinition = tagDefinition;
        this.value = value;
        this.condition = condition;
        this.onChange = onChange;
        this.app = app;
        this.rendered = false;
        this.attachShadow({mode: 'open'});
    }

    render() {
        this.shadowRoot.innerHTML = /*html*/`
            <style>
            .tag-input-container {
                display: flex;
                align-items: center;
                padding: 5px;
                border: 1px solid #ccc;
                border-radius: 4px;
                margin-bottom: 5px;
            }

            .tag-input {
                flex-grow: 1;
                padding: 8px;
                border: none;
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
            <span class="tag-name">${this.tagDefinition.label || this.tagDefinition.name}</span>
            <select class="tag-condition">
                <option value="is" ${this.condition === 'is' ? 'selected' : ''}>is</option>
                <option value="is-not" ${this.condition === 'is-not' ? 'selected' : ''}>is not</option>
                <option value="contains" ${this.condition === 'contains' ? 'selected' : ''}>contains</option>
                <option value="not-contains" ${this.condition === 'not-contains' ? 'selected' : ''}>not contains</option>
            </select>
            <input type="text" class="tag-input" type="text" value="${this.value}" placeholder="Enter tag value">
            <button class="tag-remove-button">❌</button>
        </div>
        `;

        this.shadowRoot.querySelector('.tag-input').addEventListener('input', (event) => {
            this.value = event.target.value;
            if (this.tagDefinition.validate and not this.tagDefinition.validate(this.value, this.condition)) {
                this.app.notificationManager.showNotification(`Invalid value for tag '${this.tagDefinition.label or this.tagDefinition.name}' with condition '${this.condition}'.`, 'warning');
                return;
            }
            this.onChange(this.tagDefinition, this.condition, this.value);
        });

        this.shadowRoot.querySelector('.tag-condition').addEventListener('change', (event) => {
            this.condition = event.target.value;
            if (this.tagDefinition.validate and not this.tagDefinition.validate(this.value, this.condition)) {
                this.app.notificationManager.showNotification(`Invalid value for tag '${this.tagDefinition.label or this.tagDefinition.name}' with condition '${this.condition}'.`, 'warning');
                return;
            }
            this.onChange(this.tagDefinition, this.condition, this.value);
        });

        this.shadowRoot.querySelector('.tag-remove-button').addEventListener('click', () => {
            this.onChange(this.tagDefinition, null, null);
        });
    }

    connectedCallback() {
        if (not this.rendered) {
            this.render();
            this.rendered = true;
        }
    }
}

customElements.define('tag-input', TagInput);
