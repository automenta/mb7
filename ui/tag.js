import { createElement } from './utils';
import { TagInput } from './tag-input';

class Tag extends HTMLElement {
    constructor(tagDefinition, initialValue, initialCondition, onTagUpdate) {
        super();
        this.tagDefinition = tagDefinition;
        this.value = initialValue;
        this.condition = initialCondition;
        this.onTagUpdate = onTagUpdate;
        this.render();
    }

    render() {
        this.innerHTML = '';

        const tagInput = new TagInput(
            this.tagDefinition,
            this.value,
            this.condition,
            (newValue, newCondition) => {
                this.value = newValue;
                this.condition = newCondition;
                this.onTagUpdate(this); // Pass the Tag component itself
            }
        );
        this.appendChild(tagInput);

        // Display the tag's value (you can customize this)
        const display = createElement('span', {}, `${this.tagDefinition.name}: ${this.value}`);
        this.appendChild(display);
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

customElements.define('data-tag', Tag);

export { Tag };
