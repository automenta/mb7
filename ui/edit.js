import { UnifiedOntology } from '../core/ontology.js';
import DOMPurify from 'dompurify';
import * as Y from 'yjs';
import { DB, getNotesIndex, updateNotesIndex } from '../core/db';
import { ErrorHandler } from '../core/error-handler.js';
import { Autosuggest } from './autosuggest.js';
import { Toolbar } from './edit.toolbar.js';
import { OntologyBrowser } from './ontology-browser.js';
import { SuggestionDropdown } from './suggestion-dropdown.js';
import { EditorContentHandler } from './edit.content';

import { createElement, debounce } from './utils.js';

const tagDataMap = new WeakMap();

class Edit {
    constructor() {
        this.ontology = UnifiedOntology;
        this.errorHandler = new ErrorHandler(this);
        this.db = new DB(this.errorHandler);
        this.yDoc = new Y.Doc();
        //this.indexeddbPersistence = new IndexeddbPersistence('yjs-indexeddb-provider', this.yDoc); //TODO move this to DB or Net?
        this.yText = this.yDoc.getText('content');

        this.editorArea = createElement("div", { contenteditable: "true", class: "editor-area" });
        const menu = createElement('div');
        this.el = createElement('div');
        this.el.append(menu, this.editorArea);

        this.suggestionDropdown = new SuggestionDropdown();
        this.ontologyBrowser = new OntologyBrowser(this.ontology, (tag) => this.contentHandler.insertTagAtSelection(tag));
        this.toolbar = new Toolbar(this);
        this.autosuggest = new Autosuggest(this);
        this.contentHandler = new EditorContentHandler(this);

        const ontologyBrowserButton = createElement('button', { textContent: 'Show Ontology', class: 'toggle-ontology-button' });
        menu.append(this.toolbar.getElement(), ontologyBrowserButton, this.ontologyBrowser.getElement());
        this.ontologyBrowser.getElement().style.display = 'none';

        ontologyBrowserButton.addEventListener('click', () => {
            const isVisible = this.ontologyBrowser.getElement().style.display !== 'none';
            this.ontologyBrowser.getElement().style.display = isVisible ? 'none' : 'block';
            ontologyBrowserButton.textContent = isVisible ? 'Show Ontology' : 'Hide Ontology';
        });
        menu.append(this.toolbar.getElement(), this.ontologyBrowser.getElement());

        this.setupEditorEvents();
        this.editorArea.focus();
        this.loadYDoc();
    }

    async loadYDoc() {
        const yDoc = await this.db.getYDoc(this.yText.toString());
        if (yDoc) {
            this.yDoc.transact(() => {
                this.yText.delete(0, this.yText.length);
                this.yText.insert(0, yDoc.getText('content').toString())
            })
        }
    }

    async updateNotesIndex() {
        try {
            const currentId = this.yText.toString();
            const index = await getNotesIndex();
            const newIndex = index.includes(currentId) ? index : [...index, currentId];
            await updateNotesIndex(newIndex);
        } catch (error) {
            console.error('Error updating notes index:', error);
        }
    }

    setupEditorEvents() {
        const handleDropdownKeys = this.handleDropdownKeys.bind(this);
        this.editorArea.addEventListener("keyup", () => {
            if (this.suggestionDropdown.el.style.display !== 'block') {
                this.autosuggest.debouncedApply();
            }
            // Store last valid range after keyup
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.editorArea.contains(selection.anchorNode)) {
                this.contentHandler.lastValidRange = selection.getRangeAt(0).cloneRange();
            }
        });

        this.editorArea.addEventListener("click", (e) => {
            if (e.target.classList.contains("autosuggest")) {
                e.stopPropagation();
                this.showSuggestionsForSpan(e.target);
            }
            // Store last valid range after click inside editorArea
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.editorArea.contains(selection.anchorNode)) {
                this.contentHandler.lastValidRange = selection.getRangeAt(0).cloneRange();
            }
        });
        this.editorArea.addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault() || this.contentHandler.insertLineBreak()));
        document.addEventListener("keydown", handleDropdownKeys);
        document.addEventListener("click", (e) => {
            if (!this.editorArea.contains(e.target) && !this.ontologyBrowser.getElement().contains(e.target) && !this.suggestionDropdown.el.contains(e.target)) {
                this.suggestionDropdown.hide();
            }
        });
    }

    showSuggestionsForSpan(span) {
        const suggestions = [];
        const word = span.textContent.toLowerCase();
        for (const category in this.ontology) {
            for (const tag of this.ontology[category]) {
                if (tag.name.toLowerCase().startsWith(word)) {
                    suggestions.push({ displayText: tag.name, tagData: tag, span });
                }
            }
        }
        const rect = span.getBoundingClientRect();
        this.suggestionDropdown.show(suggestions, rect.left + window.scrollX, rect.bottom + window.scrollY, this.contentHandler.insertTagFromSuggestion.bind(this.contentHandler)); // Use bind for correct 'this'
    }

    matchesOntology(word) {
        return Object.values(this.ontology).flat().some(tag => tag && tag.name && tag.name.toLowerCase().startsWith(word.toLowerCase()));
    }

    getContent() {
        return this.yText.toString();
    }

    setContent(html) {
        this.yDoc.transact(() => {
            this.yText.delete(0, this.yText.length);
            this.yText.insert(0, html);
        });
        this.editorArea.innerHTML = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ["br", "b", "i", "span", "u"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id"]
        });
        this.autosuggest.apply(); // Apply autosuggest after setting content.
        this.db.saveYDoc(this.yText.toString(), this.yDoc);
        this.updateNotesIndex();
    }

    getName() {
        // Extract first line as note name
        const firstLine = this.yText.toString().split('\n')[0];
        return firstLine || 'Untitled Note';
    }


    findSuggestion(name) {
        for (const cat in this.ontology) {
            for (const t of this.ontology[cat]) {
                if (t.name === name) return { displayText: t.name, tagData: t };
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
}

export { Edit };
