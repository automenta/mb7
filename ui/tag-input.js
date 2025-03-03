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
