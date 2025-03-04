import {createElement} from '../utils';
import {Tag} from '../tag.js';
import DOMPurify from 'dompurify';

class TagConverter {
    static serialize(tagEl) {
        const tagDefinition = JSON.parse(tagEl.getAttribute('tag-definition'));
        const tagName = tagDefinition.name;
        const tagValue = tagEl.getAttribute('value') || '';
        const tagCondition = tagEl.getAttribute('condition') || 'is';
        return `[TAG:${tagName}:${tagValue}:${tagCondition}]`;
    }

    static deserialize(tagContent) {
        const [tagName, tagValue = '', tagCondition = 'is'] = tagContent.split(':');
        return { tagName, tagValue, tagCondition };
    }

    static createTagElement(tagName, tagValue, tagCondition, getTagDefinition) {
        const tagDefinition = getTagDefinition(tagName);
        if (!tagDefinition) {
            console.warn("Tag definition not found:", tagName);
            return null;
        }
        const tag = document.createElement('data-tag');
        tag.setAttribute('tag-definition', JSON.stringify(tagDefinition));
        tag.setAttribute('value', tagValue);
        tag.setAttribute('condition', tagCondition);
        return tag;
    }
}

class YjsContentManager {
    constructor(yDoc, yText) {
        this.yDoc = yDoc;
        this.yText = yText;
    }

    setContent(html) {
        this.updateYjsContent(html);
    }

    updateYjsContent(html) {
        this.yDoc.transact(() => {
            this.yText.delete(0, this.yText.length);
            this.yText.insert(0, html);
        });
    }

    observeYjsChanges(updateEditorArea) {
        this.yText.observe(() => {
            const html = this.yText.toString();
            updateEditorArea(html);
        });
    }
}

class HTMLSanitizer {
    constructor() {
        this.purifier = DOMPurify;
    }

    sanitize(html) {
        return this.purifier.sanitize(html, {
            ALLOWED_TAGS: ["br", "b", "i", "span", "u", "a"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "href", "target"]
        });
    }
}

class EditorContentHandler {
    constructor(editor, autosuggest, yDoc, yText, app) {
        this.editor = editor;
        this.autosuggest = autosuggest;
        this.app = app;
        this.lastValidRange = null;
        this.tagConverter = TagConverter;
        this.yjsContentManager = new YjsContentManager(yDoc, yText);
        this.htmlSanitizer = new HTMLSanitizer();

        this.yjsContentManager.observeYjsChanges(this.updateEditorArea.bind(this));
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
        this.lastValidRange = selection.getRangeAt(0).cloneRange();
    }

    insertTagAtSelection(tagName) {
        const editorArea = this.editor.editorArea;
        const selection = window.getSelection();
        let range = this.getSelectionRange(editorArea, selection);

        editorArea.focus();
        this.restoreSelection(selection, range);

        const tagDefinition = this.editor.getTagDefinition(tagName);
        if (tagDefinition) {
            const tag = document.createElement('data-tag');
            tag.setAttribute('tag-definition', JSON.stringify(tagDefinition));
            tag.setAttribute('value', '');
            tag.setAttribute('condition', 'is');
            this.insertNodeAtRange(range, tag);
        }

        this.lastValidRange = range.cloneRange();
        this.autosuggest.apply();
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
        this.autosuggest.apply();
    }

    serialize() {
        const clonedEditor = this.editor.editorArea.cloneNode(true);
        clonedEditor.querySelectorAll("data-tag").forEach(tagEl => {
            const serializedTag = TagConverter.serialize(tagEl);
            tagEl.replaceWith(serializedTag);
        });
        return clonedEditor.innerHTML.replace(/<br\s*\/?>/gi, "\n");
    }

    deserialize(text) {
        this.editor.editorArea.innerHTML = "";
        const tagRegex = /\[TAG:([^\]]*)\]/g;

        let lastIndex = 0;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                this.editor.editorArea.append(document.createTextNode(text.substring(lastIndex, match.index)));
                lastIndex = match.index;
            }
            try {
                const tagContent = match[1];
                const { tagName, tagValue, tagCondition } = TagConverter.deserialize(tagContent);
                const tagElement = TagConverter.createTagElement(tagName, tagValue, tagCondition, this.editor.getTagDefinition);
                if (tagElement) {
                    this.editor.editorArea.append(tagElement);
                } else {
                    this.editor.editorArea.append(document.createTextNode(match[0]));
                }
            } catch (error) {
                console.error("Failed to parse tag:", error);
                this.editor.editorArea.append(document.createTextNode(match[0]));
            }
            lastIndex = tagRegex.lastIndex;
        }

        if (lastIndex < text.length) {
            this.editor.editorArea.append(document.createTextNode(text.substring(lastIndex)));
        }
    }

    setContent(html) {
        this.yjsContentManager.setContent(html);
        this.editor.autosuggest.apply();
    }

    updateEditorArea(html) {
        this.editor.editorArea.innerHTML = html;
    }
}

export {EditorContentHandler};
