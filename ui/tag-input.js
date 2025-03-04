ui/tag-input.js
const tagInputTemplate = document.createElement('template');
tagInputTemplate.innerHTML = /*html*/`
    <style>
    .tag-input-container {
        display: flex;
        align-items: center;
        padding: 5px;
        border: 1px solid #ccc;
        border-radius: 4px;
        margin-bottom: 5px;
        flex-wrap: wrap; /* Allows tags to wrap to the next line */
    }

    .tag {
        display: inline-flex;
        align-items: center;
        background-color: #f0f0f0;
        border: 1px solid #ccc;
        border-radius: 4px;
        padding: 2px 4px;
        margin: 2px 2px;
    }

    .tag-remove-button {
        background: none;
        border: none;
        cursor: pointer;
        margin-left: 4px;
        font-size: 1em;
        color: #333;
    }

    input[type=text] {
        border: none;
        outline: none;
        padding: 5px;
        flex-grow: 1;
        margin: 2px 0px;
    }
    </style>
    <div class="tag-input-container">
        <slot name="tag"></slot>
        <input type="text" placeholder="Add a tag..." />
    </div>
`;


class TagInput extends HTMLElement {
    constructor() {
        super();
        this.shadowRoot = this.attachShadow({mode: 'open'});
        this.shadowRoot.appendChild(tagInputTemplate.content.cloneNode(true));
        this.tagsSlot = this.shadowRoot.querySelector('slot[name="tag"]');
        this.inputElement = this.shadowRoot.querySelector('input[type=text]');
        this.tags = [];
    }


    connectedCallback() {
        this.inputElement.addEventListener('keydown', this.handleKeyDown.bind(this));
        this.inputElement.addEventListener('blur', this.handleBlur.bind(this));
        this.render();
    }


    handleKeyDown(event) {
        if (event.key === 'Enter' && this.inputElement.value.trim() !== '') {
            event.preventDefault();
            this.addTag(this.inputElement.value.trim());
            this.inputElement.value = '';
        }
    }

    handleBlur() {
        if (this.inputElement.value.trim() !== '') {
            this.addTag(this.inputElement.value.trim());
            this.inputElement.value = '';
        }
    }


    addTag(tagName) {
        if (!this.tags.includes(tagName)) {
            this.tags.push(tagName);
            this.render();
            this.dispatchEvent(new CustomEvent('tag-added', { detail: tagName }));
        }
    }


    removeTag(tagName) {
        this.tags = this.tags.filter(tag => tag !== tagName);
        this.render();
        this.dispatchEvent(new CustomEvent('tag-removed', { detail: tagName }));
    }


    render() {
        this.tagsSlot.assignedNodes().forEach(node => node.remove());

        this.tags.forEach(tagName => {
            const tagElement = document.createElement('div');
            tagElement.className = 'tag';
            tagElement.textContent = tagName;

            const removeButton = document.createElement('button');
            removeButton.className = 'tag-remove-button';
            removeButton.textContent = 'x';
            removeButton.addEventListener('click', () => this.removeTag(tagName));

            tagElement.appendChild(removeButton);

            this.tagsSlot.appendChild(tagElement);
        });
    }

    getTags() {
        return this.tags;
    }

    setTags(tags) {
        this.tags = tags;
        this.render();
    }
}

customElements.define('tag-input', TagInput);
