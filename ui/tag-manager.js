class TagManager extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.tags = []; // Array to hold tag definitions
        this.tagDefinitions = []; // Available tag definitions
    }

    async connectedCallback() {
        await this.fetchTagDefinitions();
        this.render();
    }

    async fetchTagDefinitions() {
        // Placeholder for fetching tag definitions from an API or config
        this.tagDefinitions = [
            { name: 'topic' },
            { name: 'location' },
            { name: 'person' },
            { name: 'event' },
            { name: 'organization' }
        ];
    }

    addTag(tag) {
        this.tags.push(tag);
        this.render();
        this.dispatchEvent(new CustomEvent('tags-updated', { detail: this.tags })); // Dispatch event
    }

    removeTag(index) {
        this.tags.splice(index, 1);
        this.render();
        this.dispatchEvent(new CustomEvent('tags-updated', { detail: this.tags })); // Dispatch event
    }

    updateTag(index, condition, value) {
        this.tags[index].condition = condition;
        this.tags[index].value = value;
        this.render();
        this.dispatchEvent(new CustomEvent('tags-updated', { detail: this.tags })); // Dispatch event
    }


    render() {
        this.shadow.innerHTML = `
        <style>
            .tag-manager {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .tag-list {
                display: flex;
                flex-direction: column;
                gap: 3px;
                margin-bottom: 10px;
            }
        </style>
            <div class="tag-manager">
                <div class="tag-list">
                    ${this.tags.map((tag, index) => `
                        <tag-input
                            key="${index}"
                            tag-definition='${JSON.stringify(tag.tagDefinition)}'
                            condition="${tag.condition}"
                            value="${tag.value}"
                            on-change="updateTagInput.bind(this, ${index})"
                        ></tag-input>
                    `).join('')}
                </div>
                <select id="tagDefinitionSelect">
                    ${this.tagDefinitions.map(def => `<option value='${JSON.stringify(def)}'>${def.name}</option>`).join('')}
                </select>
                <button id="addTagButton">Add Tag</button>
            </div>
        `;

        this.shadow.querySelector('#addTagButton').addEventListener('click', () => {
            const selectElement = this.shadow.querySelector('#tagDefinitionSelect');
            const selectedTagDefinition = JSON.parse(selectElement.value);
            this.addTag({ tagDefinition: selectedTagDefinition, condition: 'is', value: '' });
        });

        // Bind the updateTagInput function to the component instance
        const tagInputs = this.shadow.querySelectorAll('tag-input');
        tagInputs.forEach((tagInput, index) => {
            tagInput.onChange = (tagDefinition, condition, value) => {
                if (condition === null && value === null) {
                    this.removeTag(index);
                } else {
                    this.updateTag(index, condition, value);
                }
            };
        });
    }
}

customElements.define('tag-manager', TagManager);
