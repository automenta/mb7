import DOMPurify from 'dompurify';
import $ from 'jquery';
import { nanoid } from 'nanoid';
import { UIComponent } from "./view.js";
import { TagOntology } from './ontology.js';

// Preprocess TagOntology to create LowerCaseTagOntology with lowercase names
const LowerCaseTagOntology = {};
for (const cat in TagOntology) {
    LowerCaseTagOntology[cat] = TagOntology[cat];
}

import { OntologyBrowser } from './ontology_browser.js';

// Helper function to get tag definition (assumed to be available)
function getTagDefinition(tagName) {
    for (const cat in TagOntology) {
        const tag = TagOntology[cat].find(t => t.name === tagName);
        if (tag) return tag;
    }
    throw new Error(`Tag definition not found for ${tagName}`);
}

class InlineTag extends UIComponent {
    constructor(tagData, onUpdate) {
        super(`<span class="inline-tag" contenteditable="false" tabindex="0" id="${nanoid()}"></span>`);
        this.tagData = {
            name: tagData.name,
            condition: tagData.condition || getTagDefinition(tagData.name).conditions[0],
            value: tagData.value ?? ''
        };
        this.onUpdate = onUpdate;
        this.$el.data('instance', this); // Store instance reference for serialization
        this.render();
    }

    render() {
        const { name, condition, value } = this.tagData;
        const tagDef = getTagDefinition(name);
        this.$el.empty().append(
            `<span class="tag-name">${name}</span>`,
            `<select class="tag-condition">${tagDef.conditions.map(c => `<option value="${c}" ${c === condition ? 'selected' : ''}>${c}</option>`).join('')}</select>`,
            this.createValueInput(tagDef),
            `<button class="tag-remove">×</button>`
        );
        this.bindEvents();
    }

    createValueInput(tagDef) {
        const { type, unit, options } = tagDef;
        const { condition, value } = this.tagData;

        if (["number", "range"].includes(type)) {
            if (condition === "is") {
                const inp = $(`<input type="number" value="${value ?? ""}" placeholder="Value">`);
                inp.on("input", e => {
                    const p = parseFloat(e.target.value);
                    if (!isNaN(p)) this.tagData.value = p;
                    this.onUpdate?.();
                });
                return inp;
            } else if (condition === "is between") {
                // Ensure value is an object for "is between"
                if (typeof value !== "object") this.tagData.value = { lower: "", upper: "" };
                const inpLower = $(`<input type="number" value="${value.lower ?? ""}" placeholder="Lower">`);
                inpLower.on("input", e => {
                    const p = parseFloat(e.target.value);
                    this.tagData.value.lower = isNaN(p) ? "" : p;
                    this.onUpdate?.();
                });
                const inpUpper = $(`<input type="number" value="${value.upper ?? ""}" placeholder="Upper">`);
                inpUpper.on("input", e => {
                    const p = parseFloat(e.target.value);
                    this.tagData.value.upper = isNaN(p) ? "" : p;
                    this.onUpdate?.();
                });
                return [inpLower, " and ", inpUpper];
            } else if (condition === "is below") {
                const inp = $(`<input type="number" value="${value ?? ""}" placeholder="Max">`);
                inp.on("input", e => {
                    const p = parseFloat(e.target.value);
                    this.tagData.value = isNaN(p) ? "" : p;
                    this.onUpdate?.();
                });
                return inp;
            } else if (condition === "is above") {
                const inp = $(`<input type="number" value="${value ?? ""}" placeholder="Min">`);
                inp.on("input", e => {
                    const p = parseFloat(e.target.value);
                    this.tagData.value = isNaN(p) ? "" : p;
                    this.onUpdate?.();
                });
                return inp;
            }
        } else if (type === "time") {
            // Placeholder for time input
            return document.createTextNode("Time input not implemented");
        } else if (type === "color") {
            // Placeholder for color input
            return document.createTextNode("Color input not implemented");
        } else if (type === "list") {
            const sel = $(`<select></select>`);
            (options || []).forEach(opt => sel.append($(`<option value="${opt}">${opt}</option>`)));
            sel.val(value);
            sel.on("change", () => {
                this.tagData.value = sel.val();
                this.onUpdate?.();
            });
            return sel;
        } else if (type === "location") {
            // Placeholder for location input
            return document.createTextNode("Location input not implemented");
        }
        return document.createTextNode("Unknown input type");
    }

