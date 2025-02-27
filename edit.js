// edit.js
import $ from 'jquery';
import DOMPurify from 'dompurify';

// --- Constants and Helpers ---

const ontologyData = {
    Physical: [
        { name: "Mass", type: "number", unit: "kg", emoji: "⚖️", conditions: { is: "is", "is between": "is between", "is below": "is below", "is above": "is above" } },
        { name: "Length", type: "number", unit: "m", emoji: "📏", conditions: { is: "is", "is between": "is between", "is below": "is below", "is above": "is above" } },
        { name: "Temperature", type: "number", unit: "°C", emoji: "🌡️", conditions: { is: "is", "is between": "is between", "is below": "is below", "is above": "is above" } },
        { name: "Location", type: "location", emoji: "📍", conditions: { "is at": "is at", "is within": "is within" } },
        { name: "Color", type: "color", emoji: "🎨", conditions: { is: "is" } }
    ],
    Emotion: [
        { name: "Happiness", type: "range", emoji: "😊", min: 0, max: 10, conditions: { is: "is", "is between": "is between", "is below": "is below", "is above": "is above" } },
        { name: "Sadness", type: "range", emoji: "😢", min: 0, max: 10, conditions: { is: "is", "is between": "is between", "is below": "is below", "is above": "is above" } },
        { name: "Anger", type: "range", emoji: "😡", min: 0, max: 10, conditions: { is: "is", "is between": "is between", "is below": "is below", "is above": "is above" } }
    ],
    Business: [
        { name: "Revenue", type: "number", unit: "USD", emoji: "💰", conditions: { is: "is", "is between": "is between", "is below": "is below", "is above": "is above" } },
        { name: "Product", type: "list", emoji: "📦", options: ["Software", "Hardware", "Service"], conditions: { "is one of": "is one of" } },
        { name: "Customer", type: "list", emoji: "👥", options: ["B2B", "B2C", "Government"], conditions: { "is one of": "is one of" } }
    ],
    Time: [
        { name: "Time", type: "time", emoji: "⏰", conditions: { "is at": "is at", "is between": "is between", "is before": "is before", "is after": "is after" } }
    ],
    Data: [
        { name: "List", type: "list", emoji: "🔖", options: [], conditions: { "is one of": "is one of" } }
    ]
};

const createElement = (tag, attrs = {}, text = "") => {
    const el = document.createElement(tag);
    Object.entries(attrs).forEach(([key, value]) =>
        key.startsWith("on") && typeof value === "function"
            ? el.addEventListener(key.substring(2), value)
            : el.setAttribute(key, value)
    );
    if (text) el.textContent = text;
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
    append() { } // Abstract method
}

class TagMetadataRenderer extends TagRenderer {
    append() {
        const { emoji, name } = this.tag.data;
        this.el.append(emoji ? createElement("span", { class: "tag-emoji" }, emoji + " ") : "", document.createTextNode(name + " "));
    }
}

class TagConditionRenderer extends TagRenderer {
    append() {
        const { conditions, condition } = this.tag.data;
        const select = createElement("select", {
            class: "tag-condition",
            onchange: () => {
                this.tag.data.condition = select.value;
                this.tag.render();
                this.tag.onUpdate?.();
            },
        });
        Object.entries(conditions).forEach(([value, label]) => select.add(new Option(label, value)));
        select.value = condition;
        this.el.append(select);
    }
}

// Further breakdown of TagValueRenderer
class NumberInputRenderer {
    constructor(el, tagData, condition) {
        this.el = el;         // Parent element
        this.tagData = tagData; // Tag data
        this.condition = condition; // Specific condition (is, is between, ...)
    }

