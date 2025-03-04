import {createElement, debounce} from '../utils';
import {TagInput} from '../tag-input';

import {OntologyBrowser} from './ontology-browser';

import {Autosuggest} from './suggest';
import {SuggestionDropdown} from './suggest.dropdown';

import {EditorContentHandler} from './edit.content';
import {Toolbar} from './edit.toolbar';

/**
 * The main editor class.
 * Manages the editor area, autosuggestions, ontology browser, and toolbar.
 */
class Edit {
    constructor(note, yDoc, autosuggest, contentHandler, ontologyBrowser, toolbar, getTagDefinition, schema) {
        this.note = note;
        this.getTagDefinition = getTagDefinition;
        this.schema = schema;
        this.yDoc = yDoc; // Use the passed Y.Doc instance
        this.yText = this.yDoc.getText('content');
        this.el = createElement('div', { className: 'edit-view' });

        this.editorArea = this.createEditorArea();
        this.app = autosuggest.app;
        this.el.appendChild(this.editorArea);

        this.setupEditorAreaEvents();

        const menu = createElement('div');
        this.el.append(menu, this.editorArea);

        // Add persistent query checkbox
        this.persistentQueryCheckbox = createElement('input', {type: 'checkbox', id: 'persistentQueryCheckbox'});
        const persistentQueryLabel = createElement('label', {htmlFor: 'persistentQueryCheckbox'}, 'Save as Persistent Query');
        const persistentQueryContainer = createElement('div', { className: 'persistent-query-container' });
        persistentQueryContainer.append(persistentQueryLabel, this.persistentQueryCheckbox);
        menu.append(persistentQueryContainer);

        this.tagList = document.createElement('ul');
        this.tagList.className = 'tag-list';

        this.tagInput = document.createElement('input');
        this.tagInput.type = 'text';
        this.tagInput.placeholder = 'Add a tag';
        this.tagInput.className = 'tag-input';
        this.tagInput.addEventListener('input', debounce(() => this.suggestTags(), 200));
        this.tagInput.addEventListener('keydown', (e) => this.handleTagInputKeyDown(e));

        this.addTagButton = createElement('button', { className: 'add-tag-button' }, 'Add Tag');
        this.addTagButton.addEventListener('click', () => this.addTagToNote(this.tagInput.value));

        this.tagSuggestions = document.createElement('ul');
        this.tagSuggestions.className = 'tag-suggestions';
        this.tagSuggestions.style.display = 'none'; // Initially hide the suggestions

        const tagInputContainer = createElement('div', { className: 'tag-input-container' });
        tagInputContainer.append(this.tagInput, this.addTagButton);

        menu.append(this.tagList, tagInputContainer, this.tagSuggestions);

        this.suggestionDropdown = new SuggestionDropdown();
        this.autosuggest = autosuggest || new Autosuggest(this);
        this.contentHandler = contentHandler || new EditorContentHandler(this, this.autosuggest, this.yDoc, this.yText);
        this.ontologyBrowser = ontologyBrowser || new OntologyBrowser(this, (tag) => this.contentHandler.insertTagAtSelection(tag));
        this.toolbar = toolbar || new Toolbar(this);

        menu.append(this.toolbar.getElement(), this.ontologyBrowser.getElement());

        this.setupEditorEvents();

        // Save function
        this.save = (object) => {
            const isPersistentQuery = this.persistentQueryCheckbox.checked;
            this.app.db.saveObject(object, isPersistentQuery).catch(error => this.app.errorHandler.handleError(error, "Failed to save object"));
        };
        this.renderTags();
    }

    handleTagInputKeyDown(event) {
        if (this.tagSuggestions.style.display === 'block') {
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.moveTagSuggestionSelection(1);
            } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.moveTagSuggestionSelection(-1);
            } else if (event.key === 'Enter') {
                event.preventDefault();
                this.selectTagSuggestion();
            } else if (event.key === 'Escape') {
                this.clearTagSuggestions();
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
        const tagDefinition = this.getTagDefinition(tag.name);
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
                this.editorArea.focus();
                return;
            }

