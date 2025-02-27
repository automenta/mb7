import {UnifiedOntology} from './ontology.js';
// edit.js
import DOMPurify from 'dompurify';
import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getNotesIndex, updateNotesIndex } from './db';
import { DB } from './db';

// --- Constants and Helpers ---

const createElement = (tag, attrs = {}, text = "") => {
    const el = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key.startsWith("on") && typeof value === "function") {
            el.addEventListener(key.slice(2), value);
        } else {
            el.setAttribute(key, value);
        }
    }
    el.textContent = text ?? "";
    return el;
};

const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

const tagDataMap = new WeakMap(); // Key: DOM element, Value: tag data

// --- Utility Classes ---

class InputCreator {
    static create(type, placeholder, value, onChange, extraAttrs = {}) {
        return createElement("input", {
            type, placeholder, value, ...extraAttrs,
            oninput: (e) => onChange(type === "number" ? (parseFloat(e.target.value) || "") : e.target.value)
        });
    }
}

// --- Tag Rendering Classes ---

class TagRenderer {
    constructor(tag) {
        this.tag = tag;
        this.el = tag.el;
    }

    append() {
    } // Abstract method
}

class TagMetadataRenderer extends TagRenderer {
    append() {
        const {emoji, name} = this.tag.data;
        this.el.append(emoji ? createElement("span", {class: "tag-emoji"}, `${emoji} `) : "", name + " ");
    }
}

class TagConditionRenderer extends TagRenderer {
    append() {
        const {conditions, condition} = this.tag.data;
        const select = createElement("select", {
            class: "tag-condition",
            onchange: () => {
                this.tag.data.condition = select.value;
                this.tag.render();
                this.tag.onUpdate?.();
            },
        });
        for (const [value, label] of Object.entries(conditions)) {
            select.add(new Option(label, value));
        }
        select.value = condition;
        this.el.append(select);
    }
}

class NumberInputRenderer {
    constructor(el, tagData, condition) {
        this.el = el;
        this.tagData = tagData;
        this.condition = condition;
    }

    render() {
        const {unit, value, min, max} = this.tagData;
        const numberInput = (ph, val, onValueChange) => this.el.append(InputCreator.create("number", ph, val, onValueChange));

        switch (this.condition) {
            case "is":
                numberInput("Value", value, v => this.tagData.value = v);
                break;
            case "is between":
                numberInput("Min", min, v => this.tagData.min = v);
                this.el.append(" and ");
                numberInput("Max", max, v => this.tagData.max = v);
                break;
            case "is below":
                numberInput("Max", max, v => this.tagData.max = v);
                break;
            case "is above":
                numberInput("Min", min, v => this.tagData.min = v);
                break;
        }
        if (unit) this.el.append(createElement("span", {class: "unit-label"}, ` ${unit}`));
    }
}

class TimeInputRenderer {
    constructor(el, tagData, condition) {
        this.el = el;
        this.tagData = tagData;
        this.condition = condition;
    }

    render() {
        const {value, min, max} = this.tagData;
        const timeInput = (ph, val, onValueChange) => this.el.append(InputCreator.create("text", ph, val, onValueChange));

        switch (this.condition) {
            case "is at":
                timeInput("Time", value, v => this.tagData.value = v);
                break;
            case "is between":
                timeInput("Start Time", min, v => this.tagData.min = v);
                this.el.append(" and ");
                timeInput("End Time", max, v => this.tagData.max = v);
                break;
            case "is before":
                timeInput("Before", max, v => this.tagData.max = v);
                break;
            case "is after":
                timeInput("After", min, v => this.tagData.min = v);
                break;
        }
    }
}


class TagValueRenderer extends TagRenderer {
    append() {
        const {type, condition, options, value} = this.tag.data;

        switch (type) {
            case "number":
            case "range":
                new NumberInputRenderer(this.el, this.tag.data, condition).render();
                break;

            case "list":
                const select = createElement("select", {
                    onchange: () => {
                        this.tag.data.value = select.value;
                        this.tag.onUpdate?.();
                    }
                });
                (options || []).forEach(opt => select.add(new Option(opt, opt)));
                select.value = value;
                this.el.append(select);
                break;

            case "color":
                const colorInput = InputCreator.create("color", null, value, v => {
                    this.tag.data.value = v;
                    preview.style.backgroundColor = v;
                    this.tag.onUpdate?.();
                });
                const preview = createElement("span", {class: "color-preview"});
                preview.style.backgroundColor = value;
                this.el.append(colorInput, preview);
                break;

            case "location":
                this.el.append(InputCreator.create("text", "Lat, Lng", this.tag.data.value ? `${this.tag.data.value.lat}, ${this.tag.data.value.lng}` : "",
                    val => {
                        const [latStr, lngStr] = val.split(",").map(s => s.trim());
                        const [lat, lng] = [parseFloat(latStr), parseFloat(lngStr)];
                        this.tag.data.value = (!isNaN(lat) && !isNaN(lng)) ? {lat, lng} : null;
                        this.tag.onUpdate?.();
                    }
                ));
                break;

            case "time":
                new TimeInputRenderer(this.el, this.tag.data, condition).render();
                break;

            default:
                this.el.append(createElement("span", {}, value));
        }
    }
}

