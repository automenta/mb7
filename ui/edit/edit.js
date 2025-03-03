import {createElement, debounce} from '../utils';

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
    /**
     * Constructs a new Edit instance.
     * @param {Y.Doc} yDoc The Y.Doc instance.
     * @param {Autosuggest} autosuggest The autosuggest instance.
     * @param {EditorContentHandler} contentHandler The content handler instance.
     * @param {OntologyBrowser} ontologyBrowser The ontology browser instance.
     * @param {Toolbar} toolbar The toolbar instance.
     * @param {function} getTagDefinition The function to get tag definitions.
     * @param {object} schema The schema.
     */
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
        this.persistentQueryCheckbox = createElement('input', { type: 'checkbox', id: 'persistentQueryCheckbox' });
        const persistentQueryLabel = createElement('label', { htmlFor: 'persistentQueryCheckbox' }, 'Persistent Query');
        menu.append(persistentQueryLabel, this.persistentQueryCheckbox);

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
           this.app.db.saveObject(object, isPersistentQuery);
       }
    }

    /**
     * Creates the editor area.
     * @returns {HTMLDivElement} The editor area element.
     */
    createEditorArea() {
        return createElement('div', {
            contenteditable: "true",
            className: "editor-area"
        });
    }

    /**
     * Sets up the editor area events.
     */
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
     * @param {string} word The word to check.
     * @returns {boolean} True if the word matches a tag name or condition, false otherwise.
     */
    matchesOntology(word) {
        const lowerWord = word.toLowerCase();
        const tagDefinition = this.getTagDefinition(word);
        if (tagDefinition) {
            return true;
        }
        return false;
    }

    /**
     * Adds a tag to the note's content.
     * @param {string} tag The tag to add.
     */
    addTag(tag) {
        // Implement tag adding logic here
        console.log('Adding tag:', tag);
        this.contentHandler.insertTagAtSelection(tag);
    }

}

export {Edit};