    render() {
        const { unit, value, min, max } = this.tagData;
        const numberInput = (ph, val, onValueChange) => this.el.appendChild(InputCreator.create("number", ph, val, onValueChange));

        switch (this.condition) {
            case "is": numberInput("Value", value, v => this.tagData.value = v); break;
            case "is between":
                numberInput("Min", min, v => this.tagData.min = v);
                this.el.append(document.createTextNode(" and "));
                numberInput("Max", max, v => this.tagData.max = v);
                break;
            case "is below": numberInput("Max", max, v => this.tagData.max = v); break;
            case "is above": numberInput("Min", min, v => this.tagData.min = v); break;
        }
        if (unit) this.el.append(createElement("span", { class: "unit-label" }, ` ${unit}`));
    }
}

class TimeInputRenderer {
    constructor(el, tagData, condition) {
        this.el = el;
        this.tagData = tagData;
        this.condition = condition;
    }
    render() {
        const { value, min, max } = this.tagData;
        const timeInput = (ph, val, onValueChange) => this.el.appendChild(InputCreator.create("text", ph, val, onValueChange));

        switch (this.condition) {
            case "is at": timeInput("Time", value, v => { this.tagData.value = v;  }); break;
            case "is between":
                timeInput("Start Time", min, v => { this.tagData.min = v;  });
                this.el.append(document.createTextNode(" and "));
                timeInput("End Time", max, v => { this.tagData.max = v;  });
                break;
            case "is before": timeInput("Before", max, v => { this.tagData.max = v;  }); break;
            case "is after": timeInput("After", min, v => { this.tagData.min = v; }); break;
        }
    }
}


