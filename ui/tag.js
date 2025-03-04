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
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'tag';

        if (this.tagDefinition.conditions && this.tagDefinition.conditions.length) {
            this.el.classList.add('conditional');
        }

        const icon = this.tagDefinition.ui?.icon || '🏷️';
        const display = createElement('span', {}, `${icon} ${this.tagDefinition.name}: ${this.value}`);
        this.el.appendChild(display);

        const removeButton = createElement('button', { className: 'remove-tag-button' }, 'X');
        removeButton.addEventListener('click', () => {
            const event = new CustomEvent('tag-removed', {
                detail: { tag: this },
                bubbles: true,
                composed: true
            });
            this.dispatchEvent(event);
            this.remove();
        });
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
