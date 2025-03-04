import {createElement} from './utils';

/** @typedef {import('../core/types').Tag} Tag */

class TagInput extends HTMLElement {
    /**
     * @param {any} tagDefinition
     * @param {string} value
     * @param {string} condition
     * @param {function} onChange
     */
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

        // Add CSS styles
        const style = document.createElement('style');
        style.textContent = `
            .tag-input-container {
                display: flex;
                align-items: center;
            }

            .condition-select {
                margin-right: 5px;
            }

            input[type="text"] {
                padding: 5px;
                border: 1px solid #ccc;
                border-radius: 4px;
            }

            .clear-button {
                background-color: #ddd;
                border: none;
                padding: 5px;
                cursor: pointer;
            }
        `;
        this.appendChild(style);

        const conditionSelect = document.createElement('select');
        conditionSelect.className = 'condition-select';
        this.tagDefinition.conditions.forEach(condition => {
            const option = document.createElement('option');
            option.value = condition;
            option.textContent = condition;
            conditionSelect.appendChild(option);
        });
        conditionSelect.value = this.condition;
        conditionSelect.addEventListener('change', (e) => {
            this.condition = e.target.value;
            this.onChange(this.value, this.condition);
            this.updateSuggestions(this.value);
        });
        this.appendChild(conditionSelect);

        // TAGINPUT-1: Render only text input
        const inputElement = createElement('input', {type: 'text', value: this.value || ''});

        inputElement.addEventListener('change', (e) => {
            this.value = e.target.value;
            // TAGINPUT-1: Basic Validation
            if (this.tagDefinition.validate) {
                if (!this.tagDefinition.validate(this.value, this.condition)) {
                    alert(`Invalid value for tag: ${this.tagDefinition.name}`); // Basic error message
                    return; // Stop processing if invalid
                }
            } else {
                console.warn(`No validate function for tag: ${this.tagDefinition.name}`);
            }
            this.onChange(this.value, this.condition); // Notify parent component of value and condition changes
            this.updateSuggestions(this.value);
        });


        this.appendChild(inputElement);

        const clearButton = createElement('button', {className: 'clear-button'}, 'X');
        clearButton.addEventListener('click', () => {
            inputElement.value = '';
            this.value = '';
            this.onChange(this.value, this.condition);
        });

        this.appendChild(clearButton);

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
}

customElements.define('tag-input', TagInput);

export {TagInput};
