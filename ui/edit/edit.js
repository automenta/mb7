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

        // Initialize the editor with existing content and render tags
        this.renderContent();

        // Observe changes to the Yjs text and re-render the content
        this.yText.observe(() => this.renderContent());
    }

    renderContent() {
        // Clear the editor area
        this.editorArea.innerHTML = '';

        // Get the current text from Yjs
        const text = this.yText.toString();

        // Regular expression to find tag placeholders
        const tagRegex = /\[TAG:([^\]]*)\]/g;
        let match;
        let lastIndex = 0;

        while ((match = tagRegex.exec(text)) !== null) {
            // Add the text before the tag
            if (match.index > lastIndex) {
                this.editorArea.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));
            }

            // Extract the tag content
            const tagContent = match[1];

            // Render the tag
            const tagElement = this.renderTag(tagContent);
            if (tagElement) {
                this.editorArea.appendChild(tagElement);
            } else {
                // If tag rendering fails, display the original tag content as text
                this.editorArea.appendChild(document.createTextNode(match[0]));
            }

            lastIndex = tagRegex.lastIndex;
        }

        // Add the remaining text after the last tag
        if (lastIndex < text.length) {
            this.editorArea.appendChild(document.createTextNode(text.substring(lastIndex)));
        }
    }

    renderTag(tagContent) {
        try {
            // Deserialize the tag content
            const tagData = JSON.parse(tagContent);

            // Create a span element for the tag
            const tagElement = document.createElement('span');
            tagElement.className = 'tag-element';
            tagElement.textContent = tagData.name; // Display the tag name

            // Add a data attribute to store the tag content
            tagElement.dataset.tagContent = tagContent;

            // Make the tag editable
            tagElement.addEventListener('click', () => {
                this.editTag(tagContent);
            });

            return tagElement;
        } catch (error) {
            console.error("Error rendering tag:", error);
            return null;
        }
    }

    editTag(tagContent) {
        try {
            const tagData = JSON.parse(tagContent);
            const tagDefinition = this.getTagDefinition(tagData.name); // Assuming tagData.name holds the tag definition name
            if (tagDefinition) {
                this.selectedTag = tagDefinition;
                this.showTagEditForm(tagDefinition, tagContent); // Pass tagContent to showTagEditForm
            } else {
                console.warn(`Tag definition not found for tag name: ${tagData.name}`);
            }
        } catch (error) {
            console.error("Error editing tag:", error);
        }
    }

    handleTagSelected(tagDefinition) {
        this.selectedTag = tagDefinition;
        this.showTagEditForm(tagDefinition);
    }

    async showTagEditForm(tagDefinition, tagContent = null) {
        this.tagEditArea.innerHTML = '';
        this.tagEditArea.style.display = 'block';
        this.tagYDoc.getMap('data').clear();

        // If tagContent is provided, populate the tagYDoc with the existing tag data
        if (tagContent) {
            try {
                const tagData = JSON.parse(tagContent);
                const yMap = this.tagYDoc.getMap('data');
                for (const key in tagData) {
                    if (key !== 'id' && key !== 'name' && tagDefinition.tags[key]) {
                        yMap.set(key, tagData[key]);
                    }
                }
            } catch (error) {
                console.error("Error populating tag YDoc:", error);
            }
        }

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

        // Create a unique ID for the tag
        const tagId = Math.random().toString(36).substring(2, 15);
        tagData.id = tagId;
        tagData.name = this.selectedTag.label;

        // Serialize the tag data to JSON
        const tagContent = JSON.stringify(tagData);

        // Insert the tag placeholder into the Yjs text
        const tagPlaceholder = `[TAG:${tagContent}]`;
        this.yDoc.transact(() => {
            this.yText.insert(this.editorArea.selectionStart, tagPlaceholder);
        });

        console.log('tagData', tagData);
    }
}
