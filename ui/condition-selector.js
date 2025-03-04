import { createElement } from './utils';

class ConditionSelector extends HTMLElement {
    constructor(tagDefinition, selectedCondition, onChange) {
        super();
        this.tagDefinition = tagDefinition;
        this.selectedCondition = selectedCondition;
        this.onChange = onChange;
        this.select = createElement('select', {});
        this.select.addEventListener('change', this.handleConditionChange.bind(this));
        this.appendChild(this.select);
        this.renderOptions();
    }

    static get observedAttributes() {
        return ['selectedCondition', 'tagDefinition'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'selectedCondition' && oldValue !== newValue) {
            this.selectedCondition = newValue;
            this.renderOptions();
        }
        if (name === 'tagDefinition' && oldValue !== newValue) {
            this.tagDefinition = JSON.parse(newValue);
            this.renderOptions();
        }
    }

    connectedCallback() {}

    disconnectedCallback() {
        // Clean up event listeners
        this.select.removeEventListener('change', this.handleConditionChange);
    }

    handleConditionChange(e) {
        this.selectedCondition = e.target.value;
        this.onChange(this.selectedCondition);
    }

    renderOptions() {
        this.select.innerHTML = '';
        this.tagDefinition.conditions.forEach(condition => {
            const option = createElement('option', {
                value: condition,
                selected: condition === this.selectedCondition
            }, condition);
            this.select.appendChild(option);
        });
    }
}

customElements.define('condition-selector', ConditionSelector);

export { ConditionSelector };
