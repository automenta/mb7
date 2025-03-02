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
    constructor() {
        this.ontology = UnifiedOntology;
        this.errorHandler = new ErrorHandler(this);
        this.db = new DB(this.errorHandler);
        this.yDoc = new Y.Doc();
        this.yText = this.yDoc.getText('content');
        this.yName = this.yDoc.getText('name');

        this.el = document.createElement('div');
        this.el.className = 'edit-view';

        // Name input
        this.nameInput = document.createElement('input');
        this.nameInput.type = 'text';
        this.nameInput.placeholder = 'Note Title';
        this.el.appendChild(this.nameInput);

        // Content editor
        this.contentEditor = document.createElement('div');
        this.contentEditor.className = 'content-editor';
        this.contentEditor.contentEditable = 'true';
        this.el.appendChild(this.contentEditor);

        this.contentEditor.addEventListener('input', debounce(() => {
            this.setContent(this.contentEditor.innerHTML);
        }, 300));

        this.nameInput.addEventListener('input', () => {
            this.setName(this.nameInput.value);
        });

        this.editorArea = createElement("div", {contenteditable: "true", class: "editor-area"});
        const menu = createElement('div');
        this.el = createElement('div');
        this.el.append(menu, this.editorArea);

        this.suggestionDropdown = new SuggestionDropdown();
        this.editor = this;
        this.autosuggest = new Autosuggest(this);
        this.contentHandler = new EditorContentHandler(this, this.autosuggest);
        this.ontologyBrowser = new OntologyBrowser(this, (tag) => this.contentHandler.insertTagAtSelection(tag));
        this.toolbar = new Toolbar(this);

        menu.append(this.toolbar.getElement(), this.ontologyBrowser.getElement());

        this.setupEditorEvents();

        this.loadYDoc().then(() => {
            this.editorArea.focus();
        });
    }

    setName(name) {
        this.nameInput.value = name;
        console.log('setName called', name);
        this.yDoc.transact(() => {
            this.yName.delete(0, this.yName.length);
            this.yName.insert(0, name);
        });
    }

    setContent(html) {
        console.log('setContent called', html);
        this.yDoc.transact(() => {
            this.yText.delete(0, this.yText.length);
            this.yText.insert(0, html);
        });

        this.editorArea.innerHTML = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ["br", "b", "i", "span", "u"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id"]
        });
        this.editor.autosuggest.apply(); // Use content handler
        this.db.saveYDoc(this.yText.toString(), this.yDoc);
        this.updateNotesIndex();
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

    async loadYDoc() {
        try {
            const yDoc = await this.db.getYDoc(this.yText.toString());
            if (yDoc) {
                this.yDoc.transact(() => {
                    this.yText.delete(0, this.yText.length);
                    this.yText.insert(0, yDoc.getText('content').toString())
                })
            }
        } catch (error) {
            console.error("Failed to load YDoc:", error);
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
        this.editorArea.addEventListener("keyup", debounce(() => {
            if (this.suggestionDropdown.el.style.display !== 'block') {
                this.editor.autosuggest.apply(); // Call on content handler
            }
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.editorArea.contains(selection.anchorNode)) {
                this.contentHandler.lastValidRange = selection.getRangeAt(0).cloneRange();
            }
        }, 300));

        this.editorArea.addEventListener("click", (e) => {
            if (e.target.classList.contains("autosuggest")) {
                e.stopPropagation();
                this.showSuggestionsForSpan(e.target);
            }
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.editorArea.contains(selection.anchorNode)) {
                this.contentHandler.lastValidRange = selection.getRangeAt(0).cloneRange();
            }
        });

        this.editorArea.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.contentHandler.insertLineBreak();
            }
        });

        document.addEventListener("keydown", this.handleDropdownKeys.bind(this));

        document.addEventListener("click", (e) => {
            if (!this.editorArea.contains(e.target) &&
                !this.ontologyBrowser.getElement().contains(e.target) &&
                !this.suggestionDropdown.el.contains(e.target)) {
                this.suggestionDropdown.hide();
            }
        });
    }

    showSuggestionsForSpan(span) {
        const suggestions = [];
        const word = span.textContent.toLowerCase();
        for (const categoryName in this.ontology) {
            const category = this.ontology[categoryName];
            if (category.instances) {
                for (const tag of category.instances) {
                    if (tag.name.toLowerCase().startsWith(word)) {
                        suggestions.push({displayText: tag.name, tagData: tag, span});
                    }
                }
            } else if (this.ontology[categoryName].name?.toLowerCase().startsWith(word)) {
                suggestions.push({displayText: this.ontology[categoryName].name, tagData: this.ontology[categoryName]});
            }
        }
        const rect = span.getBoundingClientRect();
        // Use the content handler's method for consistency
        this.suggestionDropdown.show(suggestions, rect.left + window.scrollX, rect.bottom + window.scrollY, this.contentHandler.insertTagFromSuggestion.bind(this.contentHandler));
    }

    matchesOntology(word) {
        return Object.values(this.ontology).flat().some(tag => tag?.name?.toLowerCase().startsWith(word.toLowerCase()));
    }
}

export {Edit};