class TagRemoveButtonRenderer extends TagRenderer {
    append() {
        this.el.append(
            createElement("span", {
                class: "tag-remove", onclick: e => {
                    e.stopPropagation();
                    this.tag.remove();
                    this.tag.onUpdate?.();
                }
            }, "x")
        );
    }
}

// --- InlineTag Class ---

class InlineTag {
    constructor(tagData, onUpdate) {
        this.data = this.normalizeTagData(tagData);
        this.onUpdate = onUpdate;
        this.el = createElement("span", {class: "inline-tag", contenteditable: "false"});
        tagDataMap.set(this.el, this.data);
        this.renderers = [
            new TagMetadataRenderer(this),
            new TagConditionRenderer(this),
            new TagValueRenderer(this),
            new TagRemoveButtonRenderer(this),
        ];
        this.render();
    }

    normalizeTagData(tagData) {
        const data = {
            ...tagData,
            condition: tagData.condition || Object.keys(tagData.conditions)[0],
        };
        const {type, condition} = data;
        data.value ??= (type === "list") ? (data.options?.[0] || "") : (type === "color" ? "#000000" : "");
        if (condition === "is between") {
            data.min ??= 0;
            data.max ??= 0;
        }
        return data;
    }

    render() {
        this.el.innerHTML = "";
        this.renderers.forEach(renderer => renderer.append());
        this.updateAppearance();
    }

    updateAppearance() {
        this.el.classList.toggle("conditional", !(["is", "is at", "is one of"].includes(this.data.condition)));
    }

    remove() {
        this.el.remove();
    }
}

// --- OntologyBrowser Class ---

class OntologyBrowser {
    constructor(ontology, onTagSelect) {
        this.ontology = ontology;
        this.onTagSelect = onTagSelect;
        this.el = createElement("div", {id: "ontology-browser", class: "ontology-browser"});
        this.build();
    }

    build() {
        this.el.innerHTML = "";
        Object.entries(this.ontology).forEach(([key, value]) => {
            const categoryDiv = createElement("div", {class: "category"}, key);
            if (value.instances) {
                value.instances.forEach(tagData =>
                    categoryDiv.append(
                        createElement("div", {
                            class: "tag-item",
                            onclick: () => this.onTagSelect(new InlineTag(tagData, this.onTagSelect)),
                        }, `${tagData.emoji || ""} ${tagData.name}`)
                    )
                );
            } else {
                // Handle cases where there are no instances, e.g., string, number
                // You might want to display a default tag or a message indicating no specific instances
                categoryDiv.append(
                    createElement("div", {class: "tag-item"}, '')
                );
            }
            this.el.append(categoryDiv);
        });
    }

    show() {
        this.el.style.display = "block";
    }

    hide() {
        this.el.style.display = "none";
    }

    getElement() {
        return this.el;
    }
}

class SuggestionDropdown {
    constructor() {
        this.el = createElement("div", {id: "suggestion-dropdown", class: "suggestion-dropdown"});
        document.body.append(this.el);
        this.selectedIndex = -1;
        this.onSelectCallback = null;
        this.hide();
    }

    show(suggestions, x, y, onSelect) {
        this.el.innerHTML = "";
        this.onSelectCallback = onSelect;

        if (!suggestions.length) {
            this.hide();
            return;
        }

        suggestions.forEach(suggestion =>
            this.el.append(
                createElement("div", {
                    class: "suggestion-item",
                    onclick: () => {
                        this.onSelectCallback?.(suggestion);
                        this.hide();
                    },
                }, `${suggestion.tagData.emoji || ""} ${suggestion.displayText}`)
            )
        );

        Object.assign(this.el.style, {left: `${x}px`, top: `${y}px`, display: "block"});
        this.selectedIndex = -1;
        this.updateSelection();
    }

    hide() {
        this.el.style.display = 'none';
        this.selectedIndex = -1;
        this.onSelectCallback = null;
    }

    moveSelection(direction) {
        const count = this.el.children.length;
        this.selectedIndex = count > 0 ? (this.selectedIndex + direction + count) % count : -1;
        this.updateSelection();
    }

    updateSelection() {
        Array.from(this.el.children).forEach((child, i) =>
            child.classList.toggle("selected", i === this.selectedIndex)
        );
    }

