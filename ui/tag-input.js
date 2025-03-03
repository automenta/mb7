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
            this.handleInputChange(e.target.value);
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
        if (this.tagDefinition.validate(newValue, 'is')) {
            this.value = newValue;
            this.onChange(newValue);
        } else {
            console.error('Invalid tag value:', newValue);
        }
    }
}

customElements.define('tag-input', TagInput);

export {TagInput};
