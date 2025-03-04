import {createElement} from '../utils.js';
import {YjsHelper} from '../../core/yjs-helper';
import {SuggestionDropdown} from './suggest.dropdown.js';
import {Autosuggest} from './suggest.js';
import {OntologyBrowser} from './ontology-browser.js';
import {GenericForm} from '../generic-form.js';
import * as Y from 'yjs';
import './edit.css';

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
        this.debouncedSaveContent = this.debounce(this.saveContent, 500);
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
    }

    renderEditorArea() {
        this.editorArea = createElement('div', {className: 'editor-area', contentEditable: true, spellCheck: false});
        this.el.appendChild(this.editorArea);
        this.autosuggest.apply();
    }

    renderDetailsArea() {
        this.detailsArea = createElement('div', {className: 'details-area'});
        this.el.appendChild(this.detailsArea);
    }

    renderOntologyBrowser() {
        this.ontologyBrowser = new OntologyBrowser(this, this.handleTagSelected.bind(this));
        this.el.appendChild(this.ontologyBrowser.getElement());
        this.ontologyBrowser.render(this.schema);
    }

    renderTagEditArea() {
        this.tagEditArea = createElement('div', {className: 'tag-edit-area'});
        this.tagEditArea.style.display = 'none';
        this.el.appendChild(this.tagEditArea);
    }

    attachEventListeners() {
        this.editorArea.addEventListener('input', () => this.autosuggest.debouncedApply());
        this.editorArea.addEventListener('keydown', (event) => this.autosuggest.handleKeyDown(event));
        this.el.addEventListener('notify', (event) => this.app.notificationManager.showNotification(event.detail.message, event.detail.type));
        this.editorArea.addEventListener('blur', () => this.debouncedSaveContent());
    }

    async saveContent() {
        this.note.content = this.serializeContent();
        await this.app.noteManager.saveObject(this.note);
    }

    serializeContent() {
        return this.editorArea.innerHTML;
    }

    renderContent() {
        const selection = window.getSelection();
        let range;
        if (selection.rangeCount > 0) {
            range = selection.getRangeAt(0);
        }

        this.editorArea.innerHTML = this.note.content;

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
            this.clearTagEditArea();
        }

        this.selectedTag = tagDefinition;
        this.showTagEditArea();
        this.renderTagForm(tagDefinition);
        this.renderTagActions();
    }

    clearTagEditArea() {
        this.tagEditArea.style.display = 'none';
        this.tagEditArea.innerHTML = '';
        this.selectedTag = null;
        this.tagYDoc = new Y.Doc();
    }

    showTagEditArea() {
        this.tagEditArea.style.display = 'block';
    }

    renderTagForm(tagDefinition) {
        const form = new GenericForm(
            {tags: {[tagDefinition.name]: tagDefinition}},
            this.tagYDoc,
            this.note.id,
            () => {},
            this.app
        );

        form.build().then(formElement => {
            this.tagEditArea.appendChild(formElement);
        });
    }

    renderTagActions() {
        const saveButton = createElement('button', {className: 'save-button'}, 'Save Tag');
        saveButton.addEventListener('click', () => this.saveTag(this.selectedTag.name));
        this.tagEditArea.appendChild(saveButton);

        const deleteTagButton = createElement('button', {className: 'delete-tag-button'}, 'Delete Tag');
        deleteTagButton.addEventListener('click', () => this.deleteTag(this.selectedTag.name));
        this.tagEditArea.appendChild(deleteTagButton);
    }

    async saveTag(tagName) {
        const tagValue = this.tagYDoc.getMap('data').get(tagName);
        if (tagValue !== undefined) {
            if (!this.note.tags) {
                this.note.tags = [];
            }
            const existingTagIndex = this.note.tags.findIndex(tag => tag.name === tagName);
            if (existingTagIndex > -1) {
                this.note.tags[existingTagIndex].value = tagValue;
            } else {
                this.note.tags.push({name: tagName, value: tagValue});
            }
            await this.app.noteManager.saveObject(this.note);
            this.app.notificationManager.showNotification(`Tag '${tagName}' saved successfully.`, 'success');
            this.clearTagEditArea();
            this.renderContent();
        } else {
            this.app.notificationManager.showNotification(`Value for tag '${tagName}' is undefined. Tag not saved.`, 'warning');
        }
    }


    async deleteTag(tagName) {
        if (this.note.tags) {
            const tagIndex = this.note.tags.findIndex(tag => tag.name === tagName);
            if (tagIndex > -1) {
                this.note.tags.splice(tagIndex, 1);
                await this.app.noteManager.saveObject(this.note);
                this.app.notificationManager.showNotification(`Tag '${tagName}' deleted successfully.`, 'success');
                this.clearTagEditArea();
                this.renderContent();
            } else {
                this.app.notificationManager.showNotification(`Tag '${tagName}' not found in note.`, 'warning');
            }
        } else {
            this.app.notificationManager.showNotification(`No tags to delete in this note.`, 'info');
        }
    }
}

export {Edit};