    getSelectedSuggestion() {
        return this.el.children[this.selectedIndex]?.textContent ?? null;
    }
}

// --- Editor-related Classes ---

class Toolbar {
    constructor(editor) {
        this.editor = editor;
        this.el = createElement("div", {id: "toolbar"});
        this.build();
    }

    build() {
        const createGroup = () => createElement("div", {class: "group"});
        const createButton = (title, text, command, arg = null) =>
            createElement("button", {title, onclick: () => document.execCommand(command, false, arg)}, text);

        const formattingGroup = createGroup();
        formattingGroup.append(
            createButton("Bold (Ctrl+B)", "B", "bold"),
            createButton("Italic (Ctrl+I)", "I", "italic"),
            createButton("Underline (Ctrl+U)", "U", "underline"),
            createButton("Strike Through", "S", "strikeThrough"),
            createButton("Clear Formatting", "Unformat", "removeFormat")
        );

        const undoRedoGroup = createGroup();
        undoRedoGroup.append(
            createButton("Undo (Ctrl+Z)", "Undo", "undo"),
            createButton("Redo (Ctrl+Y)", "Redo", "redo")
        );

        this.el.append(formattingGroup, undoRedoGroup);
    }

    getElement() {
        return this.el;
    }
}

class Autosuggest {
    constructor(editor) {
        this.editor = editor;
        this.debouncedApply = debounce(this.apply.bind(this), 300);
    }

    apply() {
        const editorContent = this.editor.editorArea;

        // Efficiently remove existing .autosuggest spans
        editorContent.querySelectorAll('.autosuggest').forEach(span =>
            span.replaceWith(span.textContent)
        );

        const walker = document.createTreeWalker(
            editorContent,
            NodeFilter.SHOW_TEXT,
            {acceptNode: node => node.parentNode.closest(".inline-tag, .autosuggest") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT}
        );
        const wordRegex = /\b[a-zA-Z]{3,}\b/g;

        let node;
        while ((node = walker.nextNode())) {
            const text = node.nodeValue.trim();
            if (!text) continue;

            let hasMatch = false;
            let match;
            while ((match = wordRegex.exec(text)) !== null) {
                if (this.editor.matchesOntology(match[0])) {
                    hasMatch = true;
                    break;  // Only need one match per word
                }
            }
            if (hasMatch) this.wrapMatches(node);
        }
    }

    wrapMatches(textNode) {
        const text = textNode.nodeValue;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        const regex = /\b[a-zA-Z]{3,}\b/g; // Create regex here to reset lastIndex

        let match;
        while ((match = regex.exec(text)) !== null) {
            const [start, end] = [match.index, regex.lastIndex];

            if (start > lastIndex) {
                fragment.append(text.substring(lastIndex, start));
            }
            fragment.append(createElement("span", {class: "autosuggest"}, match[0]));
            lastIndex = end;
        }

        if (lastIndex < text.length) {
            fragment.append(text.substring(lastIndex));
        }

        textNode.replaceWith(fragment);
    }
}

class EditorContentHandler {
    constructor(editor) {
        this.editor = editor;
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
        range.insertNode(tag.el); // Insert the tag element

        // 5. Adjust the cursor position after the inserted tag
        range.setStartAfter(tag.el);
        range.collapse(true); // Collapse to the new position

        // 6. Update the selection with the new range
        selection.removeAllRanges();
        selection.addRange(range);
        this.lastValidRange = range.cloneRange();  // Update the last valid range

        // 7. Trigger autosuggest to update suggestions based on changes
        this.editor.autosuggest.apply(); // Refresh suggestions
    }


    insertTagFromSuggestion(suggestion) {
        if (!suggestion?.span) return;
        const newTag = new InlineTag(suggestion.tagData, () => this.editor.autosuggest.apply());
        suggestion.span.replaceWith(newTag.el);
        this.editor.autosuggest.apply(); //apply after insertion
    }

