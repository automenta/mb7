import {createElement} from '../utils.js';
import {YjsHelper} from '../../core/yjs-helper';
import {SuggestionDropdown} from './suggest.dropdown.js';
import {Autosuggest} from './suggest.js';
import {OntologyBrowser} from './ontology-browser.js';
import {GenericForm} from '../generic-form.js';
import * as Y from 'yjs';
import './edit.css'; // Import CSS for Edit component

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
        this.autosuggest = new Autosuggest(this);
        this.selectedTag = null;
        this.tagYDoc = new Y.Doc();
        this.render();
        this.debouncedSaveContent = this.debounce(this.saveContent, 500); // Debounce saveContent
    }

    async render() {
        this.el.innerHTML = '';
        this.editorArea = createElement('div', {className: 'editor-area', contentEditable: true, spellCheck: false});
        this.el.appendChild(this.editorArea);
        this.autosuggest.apply();
        this.detailsArea = createElement('div', {className: 'details-area'});
        this.el.appendChild(this.detailsArea);
        this.ontologyBrowser = new OntologyBrowser(this, this.handleTagSelected.bind(this));
        this.el.appendChild(this.ontologyBrowser.getElement());
        this.ontologyBrowser.render(this.schema);
        this.tagEditArea = createElement('div', {className: 'tag-edit-area'}); // Removed inline style
        this.tagEditArea.style.display = 'none'; // Keep hiding logic in JS
        this.el.appendChild(this.tagEditArea);
        this.editorArea.addEventListener('input', () => this.autosuggest.debouncedApply());
        this.editorArea.addEventListener('keydown', (event) => this.autosuggest.handleKeyDown(event));
        this.el.addEventListener('notify', (event) => this.app.notificationManager.showNotification(event.detail.message, event.detail.type));

        // Initialize the editor with existing content and render tags
        this.renderContent();

        // Observe changes to the Yjs text and re-render the content
        this.yText.observe(() => this.renderContent());

        // Add a blur event listener to save the content when the editor loses focus
        this.editorArea.addEventListener('blur', () => this.debouncedSaveContent());
        // TODO [EDIT-2]: Implement proper cursor/selection preservation after re-rendering content - IMPROVED
    }

    /**
     * Saves the content of the editor to the database.
     */
    async saveContent() {
        this.note.content = this.serializeContent();
        await this.app.noteManager.saveObject(this.note);
    }

    // ... (rest of edit.js content - no changes needed in other functions) ...
}

export {Edit};
