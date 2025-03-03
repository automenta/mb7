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
            detail: { tag: this },
            bubbles: true,
            composed: true
        });
        this.dispatchEvent(event);
        this.el.remove();
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'tag';

        if (this.tagDefinition.conditions && this.tagDefinition.conditions.length) {
            this.el.classList.add('conditional');
        }

        const display = createElement('span', {}, `${this.tagDefinition.name}: ${this.value}`);
        this.el.appendChild(display);

        const removeButton = createElement('span', { className: 'remove-tag' }, 'x');
        removeButton.addEventListener('click', () => this.remove());
        this.el.appendChild(removeButton);

        if (!this.tagDefinition.validate(this.value, this.condition)) {
            this.el.classList.add('invalid');
            this.el.title = 'Invalid tag value'; // Add tooltip
        }

        this.appendChild(this.el);
    }

    isValid() {
        return this.tagDefinition.validate(this.value, this.condition);
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