            const tagDefinition = this.getTagDefinition(tagName);
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
            this.editorArea.focus();
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
        const suggestions = Object.keys(this.getTagDefinition())
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

    createEditorArea() {
        const editorArea = createElement('div', {
            contenteditable: "true",
            className: "editor-area"
        });
        return editorArea;
    }

    setupEditorAreaEvents() {
        this.editorArea.addEventListener('input', debounce(() => {
            this.setContent(this.editorArea.innerHTML);
        }, 300));
    }

    setContent(html) {
        this.contentHandler.setContent(html);
    }

    /**
     * Adds a tag to the note's content.
     */
    addTag(tagName) {
        const tagDefinition = this.getTagDefinition(tagName);
        if (!tagDefinition) {
            console.error('Tag definition not found:', tagName);
            return;
        }

        const initialValue = '';
        const initialCondition = tagDefinition.conditions[0]; // Default condition

        const tagComponent = new Tag(
            tagDefinition,
            initialValue,
            initialCondition,
            (updatedTag) => {
                // Handle tag update (e.g., save to database)
                console.log('Tag updated:', updatedTag.getValue(), updatedTag.getCondition());
            }
        );
    }

    findSuggestion(name) {
        const tagDefinition = this.getTagDefinition(name);
        if (tagDefinition) {
            if (tagDefinition.instances) {
                for (const t of tagDefinition.instances) {
                    if (t.name === name) return {displayText: t.name, tagData: t};
                }
            } else if (tagDefinition.name === name) {
                return {displayText: tagDefinition.name, tagData: tagDefinition};
            }
        }
        return null;
    }

    handleDropdownKeys(event) {
        if (this.suggestionDropdown.el.style.display !== "block") return;
        switch (event.key) {
            case "ArrowDown":
            case "ArrowUp":
                event.preventDefault();
                this.suggestionDropdown.moveSelection(event.key === "ArrowDown" ? 1 : -1);
                break;
            case "Enter":
                event.preventDefault();
                if (this.suggestionDropdown.getSelectedSuggestion()) {
                    // Use content handler for consistency
                    const suggestion = this.findSuggestion(this.suggestionDropdown.getSelectedSuggestion());
                    if (suggestion) this.contentHandler.insertTagFromSuggestion(suggestion);
                }
                this.suggestionDropdown.hide();
                break;
            case "Escape":
                this.suggestionDropdown.hide();
                break;
        }
    }

    setupEditorEvents() {
        this.editorArea.addEventListener("keyup", (event) => this.handleEditorKeyUp(event));
        this.editorArea.addEventListener("click", (event) => this.handleEditorClick(event));
        this.editorArea.addEventListener("keydown", (event) => this.handleEditorKeyDown(event));
        document.addEventListener("keydown", (event) => this.handleDropdownKeys(event));
        document.addEventListener("click", (event) => this.handleDocumentClick(event));
    }

    handleEditorKeyUp(event) {
        if (this.suggestionDropdown.el.style.display !== 'block') {
            this.autosuggest.apply();
        }
        this.updateLastValidRange();
    }

    handleEditorClick(event) {
        if (event.target.classList.contains("autosuggest")) {
            event.stopPropagation();
            this.showSuggestionsForSpan(event.target);
        }
        this.updateLastValidRange();
    }

    handleEditorKeyDown(event) {
        if (event.key === "Enter") {
            event.preventDefault();
            this.contentHandler.insertLineBreak();
        }
    }

    handleDocumentClick(event) {
        if (!this.editorArea.contains(event.target) &&
            !this.ontologyBrowser.getElement().contains(event.target) &&
            !this.suggestionDropdown.el.contains(event.target)) {
            this.suggestionDropdown.hide();
        }
    }

