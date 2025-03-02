import {createElement} from '../utils';
import {Tag} from '../tag.js'; // Import the new Tag component

class EditorContentHandler {
    constructor(editor, autosuggest) {
        this.editor = editor;
        this.autosuggest = autosuggest;
        this.lastValidRange = null; // Store the last valid range within the editor for handling tag insertions
    }

    insertLineBreak() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(createElement("br"));

        const newRange = document.createRange();
        newRange.setStartAfter(range.endContainer.lastChild);
        newRange.collapse(true);

        selection.removeAllRanges();
        selection.addRange(newRange);
        this.lastValidRange = selection.getRangeAt(0).cloneRange(); // Save range for future tag insertions
    }


    insertTagAtSelection(tag) {
        const editorArea = this.editor.editorArea;

        // 1. Get the current selection, or use the last known valid range
        const selection = window.getSelection();
        let range;

        if (selection.rangeCount > 0 && editorArea.contains(selection.anchorNode)) {
            // If there's a valid selection within the editor, use it
            range = selection.getRangeAt(0);
            this.lastValidRange = range.cloneRange(); // Store this range as the last valid one
        } else if (this.lastValidRange) {
            // If no current selection, but a valid range was previously stored, use that
            range = this.lastValidRange.cloneRange();
        } else {
            // If no selection and no stored range, default to the end of the editor content
            range = document.createRange();
            range.selectNodeContents(editorArea);
            range.collapse(false); // Collapse to the end
        }

        // 2. Ensure the editorArea has focus before manipulating selections
        editorArea.focus();

        // 3. Restore the selection based on the determined range - crucial to apply focus
        selection.removeAllRanges();
        selection.addRange(range);

        // 4. Insert the tag at the current selection
        range.deleteContents(); // Remove selected content, if any
        range.insertNode(tag); // Insert the tag element

        // 5. Adjust the cursor position after the inserted tag
        range.setStartAfter(tag);
        range.collapse(true); // Collapse to the new position

        // 6. Update the selection with the new range
        selection.removeAllRanges();
        selection.addRange(range);
        this.lastValidRange = range.cloneRange();  // Update the last valid range

        // 7. Trigger autosuggest to update suggestions based on changes
        this.autosuggest.apply(); // Refresh suggestions
    }


    insertTagFromSuggestion(suggestion) {
        if (!suggestion?.span) return;
        const newTag = new Tag(suggestion.tagData, () => this.editor.autosuggest.apply());
        suggestion.span.replaceWith(newTag);
        this.autosuggest.apply(); //apply after insertion
    }

    serialize() {
        const clonedEditor = this.editor.editorArea.cloneNode(true);
        clonedEditor.querySelectorAll("gra-tag").forEach(tagEl => { // Updated selector
            const tagData = tagDataMap.get(tagEl);
            if (tagData) {
                tagEl.replaceWith(`[TAG:${JSON.stringify(tagData)}]`);
            }
        });
        return clonedEditor.innerHTML.replace(/<br\s*\/?>/g, "\n");
    }

    deserialize(text) {
        this.editor.editorArea.innerHTML = "";
        const tagRegex = /\[TAG:(.*?)\]/g;

        let lastIndex = 0;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                this.editor.editorArea.append(text.substring(lastIndex, match.index));
            }
            try {
                const tagData = JSON.parse(match[1]);
                const tag = new Tag(tagData, () => this.editor.autosuggest.apply());
                this.editor.editorArea.append(tag);
            } catch (error) {
                console.warn("Failed to parse tag data:", error);
                this.editor.editorArea.append(match[0]);
            }
            lastIndex = tagRegex.lastIndex;
        }

        if (lastIndex < text.length) {
            this.editor.editorArea.append(text.substring(lastIndex));
        }
    }
}

const tagDataMap = new WeakMap();

export {EditorContentHandler};