    serialize() {
        const clonedEditor = this.editor.editorArea.cloneNode(true);
        clonedEditor.querySelectorAll(".inline-tag").forEach(tagEl => {
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
                const tag = new InlineTag(tagData, () => this.editor.autosuggest.apply());
                this.editor.editorArea.append(tag.el);
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

class Edit {
    constructor() {
        this.ontology = UnifiedOntology;
        this.db = new DB();
        this.yDoc = new Y.Doc();
        this.indexeddbPersistence = new IndexeddbPersistence('yjs-indexeddb-provider', this.yDoc);
        this.yText = this.yDoc.getText('content');
        this.editorArea = createElement("div", {contenteditable: "true", id: "editor-area"});
        const menu = createElement('div');
        this.el = createElement('div');
        this.el.append(menu, this.editorArea);

        this.suggestionDropdown = new SuggestionDropdown();
        this.ontologyBrowser = new OntologyBrowser(this.ontology,
            (tag) => this.contentHandler.insertTagAtSelection(tag));
        this.toolbar = new Toolbar(this);
        this.autosuggest = new Autosuggest(this);
        this.contentHandler = new EditorContentHandler(this);

        menu.append(this.toolbar.getElement(), this.ontologyBrowser.getElement());

        this.setupEditorEvents();
        this.editorArea.focus();
        this.loadYDoc();
    }

    async loadYDoc() {
        const yDoc = await this.db.getYDoc(this.yText.toString());
        if (yDoc) {
            this.yDoc.transact(() => {
                this.yText.delete(0, this.yText.length);
                this.yText.insert(0, yDoc.getText('content').toString())
            })
        }
    }

    async updateNotesIndex() {
        try {
            const currentId = this.yText.toString();
            const index = await getNotesIndex();
            const newIndex = index.includes(currentId) ? index : [...index, currentId];
            await updateNotesIndex(newIndex);
        } catch (error) {
            console.error('Error updating notes index:', error);
        }
    }

    setupEditorEvents() {
        const handleDropdownKeys = (event) => {
            if (this.suggestionDropdown.el.style.display !== "block") return;
            switch (event.key) {
                case "ArrowDown":
                case "ArrowUp":
                    event.preventDefault();
                    this.suggestionDropdown.moveSelection(event.key === "ArrowDown" ? 1 : -1);
                    break;
                case "Enter":
                    event.preventDefault();
                    if (this.suggestionDropdown.getSelectedSuggestion()) {
                        const suggestion = this.findSuggestion(this.suggestionDropdown.getSelectedSuggestion());
                        if (suggestion) this.contentHandler.insertTagFromSuggestion(suggestion);
                    }
                    this.suggestionDropdown.hide();
                    break;
                case "Escape":
                    this.suggestionDropdown.hide();
                    break;
            }
        };

        this.editorArea.addEventListener("keyup", () => {
            if (this.suggestionDropdown.el.style.display !== 'block') {
                this.autosuggest.debouncedApply();
            }
            // Store last valid range after keyup
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.editorArea.contains(selection.anchorNode)) {
                this.contentHandler.lastValidRange = selection.getRangeAt(0).cloneRange();
            }
        });

        this.editorArea.addEventListener("click", (e) => {
            if (e.target.classList.contains("autosuggest")) {
                e.stopPropagation();
                this.showSuggestionsForSpan(e.target);
            }
            // Store last valid range after click inside editorArea
            const selection = window.getSelection();
            if (selection.rangeCount > 0 && this.editorArea.contains(selection.anchorNode)) {
                this.contentHandler.lastValidRange = selection.getRangeAt(0).cloneRange();
            }
        });
        this.editorArea.addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault() || this.contentHandler.insertLineBreak()));
        document.addEventListener("keydown", handleDropdownKeys);
        document.addEventListener("click", (e) => {
            if (!this.editorArea.contains(e.target) && !this.ontologyBrowser.getElement().contains(e.target) && !this.suggestionDropdown.el.contains(e.target)) {
                this.suggestionDropdown.hide();
            }
        });
    }

    showSuggestionsForSpan(span) {
        const suggestions = [];
        const word = span.textContent.toLowerCase();
        for (const category in this.ontology) {
            for (const tag of this.ontology[category]) {
                if (tag.name.toLowerCase().startsWith(word)) {
                    suggestions.push({displayText: tag.name, tagData: tag, span});
                }
            }
        }
        const rect = span.getBoundingClientRect();
        this.suggestionDropdown.show(suggestions, rect.left + window.scrollX, rect.bottom + window.scrollY, this.contentHandler.insertTagFromSuggestion.bind(this.contentHandler)); // Use bind for correct 'this'
    }

    matchesOntology(word) {
        return Object.values(this.ontology).flat().some(tag => tag.name.toLowerCase().startsWith(word.toLowerCase()));
    }

    getContent() {
        return this.yText.toString();
    }

    setContent(html) {
        this.yDoc.transact(() => {
            this.yText.delete(0, this.yText.length);
            this.yText.insert(0, html);
        });
        this.editorArea.innerHTML = DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ["br", "b", "i", "span", "u"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id"]
        });
        this.autosuggest.apply(); // Apply autosuggest after setting content.
        this.db.saveYDoc(this.yText.toString(), this.yDoc);
        this.updateNotesIndex();
    }


    findSuggestion(name) {
        for (const cat in this.ontology) {
            for (const t of this.ontology[cat]) {
                if (t.name === name) return {displayText: t.name, tagData: t};
            }
        }
        return null;
    }
}

export {Edit};