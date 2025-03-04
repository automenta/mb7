import {createElement} from '../utils.js';
import {YjsHelper} from '../../core/yjs-helper';
import {SuggestionDropdown} from './suggest.dropdown.js';
import {Autosuggest} from './suggest.js';
import {OntologyBrowser} from './ontology-browser.js';
import {GenericForm} from '../generic-form.js';
import * as Y from 'yjs';

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
        this.tagEditArea = createElement('div', {className: 'tag-edit-area', style: 'display:none;'});
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
        // TODO [EDIT-2]: Implement proper cursor/selection preservation after re-rendering content
    }

    /**
     * Saves the content of the editor to the database.
     */
    async saveContent() {
        this.note.content = this.serializeContent();
        await this.app.noteManager.saveObject(this.note);
    }

    /**
     * Serializes the content of the editor area, including text and tags.
     * @returns {string} - The serialized content of the editor area.
     */
    serializeContent() {
        let content = '';
        for (let i = 0; i < this.editorArea.childNodes.length; i++) {
            const node = this.editorArea.childNodes[i];
            if (node.nodeType === Node.TEXT_NODE) {
                content += node.textContent;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                if (node.classList.contains('tag-element')) {
                    content += `[TAG:${node.dataset.tagContent}]`;
                } else if (node.tagName === 'BR') {
                    content += '\n';
                }
            }
        }
        return content;
    }

    /**
     * Renders the content of the editor area, including text and tags.
     */
    renderContent() {
        // Save current cursor position
        let cursorOffset = null; // Initialize to null
        const selection = window.getSelection();
        if (selection.rangeCount > 0 && document.activeElement === this.editorArea) { // Check if editorArea is focused
            const range = selection.getRangeAt(0);
            const preCaretRange = range.cloneRange();
            preCaretRange.selectNodeContents(this.editorArea);
            preCaretRange.setEnd(range.endContainer, range.endOffset);
            cursorOffset = preCaretRange.toString().length;
        }

        // Clear the editor area
        this.editorArea.innerHTML = '';

        // Get the current text from Yjs
        const text = this.yText.toString();

        // Regular expression to find tag placeholders
        const tagRegex = /\[TAG:([^\]]*)\]/g;
        let match;
        let lastIndex = 0;
        let textIndex = 0; // Track index in the combined text content

        // Array to store text nodes and their lengths
        const textNodes = [];

        // Iterate over the text, finding and rendering tags
        while ((match = tagRegex.exec(text)) !== null) {
            // Add the text before the tag
            if (match.index > lastIndex) {
                const textContent = text.substring(lastIndex, match.index);
                const textNode = document.createTextNode(textContent);
                this.editorArea.appendChild(textNode);
                textNodes.push({node: textNode, length: textContent.length, startIndex: textIndex});
                textIndex += textContent.length;
            }

            // Extract the tag content (the JSON string)
            const tagContent = match[1];
            const tagData = JSON.parse(tagContent); // Parse tagData here to access ui.render

            // Render the tag
            let tagElement;
            if (tagData.ui && tagData.ui.render === "stub") { // Check for ui.render === "stub"
                tagElement = this.renderTagStub(tagContent); // Use renderTagStub for stubs
            } else {
                tagElement = this.renderTag(tagContent); // Default renderTag for other tags
            }


            if (tagElement) {
                this.editorArea.appendChild(tagElement);
            } else {
                // If tag rendering fails, display the original tag content as text
                this.editorArea.appendChild(document.createTextNode(match[0]));
            }

            // Update the last index to the end of the tag
            lastIndex = tagRegex.lastIndex;
        }

        // Add the remaining text after the last tag
        if (lastIndex < text.length) {
            const textContent = text.substring(lastIndex);
            const textNode = document.createTextNode(textContent);
            this.editorArea.appendChild(textNode);
            textNodes.push({node: textNode, length: textContent.length, startIndex: textIndex});
            textIndex += textContent.length;
        }

        // Restore cursor position
        if (cursorOffset !== null) {
            let nodeFound = null;
            let offsetInNode = 0;
            let accumulatedLength = 0;

            for (const textNodeInfo of textNodes) {
                if (cursorOffset >= accumulatedLength && cursorOffset <= accumulatedLength + textNodeInfo.length) {
                    nodeFound = textNodeInfo.node;
                    offsetInNode = cursorOffset - accumulatedLength;
                    break;
                }
                accumulatedLength += textNodeInfo.length;
            }

            if (nodeFound) {
                try {
                    const range = document.createRange();
                    range.setStart(nodeFound, offsetInNode);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (error) {
                    console.error("Error restoring cursor position:", error);
                    // Fallback: focus at the end if range creation fails
                    this.editorArea.focus();
                    selection.collapse(this.editorArea, this.editorArea.childNodes.length);
                    return;
                }

            } else if (textNodes.length > 0) {
                // Fallback: if cursorOffset is beyond text length, put cursor at the end
                const lastTextNodeInfo = textNodes[textNodes.length - 1];
                try {
                    const range = document.createRange();
                    range.setStart(lastTextNodeInfo.node, lastTextNodeInfo.length);
                    range.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(range);
                } catch (error) {
                    console.error("Error restoring cursor position to end:", error);
                    // Even more basic fallback: focus at the end of editor
                    this.editorArea.focus();
                    selection.collapse(this.editorArea, this.editorArea.childNodes.length);
                    return;
                }
            } else {
                // If no text nodes, focus at the beginning of the editor
                this.editorArea.focus();
            }
        } else {
            // If no previous cursor position, focus at the end
            this.editorArea.focus();
        }
    }

    /**
     * Renders a single tag element from the given tag content.
     * @param {string} tagContent - The JSON string representing the tag data.
     * @returns {HTMLElement | null} - The rendered tag element, or null if rendering fails.
     */
    renderTag(tagContent) {
        try {
            // Deserialize the tag content
            const tagData = JSON.parse(tagContent);

            // Create a span element for all tags for minimal rendering (EDIT-RENDER-1)
            const tagElement = createElement('span', {className: 'tag-element'}, `[${tagData.name}]`);

            // Add a data attribute to store the tag content
            tagElement.dataset.tagContent = tagContent;
            tagElement.setAttribute('aria-label', `Edit tag: ${tagData.name}`); // Accessibility

            // Make the tag editable
            tagElement.addEventListener('click', () => {
                this.editTag(tagContent);
            });

            // Basic styling for span tag (EDIT-RENDER-1)
            tagElement.style.backgroundColor = '#eee';
            tagElement.style.color = '#555';
            tagElement.style.border = '1px dashed #ccc';
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

    /**
     * Renders a stub tag element as a plain text span.
     * @param {string} tagContent - The JSON string representing the tag data.
     * @returns {HTMLElement | null} - The rendered tag stub element, or null if rendering fails.
     */
    renderTagStub(tagContent) {
        try {
            // Deserialize the tag content
            const tagData = JSON.parse(tagContent);

            // Create a span element for the tag stub - plain text rendering
            const tagElement = createElement('span', {className: 'tag-stub'}, `[${tagData.name}]`); // Render as plain text span

            // Basic styling for stub
            tagElement.style.backgroundColor = '#eee'; // Different background for stubs
            tagElement.style.color = '#555';
            tagElement.style.border = '1px dashed #ccc'; // Dashed border to indicate stub
            tagElement.style.borderRadius = '4px';
            tagElement.style.padding = '2px 4px';
            tagElement.style.margin = '2px';

            return tagElement;
        } catch (error) {
            console.error("Error rendering tag stub:", error);
            return null;
        }
    }


    /**
     * Opens the tag edit form for the given tag content.
     * @param {string} tagContent - The JSON string representing the tag data.
     */
    editTag(tagContent) {
        try {
            // Deserialize the tag content
            const tagData = JSON.parse(tagContent);
            // Get the tag definition from the ontology
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

    /**
     * Shows the tag edit form for the given tag definition and content.
     * @param {object} tagDefinition - The tag definition from the ontology.
     * @param {string | null} tagContent - The JSON string representing the tag data (optional).
     */
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

        this.tagForm = new GenericForm(tagDefinition, this.tagYDoc, 'tag', this.saveTag.bind(this), this.app);
        await this.tagForm.build();
        this.tagEditArea.appendChild(this.tagForm.el);

        // Add Delete Button
        const deleteButton = createElement('button', {className: 'delete-tag-button'}, 'Delete Tag');
        deleteButton.addEventListener('click', () => this.deleteTag());
        this.tagEditArea.appendChild(deleteButton);
    }

    /**
     * Saves the tag data to the Yjs document.
     */
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
        const selection = window.getSelection();
        let range = selection.getRangeAt(0);
        let cursorPosition = range.startOffset;
        // Calculate the new cursor position
        let newCursorPosition = cursorPosition + tagPlaceholder.length;

        // Sanitize input to prevent overlapping tags
        const text = this.yText.toString();
        const overlappingTagIndex = text.indexOf('[TAG:', cursorPosition);
        if (overlappingTagIndex !== -1) {
            this.app.showNotification("Cannot insert tag inside another tag.", 'warning');
            return; // Prevent saving the tag
        }

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
            } else {
                // Insert the tag placeholder into the Yjs text
                this.yText.insert(cursorPosition, tagPlaceholder);
            }
        });

        console.log('tagData', tagData);
        this.editingTagContent = null; // Reset editingTagContent

        // Restore cursor position after tag insertion/replacement
        this.editorArea.focus();
        this.editorArea.setSelectionRange(newCursorPosition, newCursorPosition);

        // Trigger autosuggest after saving
        this.autosuggest.apply();
    }

    /**
     * Deletes the currently edited tag from the Yjs document.
     */
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

    debounce(func, delay) {
        let timeout;
        return function (...args) {
            const context = this;
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(context, args), delay);
        };
    }
}

export {Edit};
