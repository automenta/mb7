import {createElement, debounce} from '../utils';
import {TagManager} from '../tag-manager';
import {OntologyBrowser} from './ontology-browser';
import {Autosuggest} from './suggest';
import {SuggestionDropdown} from './suggest.dropdown';
import {EditorContentHandler} from './edit.content';
import {Toolbar} from './edit.toolbar';

class EditorEventHandler {
    constructor(edit) {
        this.edit = edit;
        this.editorArea = this.edit.editorArea;
        this.suggestionDropdown = this.edit.suggestionDropdown;
        this.autosuggest = this.edit.autosuggest;
        this.contentHandler = this.edit.contentHandler;

        this.setupEditorAreaEvents();
        this.setupDocumentEvents();
    }

    setupEditorAreaEvents() {
        this.editorArea.addEventListener("keyup", (event) => this.handleEditorKeyUp(event));
        this.editorArea.addEventListener("click", (event) => this.handleEditorClick(event));
        this.editorArea.addEventListener("keydown", (event) => this.handleEditorKeyDown(event));
    }

    setupDocumentEvents() {
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
                    const suggestion = this.edit.findSuggestion(this.suggestionDropdown.getSelectedSuggestion());
                    if (suggestion) this.contentHandler.insertTagFromSuggestion(suggestion);
                }
                this.suggestionDropdown.hide();
                break;
            case "Escape":
                this.suggestionDropdown.hide();
                break;
        }
    }

    handleDocumentClick(event) {
        if (!this.editorArea.contains(event.target) &&
            !this.edit.ontologyBrowser.getElement().contains(event.target) &&
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
}

class SuggestionHandler {
    constructor(edit) {
        this.edit = edit;
        this.suggestionDropdown = this.edit.suggestionDropdown;
    }

    createSuggestion(tagData, span = null) {
        return {displayText: tagData.name, tagData, span};
    }

    matchesOntology(word) {
        const tagDefinition = this.edit.getTagDefinition(word);
        return !!tagDefinition;
    }

    async updateTag(tagName, newValue, newCondition) {
        try {
            if (this.edit.note) {
                const tagIndex = this.edit.note.tags.findIndex(tag => tag.name === tagName);
                if (tagIndex !== -1) {
                    this.edit.note.tags[tagIndex].value = newValue;
                    this.edit.note.tags[tagIndex].condition = newCondition;
                    await this.edit.app.db.saveObject(this.edit.note, false);
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

class EditorArea {
    constructor() {
        this.el = this.createEditorArea();
    }

    createEditorArea() {
        const editorArea = createElement('div', {
            contenteditable: "true",
            className: "editor-area"
        });
        return editorArea;
    }
}

class EditorMenu {
    constructor(app, saveHandler) {
        this.app = app;
        this.saveHandler = saveHandler;
        this.el = createElement('div');
        this.persistentQueryCheckbox = createElement('input', {type: 'checkbox', id: 'persistentQueryCheckbox'});
        this.build();
    }

    build() {
        const persistentQueryLabel = createElement('label', {htmlFor: 'persistentQueryCheckbox'}, 'Save as Persistent Query');
        const persistentQueryContainer = createElement('div', { className: 'persistent-query-container' });
        persistentQueryContainer.append(persistentQueryLabel, this.persistentQueryCheckbox);
        this.el.append(persistentQueryContainer);
    }

    getElement() {
        return this.el;
    }
}

class EditorSaveHandler {
    constructor(app, persistentQueryCheckbox) {
        this.app = app;
        this.persistentQueryCheckbox = persistentQueryCheckbox;
    }

    save(object) {
        const isPersistentQuery = this.persistentQueryCheckbox.checked;
        this.app.db.saveObject(object, isPersistentQuery).catch(error => this.app.errorHandler.handleError(error, "Failed to save object"));
    }
}

class Edit {
    constructor(note, yDoc, app, autosuggest, contentHandler, ontologyBrowser, toolbar, getTagDefinition, schema) {
        this.note = note;
        this.getTagDefinition = getTagDefinition;
        this.schema = schema;
        this.yDoc = yDoc;
        this.yText = this.yDoc.getText('content');
        this.el = createElement('div', { className: 'edit-view' });

        this.editorArea = new EditorArea().el;
        this.app = app;
        this.el.appendChild(this.editorArea);

        this.suggestionDropdown = new SuggestionDropdown();
        this.autosuggest = autosuggest || new Autosuggest(this);
        this.contentHandler = contentHandler || new EditorContentHandler(this, this.autosuggest, this.yDoc, this.yText, this.app);
        this.ontologyBrowser = ontologyBrowser || new OntologyBrowser(this, (tag) => this.contentHandler.insertTagAtSelection(tag));
        this.toolbar = toolbar || new Toolbar(this);
        this.eventHandler = new EditorEventHandler(this);
        this.suggestionHandler = new SuggestionHandler(this);

        this.saveHandler = new EditorSaveHandler(this.app, this.persistentQueryCheckbox);
        this.menu = new EditorMenu(this.app, this.saveHandler);

        this.el.append(this.menu.getElement(), this.editorArea);
        this.menu.getElement().append(this.toolbar.getElement(), this.ontologyBrowser.getElement());

        this.tagManager = new TagManager(this.app, this.note);
        this.menu.getElement().append(this.tagManager);

        this.setupEditorEvents();

        this.save = (object) => {
            this.saveHandler.save(object);
        };
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

    setupEditorEvents() {
    }
}

export { Edit };
