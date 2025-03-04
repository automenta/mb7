import { createElement } from '../ui/utils.js';
import { YjsHelper } from '../../core/yjs-helper';
import { SuggestionDropdown } from './suggest.dropdown.js';
import { Autosuggest } from './suggest.js';
import { OntologyBrowser } from './ontology-browser.js';
import { GenericForm } from '../generic-form.js';
import * as Y from 'yjs';

class Edit {
    constructor(note, yDoc, app, getTagDefinition, schema) {
        this.note = note;
        this.getTagDefinition = getTagDefinition;
        this.schema = schema;
        this.yDoc = yDoc;
        this.yText = YjsHelper.createYMap(this.yDoc, 'content');
        this.el = createElement('div', { className: 'edit-view' });
        this.app = app;
        this.suggestionDropdown = new SuggestionDropdown();
        this.autosuggest = new Autosuggest(this);
        this.selectedTag = null;
        this.tagYDoc = new Y.Doc();
        this.render();
    }

    async render() {
        this.el.innerHTML = '';
        this.editorArea = createElement('div', { className: 'editor-area', contentEditable: true, spellCheck: false });
        this.el.appendChild(this.editorArea);
        this.autosuggest.apply();
        this.detailsArea = createElement('div', { className: 'details-area' });
        this.el.appendChild(this.detailsArea);
        this.ontologyBrowser = new OntologyBrowser(this, this.handleTagSelected.bind(this));
        this.el.appendChild(this.ontologyBrowser.getElement());
        this.ontologyBrowser.render(this.schema);
        this.tagEditArea = createElement('div', { className: 'tag-edit-area', style: 'display:none;' });
        this.el.appendChild(this.tagEditArea);
        this.editorArea.addEventListener('input', () => this.autosuggest.debouncedApply());
        this.editorArea.addEventListener('keydown', (event) => this.autosuggest.handleKeyDown(event));
        this.el.addEventListener('notify', (event) => this.app.showNotification(event.detail.message, event.detail.type));
    }

    handleTagSelected(tagDefinition) {
        this.selectedTag = tagDefinition;
        this.showTagEditForm(tagDefinition);
    }

    async showTagEditForm(tagDefinition) {
        this.tagEditArea.innerHTML = '';
        this.tagEditArea.style.display = 'block';
        this.tagYDoc.getMap('data').clear();
        this.tagForm = new GenericForm(tagDefinition, this.tagYDoc, 'tag', this.saveTag.bind(this));
        await this.tagForm.build();
        this.tagEditArea.appendChild(this.tagForm.el);
    }

    async saveTag() {
        console.log('Saving tag data...');
        const tagData = {};
        const yMap = this.tagYDoc.getMap('data');
        for (const key in this.selectedTag.tags) {
            const tagDefinition = this.selectedTag.tags[key];
            const yValue = yMap.get(key);
            tagData[key] = tagDefinition.deserialize(yValue !== undefined ? yValue : tagDefinition.default);
        }
        console.log('tagData', tagData);
        // TODO: Integrate the tagData into the main note's Yjs document
    }
}
