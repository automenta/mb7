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
    constructor(yDoc, autosuggest, contentHandler, ontologyBrowser, toolbar, getTagDefinition, schema) {
        this.getTagDefinition = getTagDefinition;
        this.schema = schema;
        this.yDoc = yDoc; // Use the passed Y.Doc instance
        this.yText = this.yDoc.getText('content');
        this.el = createElement('div', {className: 'edit-view'});

        this.editorArea = this.createEditorArea();
        this.el.appendChild(this.editorArea);

        this.setupEditorAreaEvents();

        const menu = createElement('div');
        this.el.append(menu, this.editorArea);

        // Add persistent query checkbox
        this.persistentQueryCheckbox = createElement('input', {type: 'checkbox', id: 'persistentQueryCheckbox'});
        const persistentQueryLabel = createElement('label', {htmlFor: 'persistentQueryCheckbox'}, 'Persistent Query');
        const persistentQueryContainer = createElement('div', { className: 'persistent-query-container' });
        persistentQueryContainer.append(persistentQueryLabel, this.persistentQueryCheckbox);
        menu.append(persistentQueryContainer);

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
}

export { Edit };
