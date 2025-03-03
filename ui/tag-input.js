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

        // Add datalist for suggestions
        const datalist = createElement('datalist', {id: `tag-suggestions-${this.tagDefinition.name}`});
        inputElement.setAttribute('list', `tag-suggestions-${this.tagDefinition.name}`);
        this.appendChild(datalist);

        this.updateSuggestions = (inputValue) => {
            datalist.innerHTML = ''; // Clear existing suggestions
            const tagSuggestions = this.tagDefinition.suggestions || [];
            const filteredSuggestions = tagSuggestions.filter(suggestion =>
                suggestion.toLowerCase().startsWith(inputValue.toLowerCase())
            );
            filteredSuggestions.forEach(suggestion => {
                const option = createElement('option', {value: suggestion});
                datalist.appendChild(option);
            });
        };

        inputElement.addEventListener('input', (e) => {
            this.updateSuggestions(e.target.value);
        });

        this.updateSuggestions(''); // Initial population
    }

    handleInputChange(newValue) {
        // Validate the new value using tagDefinition.validate
        if (this.tagDefinition.validate(newValue, this.condition)) {
            this.value = newValue;
            this.onChange(this.value, this.condition);
        } else {
            // Handle validation error (e.g., display an error message)
            console.error('Invalid tag value:', newValue);
            // Optionally, provide visual feedback to the user (e.g., highlight the input field).
        }
    }
}

customElements.define('tag-input', TagInput);

export {TagInput};
