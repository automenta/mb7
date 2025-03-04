ui/edit/edit.js
import * as Y from 'yjs';
import { YjsHelper } from '../yjs-helper.js';
import { createElement } from '../utils.js';
import { SuggestionDropdown } from './suggestion-dropdown.js';
import { OntologyBrowser } from './ontology-browser.js';
import { renderContent } from '../content-view-renderer.js';
import { TagManager } from '../tag-manager.js';
import { EditToolbar } from './edit.toolbar.js';


class Edit {
    constructor(note, yDoc, app, getTagDefinition, schema) {
        this.note = note;
        this.getTagDefinition = getTagDefinition;
        this.schema = schema;
        this.yDoc = yDoc;
        this.yText = YjsHelper.createYMap(this.yDoc, 'content');
        this.el = createElement('div', {className: 'edit-view'});
        this.app = app;
        this.suggestionDropdown = new SuggestionDropdown();
        this.autosuggest = this.createAutosuggest();
        this.ontologyBrowser = new OntologyBrowser(this, this.handleTagSelection.bind(this));
        this.tagManager = new TagManager(note, app, getTagDefinition);
        this.editToolbar = new EditToolbar(this);
    }


    render() {
        this.el.innerHTML = '';
        this.renderEditorArea();
        this.renderDetailsArea();
        this.renderOntologyBrowser();
        this.renderTagEditArea();
        this.attachEventListeners();
        this.renderContent();
        this.yText.observe(() => this.renderContent());
        return this.el;
    }


    renderEditorArea() {
        this.editorArea = createElement('div', {className: 'editor-area'});
        this.editorArea.contentEditable = true;
        this.editorArea.setAttribute('contenteditable', 'true');
        this.editorArea.setAttribute('spellcheck', 'true');
        this.editorArea.setAttribute('autocorrect', 'true');
        this.editorArea.setAttribute('autocomplete', 'off');
        this.editorArea.setAttribute('data-gramm_editor', 'false');
        this.el.appendChild(this.editorArea);
    }

    renderDetailsArea() {
        this.detailsArea = createElement('div', {className: 'details-area'});
        this.detailsArea.innerHTML = `<h2>Details</h2>`;
        this.el.appendChild(this.detailsArea);
    }

    renderOntologyBrowser() {
        this.ontologyBrowserContainer = createElement('div', {className: 'ontology-browser-container'});
        this.ontologyBrowserContainer.appendChild(this.ontologyBrowser.container);
        this.el.appendChild(this.ontologyBrowserContainer);
    }

    renderTagEditArea() {
        this.tagEditArea = createElement('div', {className: 'tag-edit-area'});
        this.tagEditArea.appendChild(this.tagManager.render());
        this.el.appendChild(this.tagEditArea);
    }


    attachEventListeners() {
        this.editorArea.addEventListener('input', () => this.handleInput());
        this.editorArea.addEventListener('keydown', (event) => this.handleKeyDown(event));
        this.editorArea.addEventListener('keyup', () => this.handleInput());
    }


    renderContent() {
        this.editorArea.innerHTML = '';
        this.editorArea.appendChild(renderContent(this.yText));
    }


    handleInput() {
        const text = this.editorArea.textContent;
        this.yDoc.transact(() => {
            this.yText.delete(0, this.yText.length);
            this.yText.insert(0, text);
        });
    }


    handleKeyDown(event) {
        if (event.key === 'Enter') {
            this.handleInput();
            event.preventDefault();
        }
        if (event.key === ' ' && this.suggestionDropdown.isVisible()) {
            event.preventDefault();
            const selectedSuggestion = this.suggestionDropdown.getSelectedSuggestion();
            if (selectedSuggestion) {
                this.applySuggestion(selectedSuggestion);
            }
            this.suggestionDropdown.hide();
        }
        if (event.key === 'Escape' && this.suggestionDropdown.isVisible()) {
            this.suggestionDropdown.hide();
        }
        if (event.key === 'ArrowDown' && this.suggestionDropdown.isVisible()) {
            event.preventDefault();
            this.suggestionDropdown.selectNextSuggestion();
        }
        if (event.key === 'ArrowUp' && this.suggestionDropdown.isVisible()) {
            event.preventDefault();
            this.suggestionDropdown.selectPreviousSuggestion();
        }
    }


    createAutosuggest() {
        return {
            suggestTags: async (query) => {
                const suggestions = Object.keys(this.app.ontology)
                    .filter(tagName => tagName.toLowerCase().startsWith(query.toLowerCase()))
                    .map(tagName => ({ name: tagName }));
                return suggestions;
            },

            renderSuggestions: (suggestions) => {
                this.suggestionDropdown.clear();
                if (suggestions.length > 0) {
                    suggestions.forEach(suggestion => {
                        this.suggestionDropdown.addSuggestion(suggestion);
                    });
                    this.suggestionDropdown.show(this.editorArea);
                } else {
                    this.suggestionDropdown.hide();
                }
            },

            clearSuggestions: () => {
                this.suggestionDropdown.clear();
                this.suggestionDropdown.hide();
            }
        };
    }


    async handleTagSelection(tagName) {
        const tagDef = this.getTagDefinition(tagName);
        if (tagDef) {
            this.tagManager.addTag(tagName, tagDef);
        } else {
            console.warn(`No tag definition found for ${tagName}`);
        }
    }


    applySuggestion(suggestion) {
        const cursorPosition = this.editorArea.selectionStart;
        const textBeforeCursor = this.editorArea.textContent.substring(0, cursorPosition);
        const lastWordMatch = textBeforeCursor.match(/(\w+)$/);
        if (lastWordMatch) {
            const wordToReplace = lastWordMatch[1];
            const replacementText = suggestion.name + ' ';
            const newText = textBeforeCursor.replace(/(\w+)$/, replacementText) + this.editorArea.textContent.substring(cursorPosition);

            this.yDoc.transact(() => {
                this.yText.delete(0, this.yText.length);
                this.yText.insert(0, newText);
            });
            this.renderContent();
            const newCursorPosition = textBeforeCursor.length - wordToReplace.length + replacementText.length;
            this.editorArea.focus();
            document.getSelection().collapse(this.editorArea.childNodes[0], newCursorPosition);

        }
    }


    async triggerAutosuggest(query) {
        if (query.trim() === '') {
            this.autosuggest.clearSuggestions();
            return;
        }

        try {
            const suggestions = await this.autosuggest.suggestTags(query);
            this.autosuggest.renderSuggestions(suggestions);
        } catch (error) {
            console.error("Error fetching suggestions:", error);
        }
    }
}

export { Edit };