    bindEvents() {
        this.$el.on("change", ".tag-condition", e => this.setCondition(e.target.value))
            .on("click", ".tag-remove", () => {
                this.remove();
                this.onUpdate?.();
            });
    }

    setCondition(newCondition) {
        this.tagData.condition = newCondition;
        // Reset value based on condition
        this.tagData.value = (newCondition === "is between") ? { lower: "", upper: "" } : "";
        this.render();
        this.onUpdate?.();
    }
}

export class Edit extends UIComponent {
    #savedSelection = null;
    ontologyBrowser;
    toolbar;

    constructor(toolbar) {
        super("#editor");
        this.toolbar = $(toolbar);
        this.ontologyBrowser = new OntologyBrowser(tag => this.insertTag(tag));
        this.setupFormattingButtons();
        this.bindEvents();
    }

    bindEvents() {
        this.$el.on("mouseup keyup", () => {
            this.#savedSelection = window.getSelection()?.rangeCount > 0 ? window.getSelection().getRangeAt(0).cloneRange() : null;
        }).on("keydown", e => {
            if (e.code === "Enter") {
                e.preventDefault();
                this.insertLineBreak();
            } else {
                this.setupKeyboardShortcuts(e);
            }
        }).on("input", () => {
            this.sanitizeContent();
            if (this.#savedSelection) this.restoreSelection();
        });
    }

    setupKeyboardShortcuts(e) {
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'b':
                    e.preventDefault();
                    document.execCommand('bold', false, null);
                    break;
                case 'i':
                    e.preventDefault();
                    document.execCommand('italic', false, null);
                    break;
                case 'u':
                    e.preventDefault();
                    document.execCommand('underline', false, null);
                    break;
            }
        }
    }

    insertLineBreak() {
        if (!this.#savedSelection) return;
        const br = document.createElement("br");
        this.#savedSelection.insertNode(br);
        if (this.isCaretAtEnd()) this.#savedSelection.insertNode(document.createTextNode("\u200B"));
        this.#savedSelection.setStartAfter(br);
        this.#savedSelection.collapse(true);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(this.#savedSelection);
        this.#savedSelection = window.getSelection().getRangeAt(0).cloneRange();
    }

    sanitizeContent() {
        const current = this.$el.html();
        const sanitized = DOMPurify.sanitize(current, {
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id"]
        });
        if (current !== sanitized) this.$el.html(sanitized);
    }

    restoreSelection() {
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.#savedSelection);
    }

    ensureFocus() {
        if (this.$el.is(":focus")) return;
        this.$el.focus();
        if (!window.getSelection()?.rangeCount) {
            const range = document.createRange();
            range.selectNodeContents(this.$el[0]);
            range.collapse(false);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            this.#savedSelection = range.cloneRange();
        }
    }

    isCaretAtEnd() {
        if (!window.getSelection()?.rangeCount) return false;
        const range = window.getSelection().getRangeAt(0);
        const endNode = range.endContainer;
        return endNode.nodeType === Node.TEXT_NODE
            ? range.endOffset === endNode.textContent.length
            : range.endOffset === endNode.childNodes.length || (endNode === this.$el[0] && range.endOffset === this.$el[0].childNodes.length);
    }

    getContent() {
        return this.$el.html();
    }

    setContent(html) {
        this.$el.html(html);
        this.sanitizeContent();
    }

    insertNodeAtCaret(node) {
        this.ensureFocus();
        this.restoreSelection();
        const sel = window.getSelection();
        if (!sel?.rangeCount) return;

        let range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        if (this.isCaretAtEnd()) range.insertNode(document.createTextNode("\u200B"));
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.#savedSelection = range.cloneRange();
    }

    insertTag(tagData) {
        // Use tagData.name instead of tagData.category
        const tagComponent = new InlineTag(
            { name: tagData.name, condition: tagData.condition || "is" },
            () => this.applyAutosuggestUnderlines()
        );
        this.insertNodeAtCaret(tagComponent.$el[0]);
    }

    serialize() {
        let content = "";
        this.$el.contents().each((_, element) => {
            if (element.nodeType === Node.TEXT_NODE) {
                content += element.textContent;
            } else if (element.classList?.contains("inline-tag")) {
                const instance = $(element).data('instance');
                if (instance) {
                    content += `[TAG:${JSON.stringify(instance.tagData)}]`;
                } else {
                    console.warn("Inline tag missing instance:", element);
                    content += element.outerHTML;
                }
            } else if (element.tagName === "BR") {
                content += "\n";
            } else {
                content += element.outerHTML;
            }
        });
        return content;
    }

    deserialize(text) {
        this.$el.empty();
        const tagRegex = /\[TAG:(.*?)\]/g;
        let lastIndex = 0;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                this.$el.append(document.createTextNode(text.substring(lastIndex, match.index)));
            }
            try {
                const data = JSON.parse(match[1]);
                const tag = new InlineTag(data, () => this.applyAutosuggestUnderlines());
                this.insertNodeAtCaret(tag.$el[0]);
            } catch (err) {
                console.error("Failed to parse tag data:", err);
                this.$el.append(document.createTextNode(match[0]));
            }
            lastIndex = tagRegex.lastIndex;
        }
        if (lastIndex < text.length) {
            this.$el.append(document.createTextNode(text.substring(lastIndex)));
        }
    }

    setupFormattingButtons() {
        const cmdMap = [
            [$("<button title='Bold (Ctrl+B)'><strong style='font-size: 1.2em;'>B</strong></button>"), "bold"],
            [$("<button title='Italic (Ctrl+I)'><em style='font-size: 1.2em;'>I</em></button>"), "italic"],
            [$("<button title='Underline (Ctrl+U)'><u style='font-size: 1.2em;'>U</u></button>"), "underline"],
            [$("<button title='Heading 1'><h1 style='font-size: 1.2em;'>H1</h1></button>"), "formatBlock", "H1"],
            [$("<button title='Heading 2'><h2 style='font-size: 1.2em;'>H2</h2></button>"), "formatBlock", "H2"],
            [$("<button title='Heading 3'><h3 style='font-size: 1.2em;'>H3</h3></button>"), "formatBlock", "H3"],
            [$("<button title='Unordered List'>UL</button>"), "insertUnorderedList"],
            [$("<button title='Ordered List'>OL</button>"), "insertOrderedList"],
            [$("<button title='Clear Formatting'>Unformat</button>"), "removeFormat"]
        ];
        cmdMap.forEach(([btn, cmd, arg]) => {
            btn.on("click", () => document.execCommand(cmd, false, arg || null));
            this.toolbar.append(btn);
        });
    }

    async applyAutosuggestUnderlines() {
        const walker = document.createTreeWalker(this.$el[0], NodeFilter.SHOW_TEXT, {
            acceptNode: node => (node.parentNode.closest(".inline-tag, .autosuggest") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
        });
        const wordRegex = /\b([a-zA-Z]{3,})\b/g;
        let node;
        while ((node = walker.nextNode())) {
            if (!node.nodeValue.trim()) continue;
            wordRegex.lastIndex = 0;
            let match;
            let wrap = false;
            while ((match = wordRegex.exec(node.nodeValue)) !== null) {
                if (await this.matchesOntology(match[1])) {
                    wrap = true;
                    break;
                }
            }
            if (wrap) this.wrapMatches(node, wordRegex);
        }
    }

    async matchesOntology(word) {
        const lower = word.toLowerCase();
        for (const cat in LowerCaseTagOntology) {
            for (const t of LowerCaseTagOntology[cat]) {
                if (t.nameLower.startsWith(lower)) return true;
            }
        }
        return false;
    }

    wrapMatches(textNode, regex) {
        const text = textNode.nodeValue;
        const frag = document.createDocumentFragment();
        let lastIndex = 0;
        regex.lastIndex = 0;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const start = match.index;
            const end = regex.lastIndex;
            if (start > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
            const span = $("<span>").addClass("autosuggest").text(match[1]);
            frag.appendChild(span[0]);
            lastIndex = end;
        }
        if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        textNode.parentNode.replaceChild(frag, textNode);
    }

    showSuggestionsForSpan(span) {
        const word = span.textContent;
        const suggestions = [];
        Object.keys(TagOntology).forEach(cat => {
            TagOntology[cat].forEach(tag => {
                if (tag.name.toLowerCase().startsWith(word.toLowerCase())) {
                    suggestions.push({ displayText: tag.name, tagData: tag, span });
                }
            });
        });
        if (!suggestions.length) return;
        const rect = span.getBoundingClientRect();
        // Placeholder for suggestion dropdown (not implemented in snippet)
        console.log("Suggestions:", suggestions, "at", rect.left, rect.bottom);
    }
}