class TagValueRenderer extends TagRenderer {
    append() {
        const { type, condition, options, value } = this.tag.data;

        switch (type) {
            case "number":
            case "range":
                new NumberInputRenderer(this.el, this.tag.data, condition).render();
                break;

            case "list":
                const select = createElement("select", { onchange: () => { this.tag.data.value = select.value; this.tag.onUpdate?.(); } });
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
                const preview = createElement("span", { class: "color-preview" });
                preview.style.backgroundColor = value;
                this.el.append(colorInput, preview);
                break;

            case "location":
                this.el.append(InputCreator.create("text", "Lat, Lng", this.tag.data.value ? `${this.tag.data.value.lat}, ${this.tag.data.value.lng}` : "",
                    val => {
                        const [latStr, lngStr] = val.split(",").map(s => s.trim());
                        const [lat, lng] = [parseFloat(latStr), parseFloat(lngStr)];
                        this.tag.data.value = (!isNaN(lat) && !isNaN(lng)) ? { lat, lng } : null;
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
            createElement("span", { class: "tag-remove", onclick: e => { e.stopPropagation(); this.tag.remove(); this.tag.onUpdate?.(); } }, "x")
        );
    }
}

// --- InlineTag Class ---

class InlineTag {
    constructor(tagData, onUpdate) {
        this.data = this.normalizeTagData(tagData);
        this.onUpdate = onUpdate;
        this.el = createElement("span", { class: "inline-tag", contenteditable: "false" });
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
        const { type, condition } = data;
        data.value ??= (type === "list") ? (data.options?.[0] || "") : (type === "color" ? "#000000" : 0);
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
        this.el = createElement("div", { id: "ontology-browser", class: "ontology-browser" });
        this.build();
        //this.hide();
    }

    build() {
        this.el.innerHTML = "";
        Object.entries(this.ontology).forEach(([category, tags]) => {
            const categoryDiv = createElement("div", { class: "category" }, category);
            tags.forEach(tagData =>
                categoryDiv.appendChild(
                    createElement("div", {
                        class: "tag-item",
                        onclick: () => {
                            this.onTagSelect(new InlineTag(tagData));
                            //this.hide();
                        },
                    }, (tagData.emoji ? tagData.emoji + " " : "") + tagData.name)
                )
            );
            this.el.appendChild(categoryDiv);
        });
    }

    show() { this.el.style.display = "block"; }
    hide() { this.el.style.display = "none"; }
    getElement() { return this.el; }
}

// --- SuggestionDropdown Class ---

class SuggestionDropdown {
    constructor() {
        this.el = createElement("div", { id: "suggestion-dropdown", class: "suggestion-dropdown" });
        document.body.appendChild(this.el);
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

        suggestions.forEach((suggestion) =>
            this.el.appendChild(
                createElement("div", {
                    class: "suggestion-item",
                    onclick: () => {
                        this.onSelectCallback?.(suggestion);
                        this.hide();
                    },
                }, (suggestion.tagData.emoji ? suggestion.tagData.emoji + " " : "") + suggestion.displayText)
            )
        );

        Object.assign(this.el.style, { left: `${x}px`, top: `${y}px`, display: "block" });
        this.selectedIndex = -1;
        this.updateSelection();
    }

    hide() {
        Object.assign(this.el.style, {display: 'none'});
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
        this.el = createElement("div", { id: "toolbar" });
        this.build();
    }

    build() {
        const createGroup = () => createElement("div", { class: "group" });
        const createButton = (title, text, command, arg = null) =>
            createElement("button", { title, onclick: () => document.execCommand(command, false, arg) }, text);

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

    async apply() {
        const editorContent = this.editor.editorArea;

        // Efficiently remove existing .autosuggest spans
        editorContent.querySelectorAll('.autosuggest').forEach(span =>
            span.parentNode.replaceChild(document.createTextNode(span.textContent), span)
        );

        const walker = document.createTreeWalker(
            editorContent,
            NodeFilter.SHOW_TEXT,
            { acceptNode: node => node.parentNode.closest(".inline-tag, .autosuggest") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT }
        );

        const wordRegex = /\b([a-zA-Z]{3,})\b/g;

        let node;
        while ((node = walker.nextNode())) {
            const text = node.nodeValue.trim();
            if (!text) continue;
            wordRegex.lastIndex = 0; // Reset for each new text node

            let hasMatch = false;
            for (let match; (match = wordRegex.exec(text)) !== null;) {
                if (await this.editor.matchesOntology(match[1])) {
                    hasMatch = true;
                    break;  // Only need one match per word
                }
            }
            if (hasMatch) this.wrapMatches(node, wordRegex);
        }
    }

    wrapMatches(textNode, regex) {
      const text = textNode.nodeValue;
      const fragment = document.createDocumentFragment();
      let lastIndex = 0;
      regex.lastIndex = 0; // Reset the regex

      let match;
      while ((match = regex.exec(text)) !== null) {
        const [start, end] = [match.index, regex.lastIndex];

        if (start > lastIndex) {
          fragment.appendChild(document.createTextNode(text.substring(lastIndex, start)));
        }
        fragment.appendChild(createElement("span", { class: "autosuggest" }, match[1]));
        lastIndex = end;
      }

      if (lastIndex < text.length) {
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    }
}

class EditorContentHandler {
    constructor(editor) {
        this.editor = editor;
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
    }

    insertTagAtSelection(tag) {
        const editorArea = this.editor.editorArea[0];
        const selection = window.getSelection();

        editorArea.focus();
        if (!selection.rangeCount || !editorArea.contains(selection.anchorNode)) {
            selection.removeAllRanges();
            const range = document.createRange();
            range.selectNodeContents(editorArea);
            range.collapse(false);
            selection.addRange(range);
        }

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(tag.el);
        range.setStartAfter(tag.el);
        range.collapse(true);
        selection.removeAllRanges();
        selection.addRange(range);
    }

    insertTagFromSuggestion(suggestion) {
        if (!suggestion?.span) return;
        const newTag = new InlineTag(suggestion.tagData, () => this.editor.autosuggest.apply());
        suggestion.span.parentNode.replaceChild(newTag.el, suggestion.span);
    }

    serialize() {
        const clonedEditor = this.editor.editorArea.cloneNode(true);
        clonedEditor.querySelectorAll(".inline-tag").forEach(tagEl => {
            const tagData = tagDataMap.get(tagEl);
            if (tagData) {
                tagEl.replaceWith(document.createTextNode(`[TAG:${JSON.stringify(tagData)}]`));
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
                this.editor.editorArea.append(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            try {
                const tag = new InlineTag(JSON.parse(match[1]), () => this.editor.autosuggest.apply());
                this.editor.editorArea.append(tag.el);
            } catch (error) {
                console.error("Failed to parse tag data:", error);
                this.editor.editorArea.append(document.createTextNode(match[0]));
            }
            lastIndex = tagRegex.lastIndex;
        }

        if (lastIndex < text.length) {
            this.editor.editorArea.append(document.createTextNode(text.substring(lastIndex)));
        }
    }
}

class Edit {
    constructor() {
        this.ontology = ontologyData;
        this.editorArea = $(createElement("div", { contenteditable: "true" }));

        this.suggestionDropdown = new SuggestionDropdown();
        this.ontologyBrowser = new OntologyBrowser(this.ontology, 
            (tag) => this.contentHandler.insertTagAtSelection(tag));
        this.toolbar = new Toolbar(this);
        this.autosuggest = new Autosuggest(this);
        this.contentHandler = new EditorContentHandler(this);

        const toolbar = document.createElement('div');
        toolbar.append(this.toolbar.getElement(), this.ontologyBrowser.getElement());

        this.$el = $('<div>').append(this.editorArea, toolbar);
        this.setupEditorEvents();
        this.editorArea.focus();
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
                        this.findSuggestion(this.suggestionDropdown.getSelectedSuggestion())
                            .then(sugg => sugg && this.contentHandler.insertTagFromSuggestion(sugg));
                    }
                    this.suggestionDropdown.hide();
                    break;
                case "Escape":
                    this.suggestionDropdown.hide();
                    break;
            }
        };

        this.editorArea[0].addEventListener("keyup", () => this.suggestionDropdown.el.style.display !== 'block' && this.autosuggest.debouncedApply());
        this.editorArea[0].addEventListener("click", (e) => e.target.classList.contains("autosuggest") && (e.stopPropagation() || this.showSuggestionsForSpan(e.target)));
        this.editorArea[0].addEventListener("keydown", (e) => e.key === "Enter" && (e.preventDefault() || this.contentHandler.insertLineBreak()));
        document.addEventListener("keydown", handleDropdownKeys);
        document.addEventListener("click", (e) => {
            !this.editorArea[0].contains(e.target) && !this.ontologyBrowser.getElement().contains(e.target) && !this.suggestionDropdown.el.contains(e.target) && this.suggestionDropdown.hide();
        });
    }

    showSuggestionsForSpan(span) {
        const suggestions = [];
        const word = span.textContent.toLowerCase();
        for (const category in this.ontology) {
            for (const tag of this.ontology[category]) {
                if (tag.name.toLowerCase().startsWith(word)) {
                    suggestions.push({ displayText: tag.name, tagData: tag, span: span });
                }
            }
        }
        const rect = span.getBoundingClientRect();
        this.suggestionDropdown.show(suggestions, rect.left + window.scrollX, rect.bottom + window.scrollY, choice => this.contentHandler.insertTagFromSuggestion(choice));
    }

    async matchesOntology(word) {
      for (const tag of Object.values(this.ontology).flat()) { // Flatten ontology for direct access
          if (tag.name.toLowerCase().startsWith(word.toLowerCase())) {
            return true
          }
      }
        return false;
    }

    getContent() {
        return this.editorArea.html();
    }
    
    setContent(html) {
        //TODO sanitize before .html()
        this.editorArea.html(html);
        this.sanitizeContent();
    }

    sanitizeContent() {
        const current = this.$el.html();
        const sanitized = DOMPurify.sanitize(current, {
            ALLOWED_TAGS: ["br", "b", "i", "span", "u"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id"]
        });
        if (current !== sanitized) this.editorArea.html(sanitized);
    }
    async findSuggestion(name) {
      for (const cat in this.ontology) {
        for (const t of this.ontology[cat]) {
          if (t.name === name) return { displayText: t.name, tagData: t };
        }
      }
      return null;
    }
}

export { Edit };