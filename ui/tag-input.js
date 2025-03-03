import {createElement} from './utils';

class TagInput extends HTMLElement {
    constructor(tagDefinition, value, onChange) {
        super();
        this.tagDefinition = tagDefinition;
        this.value = value;
        this.onChange = onChange;
        this.render();
    }

    render() {
        this.innerHTML = '';
        const uiType = this.tagDefinition.ui?.type || 'text';
        let inputElement;

        switch (uiType) {
            case 'text':
                inputElement = createElement('input', {type: 'text', value: this.value});
                break;
            case 'number':
                inputElement = createElement('input', {type: 'number', value: this.value});
                break;
            // Add more cases for other UI types (select, date, etc.)
            default:
                inputElement = createElement('input', {type: 'text', value: this.value});
                break;
        }

        inputElement.addEventListener('input', (e) => {
            const newValue = e.target.value;
            // Validate the new value using tagDefinition.validate
            if (this.tagDefinition.validate(newValue, 'is')) { // Assuming 'is' is the default condition
                this.value = newValue;
                this.onChange(newValue);
            } else {
                // Handle validation error
                console.error('Invalid tag value:', newValue);
            }
        });

        this.appendChild(inputElement);
    }
}

customElements.define('tag-input', TagInput);

export {TagInput};
import { createElement } from './utils';
import { ConditionSelector } from './condition-selector';

class TagInput extends HTMLElement {
    constructor(tagDefinition, value, condition, onChange) {
        super();
        this.tagDefinition = tagDefinition;
        this.value = value;
        this.condition = condition;
        this.onChange = onChange;
        this.render();
    }

    render() {
        this.innerHTML = '';

        // Condition Selector
        const conditionSelector = new ConditionSelector(
            this.tagDefinition,
            this.condition,
            (newCondition) => {
                this.condition = newCondition;
                this.onChange(this.value, this.condition);
            }
        );
        this.appendChild(conditionSelector);

        const uiType = this.tagDefinition.ui?.type || 'text';
        let inputElement;

        switch (uiType) {
            case 'text':
                inputElement = createElement('input', {
                    type: 'text',
                    value: this.value,
                    oninput: (e) => {
                        this.handleInputChange(e.target.value);
                    }
                });
                break;
            case 'number':
                inputElement = createElement('input', {
                    type: 'number',
                    value: this.value,
                    oninput: (e) => {
                        this.handleInputChange(e.target.value);
                    }
                });
                break;
            // Add more cases for other UI types (select, date, etc.)
            default:
                inputElement = createElement('input', {
                    type: 'text',
                    value: this.value,
                    oninput: (e) => {
                        this.handleInputChange(e.target.value);
                    }
                });
                break;
            }

        this.appendChild(inputElement);
    }

    handleInputChange(newValue) {
        // Validate the new value using tagDefinition.validate
        if (this.tagDefinition.validate(newValue, this.condition)) {
            this.value = newValue;
            this.onChange(this.value, this.condition);
        } else {
            // Handle validation error (e.g., display an error message)
            console.error('Invalid tag value:', newValue);
        }
    }
}

customElements.define('tag-input', TagInput);

export { TagInput };