    updateLastValidRange() {
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && this.editorArea.contains(selection.anchorNode)) {
            this.contentHandler.lastValidRange = selection.getRangeAt(0).cloneRange();
        }
    }

    showSuggestionsForSpan(span) {
        const suggestions = [];
        const word = span.textContent.toLowerCase();

        const rect = span.getBoundingClientRect();
        this.suggestionDropdown.show(suggestions, rect.left + window.scrollX, rect.bottom + window.scrollY, this.contentHandler.insertTagFromSuggestion.bind(this.contentHandler));
    }

    createSuggestion(tagData, span = null) {
        return {displayText: tagData.name, tagData, span};
    }

    /**
     * Checks if a word matches any tag name or condition in the ontology.
     */
    matchesOntology(word) {
        const tagDefinition = this.getTagDefinition(word);
        return !!tagDefinition;
    }

    /**
     * Adds a tag to the note's content.
     */
    addTag(tagName) {
        const tagDefinition = this.getTagDefinition(tagName);
        if (!tagDefinition) {
            console.error('Tag definition not found:', tagName);
            return;
        }

        const initialValue = '';
        const initialCondition = tagDefinition.conditions[0]; // Default condition

        const tagComponent = new Tag(
            tagDefinition,
            initialValue,
            initialCondition,
            (updatedTag) => {
                // Handle tag update (e.g., save to database)
                console.log('Tag updated:', updatedTag.getValue(), updatedTag.getCondition());
            }
        );
    }

    async updateTag(tagName, newValue, newCondition) {
        try {
            if (this.note) {
                const tagIndex = this.note.tags.findIndex(tag => tag.name === tagName);
                if (tagIndex !== -1) {
                    this.note.tags[tagIndex].value = newValue;
                    this.note.tags[tagIndex].condition = newCondition;
                    await this.app.db.saveObject(this.note, false);
                    this.renderTags();
                } else {
                    console.error('Tag not found');
                }
            } else {
                console.error('Note not found');
            }
        } catch (error) {
            console.error('Error updating tag:', error);
        }
    }
}

export { Edit };

// Add CSS styles
const style = document.createElement('style');
style.textContent = `
.tag-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-wrap: wrap;
}

.tag-list-item {
    margin: 2px;
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

                .tag > button {
                    background-color: transparent;
                    border: none;
                    cursor: pointer;
                    font-size: 1em;
                    padding: 0;
                    margin: 0;
                }

                .tag > button:hover {
                    color: #007bff;
                }

                .tag:hover {
                    background-color: #ddd;
                }
            </style>
        `;
        const el = document.createElement('div');
        el.className = 'tag';
        el.dataset.tagName = this.tagDefinition.name;

        if (this.tagDefinition.conditions && this.tagDefinition.conditions.length) {
            el.classList.add('conditional');
        }

        const icon = this.tagDefinition.ui?.icon || '🏷️';
        const display = createElement('span', {}, `${icon} ${this.tagDefinition.name}: ${this.value}`);
        el.appendChild(display);

        this.editButton = createElement('button', {
            className: 'edit-tag-button',
            'aria-label': `Edit ${this.tagDefinition.name}`,
            title: `Edit ${this.tagDefinition.name} Value`
        }, 'Edit');
        this.editButton.addEventListener('click', () => {
            this.editTag();
        });
        el.appendChild(this.editButton);

        const removeButton = createElement('button', {
            className: 'remove-tag-button',
            'aria-label': `Remove ${this.tagDefinition.name}`,
            title: `Remove ${this.tagDefinition.name}`
        }, 'X');
        removeButton.addEventListener('click', () => {
            this.remove();
        });
        el.appendChild(removeButton);

        if (!this.tagDefinition.validate(this.value, this.condition)) {
            el.classList.add('invalid');
            el.title = 'Invalid tag value'; // Add tooltip
        }

        this.shadow.appendChild(el);
    }

    isValid() {
        return this.tagDefinition.validate(this.value, this.condition);
    }

    editTag() {
        this.shadow.innerHTML = '';
        const tagInput = new TagInput(this.tagDefinition, this.value, this.condition, (newValue, newCondition) => {
            this.value = newValue;
            this.condition = newCondition;
            this.render();
        });
        this.shadow.appendChild(tagInput);
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
