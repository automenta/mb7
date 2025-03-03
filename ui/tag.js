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

    remove() {
        const event = new CustomEvent('tag-removed', {
            detail: { tag: this }, // Pass the tag instance itself
            bubbles: true, // Allow the event to bubble up the DOM tree
            composed: true // Allow the event to cross the shadow DOM boundary
        });
        this.dispatchEvent(event);
        this.remove(); // Remove the tag from the DOM
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
