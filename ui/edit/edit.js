import { createElement } from '../utils.js';
import { SuggestionDropdown } from './suggest.dropdown.js';
import { YjsHelper } from '../../core/yjs-helper.js';

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
        this.editor = createElement('div', {
            className: 'editor',
            contentEditable: true,
            spellcheck: false
        });
        this.editorArea.append(this.editor);
        this.el.append(this.editorArea);
    }

    renderDetailsArea() {
        this.detailsArea = createElement('div', {className: 'details-area'});
        this.el.append(this.detailsArea);
    }

    renderOntologyBrowser() {
        this.ontologyBrowser = this.app.createOntologyBrowser(this);
        this.el.append(this.ontologyBrowser.render(this.app.ontology));
    }

    renderTagEditArea() {
        this.tagEditArea = createElement('div', {className: 'tag-edit-area'});
        this.el.append(this.tagEditArea);
    }

    attachEventListeners() {
        this.editor.addEventListener('input', () => {
            YjsHelper.applyLocalChange(this.yDoc, () => {
                this.yText.set('content', this.editor.textContent);
            });
        });

        this.editor.addEventListener('keydown', (event) => {
            if (event.key === '@') {
                this.handleAtSymbol(event);
            } else if (this.suggestionDropdown.isVisible()) {
                if (event.key === 'Escape') {
                    this.suggestionDropdown.hide();
                    event.preventDefault();
                } else if (event.key === 'Enter' && this.suggestionDropdown.hasActiveSuggestion()) {
                    this.handleSuggestionSelection(event);
                } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    this.suggestionDropdown.navigateSuggestions(event.key);
                    event.preventDefault();
                }
            }
        });

        this.suggestionDropdown.onSuggestionSelected(suggestion => {
            this.handleSuggestionSelection(null, suggestion);
        });
    }


    renderContent() {
        this.editor.textContent = this.yText.get('content') || '';
    }


    handleAtSymbol(event) {
        const rect = this.editor.getBoundingClientRect();
        const caretPosition = this.getCaretPosition();
        const x = caretPosition.x - rect.left;
        const y = caretPosition.y - rect.top + 20;
        this.suggestionDropdown.show(x, y, this.editorArea,
            this.createAutosuggest(),
            (suggestion) => this.handleSuggestionSelection(event, suggestion)
        );
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
                suggestions.forEach(suggestion => {
                    this.suggestionDropdown.addSuggestion(suggestion.name, suggestion);
                });
            },

            onSuggestionSelected: (suggestion) => {
                this.handleSuggestionSelection(null, suggestion);
            }
        };
    }


    handleSuggestionSelection(event, suggestion) {
        if (event) {
            event.preventDefault();
        }
        const selectedTag = suggestion.name;
        this.insertTag(selectedTag);
        this.suggestionDropdown.hide();
    }


    insertTag(tagName) {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;
        const range = selection.getRangeAt(0);
        range.deleteContents();

        const tagText = document.createTextNode(`#${tagName} `);
        range.insertNode(tagText);

        range.collapse(false);
        selection.removeAllRanges();
        selection.addRange(range);
    }


    getCaretPosition() {
        let x = 0, y = 0;
        const selection = window.getSelection();
        if (selection.rangeCount) {
            const range = selection.getRangeAt(0).cloneRange();
            range.collapse(false);
            const rect = range.getBoundingClientRect();
            x = rect.left;
            y = rect.top;
        }
        return {x, y};
    }
}
