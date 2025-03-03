import { createElement } from './utils';

class ConditionSelector extends HTMLElement {
    constructor(tagDefinition, selectedCondition, onChange) {
        super();
        this.tagDefinition = tagDefinition;
        this.selectedCondition = selectedCondition;
        this.onChange = onChange;
        this.render();
    }

    render() {
        this.innerHTML = '';
        const select = createElement('select', {
            onchange: (e) => {
                this.selectedCondition = e.target.value;
                this.onChange(this.selectedCondition);
            }
        });

        this.tagDefinition.conditions.forEach(condition => {
            const option = createElement('option', {
                value: condition,
                selected: condition === this.selectedCondition
            }, condition);
            select.appendChild(option);
        });

        this.appendChild(select);
    }
}

customElements.define('condition-selector', ConditionSelector);

export { ConditionSelector };
