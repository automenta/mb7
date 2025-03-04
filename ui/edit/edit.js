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

    /**
     * Serializes the content from the editor area, converting HTML-like tags to plain text.
     * @returns {string} Plain text content.
     */
    serializeContent() {
        return this.editorArea.innerHTML;
    }

    /**
     * Renders the content into the editor area, parsing tags and applying formatting.
     */
    renderContent() {
        // Save cursor position
        const selection = window.getSelection();
        let range;
        if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        }

        this.editorArea.innerHTML = this.note.content;

        // Restore cursor position if a range was saved
        if (range) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }


    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    getElement() {
        return this.el;
    }

    handleTagSelected(tagDefinition) {
        if (this.selectedTag) {
            this.tagEditArea.style.display = 'none';
            this.tagEditArea.innerHTML = '';
            this.selectedTag = null;
        }

        this.selectedTag = tagDefinition;
        this.tagEditArea.style.display = 'block';

        const yTagMap = YjsHelper.createYMap(this.tagYDoc, tagDefinition.name);

        const form = new GenericForm(
            {tags: {[tagDefinition.name]: tagDefinition}},
            this.tagYDoc,
            this.note.id,
            () => { /* this.saveTag(tagDefinition.name); */ }, // Save callback - currently empty
            this.app // Pass the app instance
        );

        form.build().then(formElement => {
            this.tagEditArea.appendChild(formElement);
        });

        const saveButton = createElement('button', {className: 'save-button'}, 'Save Tag');
        saveButton.addEventListener('click', () => this.saveTag(tagDefinition.name));
        this.tagEditArea.appendChild(saveButton);

        const deleteTagButton = createElement('button', {className: 'delete-tag-button'}, 'Delete Tag');
        deleteTagButton.addEventListener('click', () => this.deleteTag(tagDefinition.name));
        this.tagEditArea.appendChild(deleteTagButton);
    }

    async saveTag(tagName) {
        const tagValue = this.tagYDoc.getMap('data').get(tagName);
        if (tagValue !== undefined) {
            // Assuming 'tags' is an array in your note object
            if (!this.note.tags) {
                this.note.tags = [];
            }
            const existingTagIndex = this.note.tags.findIndex(tag => tag.name === tagName);
            if (existingTagIndex > -1) {
                this.note.tags[existingTagIndex].value = tagValue; // Update existing tag
            } else {
                this.note.tags.push({name: tagName, value: tagValue}); // Add new tag
            }
            await this.app.noteManager.saveObject(this.note);
            this.app.notificationManager.showNotification(`Tag '${tagName}' saved successfully.`, 'success');
            this.tagEditArea.style.display = 'none';
            this.tagEditArea.innerHTML = '';
            this.selectedTag = null;
            this.tagYDoc = new Y.Doc(); // Clear the tag YDoc after saving
            this.renderContent(); // Re-render content to reflect tag changes
        } else {
            this.app.notificationManager.showNotification(`Value for tag '${tagName}' is undefined. Tag not saved.`, 'warning');
        }
    }


    async deleteTag(tagName) {
        if (this.note.tags) {
            const tagIndex = this.note.tags.findIndex(tag => tag.name === tagName);
            if (tagIndex > -1) {
                this.note.tags.splice(tagIndex, 1); // Remove tag
                await this.app.noteManager.saveObject(this.note);
                this.app.notificationManager.showNotification(`Tag '${tagName}' deleted successfully.`, 'success');
                this.tagEditArea.style.display = 'none';
                this.tagEditArea.innerHTML = '';
                this.selectedTag = null;
                this.tagYDoc = new Y.Doc(); // Clear the tag YDoc after deleting
                this.renderContent(); // Re-render content to reflect tag changes
            } else {
                this.app.notificationManager.showNotification(`Tag '${tagName}' not found in note.`, 'warning');
            }
        } else {
            this.app.notificationManager.showNotification(`No tags to delete in this note.`, 'info');
        }
    }
}

export {Edit};
