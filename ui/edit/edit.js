import * as Y from 'yjs';
import DOMPurify from 'dompurify';

import {UnifiedOntology} from '../../core/ontology';
import {DB, getNotesIndex, updateNotesIndex} from '../../core/db';
import {ErrorHandler} from '../../core/error';

import {createElement, debounce} from '../utils';

import {OntologyBrowser} from './ontology-browser';

import {Autosuggest} from './suggest';
import {SuggestionDropdown} from './suggest.dropdown';

import {EditorContentHandler} from './edit.content';
import {Toolbar} from './edit.toolbar';

class Edit {
    constructor(yDoc, app, errorHandler, db, autosuggest, contentHandler, ontologyBrowser, toolbar) {
        this.ontology = UnifiedOntology;
        this.errorHandler = errorHandler || new ErrorHandler(this);
        this.db = db || new DB(this.errorHandler);
        this.yDoc = yDoc; // Use the passed Y.Doc instance
        this.yText = this.yDoc.getText('content');
        this.yName = this.yDoc.getText('name');
        this.app = app; // Store the app instance

        this.el = createElement('div', { className: 'edit-view' });

        // Name input
        this.nameInput = this.createNameInput();
        this.el.appendChild(this.nameInput);

        this.editorArea = this.createEditorArea();
        this.el.appendChild(this.editorArea);

        this.setupEditorAreaEvents();
        this.setupNameInputEvents();

        const menu = createElement('div');
        this.el.append(menu, this.editorArea);

        this.suggestionDropdown = new SuggestionDropdown();
        this.editor = this;
        this.autosuggest = autosuggest || new Autosuggest(this);
        this.contentHandler = contentHandler || new EditorContentHandler(this, this.autosuggest, this.yDoc, this.yText, this.yName, this.app);
        this.ontologyBrowser = ontologyBrowser || new OntologyBrowser(this, (tag) => this.contentHandler.insertTagAtSelection(tag));
        this.toolbar = toolbar || new Toolbar(this);

        menu.append(this.toolbar.getElement(), this.ontologyBrowser.getElement());

        this.setupEditorEvents();

        // this.loadYDoc().then(() => { // Remove loadYDoc call from constructor
        //     this.editorArea.focus();
        // });
    }

    createNameInput() {
        const nameInput = createElement('input', {
            type: 'text',
            placeholder: 'Note Title'
        });
        return nameInput;
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

    setupNameInputEvents() {
        this.nameInput.addEventListener('input', () => {
            this.setName(this.nameInput.value);
        });
    }

    setName(name) {
        this.contentHandler.setName(name);
        this.nameInput.value = name;
    }

    setContent(html) {
        this.contentHandler.setContent(html);
    }

    getName() {
        const firstLine = this.yText.toString().split('\n')[0];
        return firstLine || 'Untitled Note';
    }

    findSuggestion(name) {
        for (const cat in this.ontology) {
            if (this.ontology[cat].instances) {
                for (const t of this.ontology[cat].instances) {
                    if (t.name === name) return {displayText: t.name, tagData: t};
                }
            } else if (this.ontology[cat].name === name) {
                return {displayText: this.ontology[cat].name, tagData: this.ontology[cat]};
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
            this.editor.autosuggest.apply();
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

        for (const categoryName in this.ontology) {
            const category = this.ontology[categoryName];
            if (category.instances) {
                for (const tag of category.instances) {
                    if (tag.name.toLowerCase().startsWith(word)) {
                        suggestions.push(this.createSuggestion(tag, span));
                    }
                }
            } else if (category.name?.toLowerCase().startsWith(word)) {
                suggestions.push(this.createSuggestion(category));
            }
        }

        const rect = span.getBoundingClientRect();
        this.suggestionDropdown.show(suggestions, rect.left + window.scrollX, rect.bottom + window.scrollY, this.contentHandler.insertTagFromSuggestion.bind(this.contentHandler));
    }

    createSuggestion(tagData, span = null) {
        return { displayText: tagData.name, tagData, span };
    }
matchesOntology(word) {
    return Object.values(this.ontology).flat().some(tag => tag?.name?.toLowerCase().startsWith(word.toLowerCase()));
}
}

export {Edit};
