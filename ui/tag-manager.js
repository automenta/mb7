import { createElement } from './utils';
import { TagInput } from './tag-input';

class TagManager extends HTMLElement {
    constructor(app, note) {
        super();
        this.app = app;
        this.note = note;
        this.shadow = this.attachShadow({ mode: 'open' });
        this.render();
    }

    connectedCallback() {
        this.render();
    }

    async render() {
        this.shadow.innerHTML = `
            <style>
                .tag-manager {
                    display: flex;
                    flex-direction: column;
                    gap: 5px;
                }

                .tag-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }

                .tag-list-item {
                    display: inline-block;
                }

                .tag-input-container {
                    display: flex;
                }

                .tag-input {
                    flex-grow: 1;
                    padding: 5px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    margin-right: 5px;
                }

                .add-tag-button {
                    padding: 5px 10px;
                    border: none;
                    background-color: #007bff;
                    color: white;
                    border-radius: 4px;
                    cursor: pointer;
                }

                .tag-suggestions {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    position: absolute;
                    z-index: 10;
                    background-color: white;
                    display: none;
                }

                .tag-suggestions li {
                    padding: 5px;
                    cursor: pointer;
                }

                .tag-suggestions li.selected {
                    background-color: #f0f0f0;
                }
            </style>
            <div class="tag-manager">
                <ul class="tag-list"></ul>
                <div class="tag-input-container">
                    <input type="text" class="tag-input" placeholder="Add a tag">
                    <button class="add-tag-button">Add Tag</button>
                </div>
                <ul class="tag-suggestions"></ul>
            </div>
        `;

        this.tagList = this.shadow.querySelector('.tag-list');
        this.tagInput = this.shadow.querySelector('.tag-input');
        this.addTagButton = this.shadow.querySelector('.add-tag-button');
        this.tagSuggestions = this.shadow.querySelector('.tag-suggestions');

        this.tagInput.addEventListener('input', this.debounce(() => this.suggestTags(), 200));
        this.tagInput.addEventListener('keydown', (e) => this.handleTagInputKeyDown(e));
        this.addTagButton.addEventListener('click', () => this.addTagToNote(this.tagInput.value));

        this.renderTags();
    }

    debounce(func, delay) {
        let timeout;
        return function(...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }

    handleTagInputKeyDown(event) {
        if (this.tagSuggestions.style.display === 'block') {
            switch (event.key) {
                case 'ArrowDown':
                    event.preventDefault();
                    this.moveTagSuggestionSelection(1);
                    break;
                case 'ArrowUp':
                    event.preventDefault();
                    this.moveTagSuggestionSelection(-1);
                    break;
                case 'Enter':
                    event.preventDefault();
                    this.selectTagSuggestion();
                    break;
                case 'Escape':
                    this.clearTagSuggestions();
                    break;
            }
        }
    }

    moveTagSuggestionSelection(direction) {
        const suggestions = this.tagSuggestions.querySelectorAll('li');
        if (suggestions.length === 0) return;

        let selectedIndex = -1;
        suggestions.forEach((suggestion, index) => {
            if (suggestion.classList.contains('selected')) {
                selectedIndex = index;
                suggestion.classList.remove('selected');
            }
        });

        let newIndex = selectedIndex + direction;
        if (newIndex < 0) {
            newIndex = suggestions.length - 1;
        } else if (newIndex >= suggestions.length) {
            newIndex = 0;
        }

        suggestions[newIndex].classList.add('selected');
    }

    selectTagSuggestion() {
        const selectedSuggestion = this.tagSuggestions.querySelector('li.selected');
        if (selectedSuggestion) {
            this.addTagToNote(selectedSuggestion.textContent);
        }
    }

    async renderTags() {
        this.tagList.innerHTML = ''; // Clear existing tags
        if (this.note && this.note.tags) {
            for (const tag of this.note.tags) {
                this.renderTag(tag);
            }
        }
    }

    renderTag(tag) {
        const tagDefinition = this.app.getTagDefinition(tag.name);
        const tagComponent = document.createElement('data-tag');
        tagComponent.setAttribute('tag-definition', JSON.stringify(tagDefinition));
        tagComponent.setAttribute('value', tag.value);
        tagComponent.setAttribute('condition', tag.condition);

        const listItem = createElement('li', { className: 'tag-list-item' });
        listItem.appendChild(tagComponent);
        listItem.addEventListener('tag-removed', () => {
            this.removeTagFromNote(tag.name);
        });
        this.tagList.appendChild(listItem);
    }

    async addTagToNote(tagName) {
        try {
            if (!this.note || !this.note.id) {
                console.error('No note selected');
                return;
            }

            if (this.note.tags.some(tag => tag.name === tagName)) {
                console.warn('Tag already exists on this note.');
                this.clearTagInput();
                this.clearTagSuggestions();
                return;
            }

            const tagDefinition = this.app.getTagDefinition(tagName);
            if (!tagDefinition) {
                console.error('Tag definition not found:', tagName);
                return;
            }

            const newTag = { name: tagName, value: '', condition: 'is' };
            this.note.tags.push(newTag);
            await this.app.db.saveObject(this.note, false);
            this.renderTags();
            this.clearTagInput();
            this.clearTagSuggestions();
        } catch (error) {
            console.error('Error adding tag to note:', error);
        }
    }

    async removeTagFromNote(tagName) {
        try {
            if (!this.note || !this.note.id) {
                console.error('No note selected');
                return;
            }

            this.note.tags = this.note.tags.filter(tag => tag.name !== tagName);
            await this.app.db.saveObject(this.note, false);
            this.renderTags();
        } catch (error) {
            console.error('Error removing tag from note:', error);
        }
    }

    suggestTags() {
        const searchText = this.tagInput.value.toLowerCase();
        const suggestions = Object.keys(this.app.getTagDefinition())
            .filter(tagName => tagName.toLowerCase().startsWith(searchText))
            .slice(0, 5); // Limit to 5 suggestions

        this.displayTagSuggestions(suggestions);
    }

    displayTagSuggestions(suggestions) {
        this.tagSuggestions.innerHTML = '';
        if (suggestions.length === 0) {
            this.tagSuggestions.style.display = 'none';
            return;
        }

        suggestions.forEach(suggestion => {
            const suggestionItem = createElement('li', {}, suggestion);
            suggestionItem.addEventListener('click', () => {
                this.addTagToNote(suggestion);
            });
            this.tagSuggestions.appendChild(suggestionItem);
        });

        this.tagSuggestions.style.display = 'block';

        // Select the first suggestion by default
        if (suggestions.length > 0) {
            this.tagSuggestions.firstChild.classList.add('selected');
        }
    }

    clearTagInput() {
        this.tagInput.value = '';
    }

    clearTagSuggestions() {
        this.tagSuggestions.innerHTML = '';
        this.tagSuggestions.style.display = 'none';
    }
}

customElements.define('tag-manager', TagManager);

export { TagManager };
