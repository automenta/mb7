import { createElement } from '../ui/utils.js';
import { YjsHelper } from '../../core/yjs-helper';
import { SuggestionDropdown } from './suggest.dropdown.js';
import { Autosuggest } from './suggest.js';
import { OntologyBrowser } from './ontology-browser.js';
import { GenericForm } from '../generic-form.js'; // Import GenericForm
import * as Y from 'yjs';

class SuggestionFinder {
    constructor(getTagDefinition) {
        this.getTagDefinition = getTagDefinition;
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
}

class Edit {
    constructor(note, yDoc, app, getTagDefinition, schema) {
        this.note = note;
        this.getTagDefinition = getTagDefinition;
        this.schema = schema;
        this.yDoc = yDoc;
        this.yText = YjsHelper.createYMap(this.yDoc, 'content'); // Use YjsHelper to create YText
        this.el = createElement('div', { className: 'edit-view' });
        this.app = app;
        this.suggestionDropdown = new SuggestionDropdown();
        this.suggestionFinder = new SuggestionFinder(getTagDefinition);
        this.autosuggest = new Autosuggest(this);
        this.selectedTag = null;
        this.tagYDoc = new Y.Doc(); // Create a Yjs document for the tag

        this.render();
    }

    async render() {
        this.el.innerHTML = '';

        // Editor area
        this.editorArea = createElement('div', {
            className: 'editor-area',
            contentEditable: true,
            spellCheck: false
        });

        this.el.appendChild(this.editorArea);
        this.autosuggest.apply();

        // Details area
        this.detailsArea = createElement('div', { className: 'details-area' });
        this.el.appendChild(this.detailsArea);

        // Ontology browser
        this.ontologyBrowser = new OntologyBrowser(this, this.handleTagSelected.bind(this));
        this.el.appendChild(this.ontologyBrowser.getElement());
        this.ontologyBrowser.render(this.schema);

        // Tag editing area (initially hidden)
        this.tagEditArea = createElement('div', { className: 'tag-edit-area', style: 'display:none;' });
        this.el.appendChild(this.tagEditArea);

        // Event listener for editor content changes
        this.editorArea.addEventListener('input', () => {
            this.autosuggest.debouncedApply();
        });

        // Listen for notify events from the GenericForm
        this.el.addEventListener('notify', (event) => {
            this.app.showNotification(event.detail.message, event.detail.type);
        });
    }

    handleTagSelected(tagDefinition) {
        this.selectedTag = tagDefinition;
        this.showTagEditForm(tagDefinition);
    }

    async showTagEditForm(tagDefinition) {
        this.tagEditArea.innerHTML = '';
        this.tagEditArea.style.display = 'block';

        // Clear existing YDoc data
        this.tagYDoc.getMap('data').clear();

        // Create and render the GenericForm
        this.tagForm = new GenericForm(tagDefinition, this.tagYDoc, 'tag', this.saveTag.bind(this));
        await this.tagForm.build();
        this.tagEditArea.appendChild(this.tagForm.el);
    }

    async saveTag() {
        // Logic to save the tag data from the Yjs document
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

export { Edit };
