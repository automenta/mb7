import {createElement} from '../utils';
import {Tag} from '../tag.js'; // Import the new Tag component
import DOMPurify from 'dompurify';

class EditorContentHandler {
    constructor(editor, autosuggest, yDoc, yText, yName, app) {
        this.editor = editor;
        this.autosuggest = autosuggest;
        this.yDoc = yDoc;
        this.yText = yText;
        this.yName = yName;
        this.app = app;
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
        const selection = window.getSelection();
        let range = this.getSelectionRange(editorArea, selection);

        editorArea.focus();
        this.restoreSelection(selection, range);

        this.insertNodeAtRange(range, tag);

        this.lastValidRange = range.cloneRange();  // Update the last valid range
        this.autosuggest.apply(); // Refresh suggestions
    }

    getSelectionRange(editorArea, selection) {
        let range;
        if (selection.rangeCount > 0 && editorArea.contains(selection.anchorNode)) {
            range = selection.getRangeAt(0);
            this.lastValidRange = range.cloneRange();
        } else if (this.lastValidRange) {
            range = this.lastValidRange.cloneRange();
        } else {
            range = document.createRange();
            range.selectNodeContents(editorArea);
            range.collapse(false);
        }
        return range;
    }

    restoreSelection(selection, range) {
        selection.removeAllRanges();
        selection.addRange(range);
    }

    insertNodeAtRange(range, node) {
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        range.collapse(true);
        this.restoreSelection(window.getSelection(), range);
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

    setName(name) {
        this.yDoc.transact(() => {
            this.yName.delete(0, this.yName.length);
            this.yName.insert(0, name);
        });
    }

    setContent(html) {
        console.log('Edit.setContent called', html);
        this.updateYjsContent(html);
        this.editor.autosuggest.apply();
        const text = this.serialize();
        if (text.includes('[TAG:{"name":"Public"}')) {
            this.app.publishNoteToNostr(this.app.selectedNote);
        }
    }

    updateYjsContent(html) {
        this.yDoc.transact(() => {
            this.yText.delete(0, this.yText.length);
            this.yText.insert(0, html);
        });
    }

    sanitizeHTML(html) {
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ["br", "b", "i", "span", "u", "a"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "href", "target"]
        });
    }

    updateEditorArea(html) {
        this.editor.editorArea.innerHTML = html;
    }
}

const tagDataMap = new WeakMap();

export {EditorContentHandler};