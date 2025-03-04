import { createElement } from './utils';

class ConditionSelector extends HTMLElement {
    constructor(tagDefinition, selectedCondition, onChange) {
        super();
        this.tagDefinition = tagDefinition;
        this.selectedCondition = selectedCondition;
        this.onChange = onChange;
        this.render();
        this.select = null;
    }

    connectedCallback() {
    }

    disconnectedCallback() {
        // Clean up event listeners
        if (this.select) {
            this.select.removeEventListener('change', this.handleConditionChange);
        }
    }

    handleConditionChange = (e) => {
        this.selectedCondition = e.target.value;
        this.onChange(this.selectedCondition);
    }

    render() {
        this.innerHTML = '';

        this.select = createElement('select', {});
        this.select.addEventListener('change', this.handleConditionChange);

        this.tagDefinition.conditions.forEach(condition => {
            const option = createElement('option', {
                value: condition,
                selected: condition === this.selectedCondition
            }, condition);
            this.select.appendChild(option);
        });

        this.appendChild(this.select);
    }
}

customElements.define('condition-selector', ConditionSelector);

export { ConditionSelector };
