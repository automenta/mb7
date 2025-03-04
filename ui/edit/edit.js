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

            // Basic styling
            tagElement.style.backgroundColor = '#f0f0f0';
            tagElement.style.border = '1px solid #ccc';
            tagElement.style.borderRadius = '4px';
            tagElement.style.padding = '2px 4px';
            tagElement.style.margin = '2px';
            tagElement.style.cursor = 'pointer';

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
                this.app.showNotification(`Tag definition not found for tag name: ${tagData.name}`, 'warning');
            }
        } catch (error) {
            console.error("Error editing tag:", error);
            this.app.showNotification(`Error editing tag: ${error.message}`, 'error');
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
                for (const key in tagDefinition.tags) {
                    const tagDef = tagDefinition.tags[key];
                    let value = tagData[key];
                    if (value === undefined) {
                        value = tagDef.default;
                    }
                    if (tagDef.deserialize) {
                        try {
                            value = tagDef.deserialize(value);
                        } catch (error) {
                            console.error(`Error deserializing tag property ${key}:`, error);
                            this.app.showNotification(`Error deserializing tag property ${key}: ${error.message}`, 'error');
                            continue;
                        }
                    }
                    yMap.set(key, value || null); // Use null for undefined values
                }
                this.editingTagContent = tagContent; // Store the original tag content for updating
            } catch (error) {
                console.error("Error populating tag YDoc:", error);
                this.app.showNotification(`Error populating tag YDoc: ${error.message}`, 'error');
            }
        } else {
            this.editingTagContent = null;
        }

        this.tagForm = new GenericForm(tagDefinition, this.tagYDoc, 'tag', this.saveTag.bind(this));
        await this.tagForm.build();
        this.tagEditArea.appendChild(this.tagForm.el);

        // Add Delete Button
        const deleteButton = createElement('button', { className: 'delete-tag-button' }, 'Delete Tag');
        deleteButton.addEventListener('click', () => this.deleteTag());
        this.tagEditArea.appendChild(deleteButton);
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

        // If we are editing an existing tag, preserve its ID
        let tagId;
        if (this.editingTagContent) {
            try {
                const existingTagData = JSON.parse(this.editingTagContent);
                tagId = existingTagData.id;
            } catch (error) {
                console.error("Error parsing existing tag content:", error);
                this.app.showNotification(`Error parsing existing tag content: ${error.message}`, 'error');
                tagId = Math.random().toString(36).substring(2, 15); // Generate a new ID if parsing fails
            }
        } else {
            // Create a unique ID for the tag
            tagId = Math.random().toString(36).substring(2, 15);
        }
        tagData.id = tagId;
        tagData.name = this.selectedTag.label;

        // Serialize the tag data to JSON
        const tagContent = JSON.stringify(tagData);
        const tagPlaceholder = `[TAG:${tagContent}]`;

        // Get current cursor position
        let cursorPosition = this.editorArea.selectionStart;
        // Calculate the new cursor position
        let newCursorPosition = cursorPosition + tagPlaceholder.length;

        this.yDoc.transact(() => {
            if (this.editingTagContent) {
                // Replace the existing tag
                const text = this.yText.toString();
                const tagToReplace = `[TAG:${this.editingTagContent}]`;
                const index = text.indexOf(tagToReplace);
                if (index !== -1) {
                    this.yText.delete(index, tagToReplace.length);
                    this.yText.insert(index, tagPlaceholder);
                } else {
                    console.warn("Tag to replace not found in Yjs text!");
                    this.app.showNotification("Tag to replace not found in Yjs text!", 'warning');
                    this.yText.insert(cursorPosition, tagPlaceholder);
                }
            }
            else {
                // Insert the tag placeholder into the Yjs text
                this.yText.insert(cursorPosition, tagPlaceholder);
            }
        });

        console.log('tagData', tagData);
        this.editingTagContent = null; // Reset editingTagContent

        // Restore cursor position after tag insertion/replacement
        this.editorArea.focus();
        this.editorArea.setSelectionRange(newCursorPosition, newCursorPosition);
    }

    async deleteTag() {
        if (this.editingTagContent) {
            const text = this.yText.toString();
            const tagToDelete = `[TAG:${this.editingTagContent}]`;
            const index = text.indexOf(tagToDelete);

            if (index !== -1) {
                this.yDoc.transact(() => {
                    this.yText.delete(index, tagToDelete.length);
                });
            } else {
                console.warn("Tag to delete not found in Yjs text!");
                this.app.showNotification("Tag to delete not found in Yjs text!", 'warning');
            }

            this.tagEditArea.style.display = 'none';
            this.editingTagContent = null;
        }
    }
}
