import {UIComponent} from "./view.js";
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.js";
import { TagOntology } from './ontology.js';

class InlineTag extends UIComponent {
    constructor(tagData, onUpdate) {
        super(`<span class="inline-tag" contenteditable="false" tabindex="0" id="${nanoid()}"></span>`);
        this.tagData = { name: tagData.name, condition: tagData.condition || getTagDefinition(tagData.name).conditions[0], value: tagData.value ?? '' };
        this.onUpdate = onUpdate;
        this.render();
    }

    render() {
        const { name, condition, value } = this.tagData;
        const tagDef = getTagDefinition(name);
        this.$el.empty().append(
            `<span class="tag-name">${name}</span>`,
            `<select class="tag-condition">${tagDef.conditions.map(c => `<option value="${c}" ${c === condition ? 'selected' : ''}>${c}</option>`).join('')}</select>`,
            this.createValueInput(tagDef, condition, value),
            `<button class="tag-remove">×</button>`
        );
        this.bindEvents();
    }

    createValueInput(tagDef, condition, value) {
        if (condition === "between" && tagDef.name === "time") {
            const makeInput = (className, val = "") => `<input type="datetime-local" class="tag-value ${className}" value="${val}">`;
            return [
                makeInput("lower", value?.start ? format(parseISO(value.start), "yyyy-MM-dd'T'HH:mm") : ""),
                " and ",
                makeInput("upper", value?.end ? format(parseISO(value.end), "yyyy-MM-dd'T'HH:mm") : "")
            ];
        } else if (condition === "between" && tagDef.name === "number") {
            const makeInput = (className, val = "") => `<input type="number" class="tag-value ${className}" value="${val}">`;
            return [makeInput("lower", value?.lower), " and ", makeInput("upper", value?.upper)];
        } else if (tagDef.name === "time") {
            const formattedValue = value ? format(parseISO(value), "yyyy-MM-dd'T'HH:mm") : "";
            return `<input type="datetime-local" class="tag-value" value="${formattedValue}">`
        } else {
            return `<input type="text" class="tag-value" value="${DOMPurify.sanitize(value)}">`;
        }
    }

    bindEvents() {
        this.$el.on("change", ".tag-condition", (e) => this.setCondition(e.target.value))
            .on("input", ".tag-value", () => this.updateValue())
            .on("click", ".tag-remove", () => { this.remove(); this.onUpdate?.(); });
    }

    setCondition(newCondition) {
        this.tagData.condition = newCondition;
        this.tagData.value = (newCondition === "between") ? { lower: "", upper: "" } : '';
        this.render();
        this.onUpdate?.();
    }

    updateValue() {
        const tagDef = getTagDefinition(this.tagData.name);
        let newValue;
        // ... (existing between logic for time and number)

        if (this.tagData.condition === "between" && tagDef.name === "number") {
            newValue = {
                lower: this.$el.find(".lower").val(),
                upper: this.$el.find(".upper").val(),
            };
        }
        else {
            newValue = this.$el.find(".tag-value").val();
        }

        if (tagDef.validate(newValue, this.tagData.condition)) {
            this.tagData.value = newValue;
            this.$el.find(".tag-value").removeClass("invalid-tag"); // Remove error class
            this.onUpdate?.();
        } else {
            this.$el.find(".tag-value").addClass("invalid-tag"); // Add error class
            // Optionally show an inline error message
        }
    }

}

export class Edit extends UIComponent {
    #savedSelection = null;
    constructor() {
        super("#editor");
        this.bindEvents();
    }

    bindEvents() {
        this.$el.on("mouseup keyup", () => this.#savedSelection = window.getSelection()?.rangeCount > 0 ? window.getSelection().getRangeAt(0).cloneRange() : null)
            .on("keydown", e => e.code === "Enter" && (e.preventDefault(), this.insertLineBreak()))
            .on("input", () => { this.sanitizeContent(); this.#savedSelection && this.restoreSelection(); });
    }

    insertLineBreak() {
        if (!this.#savedSelection) return;
        const br = document.createElement("br");
        this.#savedSelection.insertNode(br);
        this.isCaretAtEnd() && this.#savedSelection.insertNode(document.createElement("br"));
        this.#savedSelection.setStartAfter(br);
        this.#savedSelection.collapse(true);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(this.#savedSelection);
        this.#savedSelection = window.getSelection().getRangeAt(0).cloneRange();
    }

    sanitizeContent() {
        const current = this.$el.html();
        const sanitized = DOMPurify.sanitize(current, { ALLOWED_TAGS: ["br", "b", "i", "span"], ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"] });
        current !== sanitized && this.$el.html(sanitized);
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
            this.#savedSelection = window.getSelection().getRangeAt(0).cloneRange();
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

    getContent() { return this.$el.html(); }
    setContent(html) { this.$el.html(html); this.sanitizeContent(); }

    insertNodeAtCaret(node) {
        this.ensureFocus();
        this.restoreSelection();
        const sel = window.getSelection();
        if (!sel?.rangeCount) return;

        let range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(node);
        range.setStartAfter(node);
        this.isCaretAtEnd() ? range.insertNode(document.createTextNode("\u200B")) : null;
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.#savedSelection = window.getSelection().getRangeAt(0).cloneRange();
    }
}

export class Tagger extends UIComponent {
    constructor(editor, onUpdate) {
        super();
        this.editor = editor;
        this.onUpdate = onUpdate;
        this.fuse = new Fuse(Object.keys(TagOntology), { shouldSort: true, threshold: 0.4 });
        this.initPopup();
    }

    initPopup() {
        this.$popup = $("#tag-popup");
        if (this.$popup.length) return;

        this.$popup = $(`<div id="tag-popup" class="popup-menu">
                            <input type="text" id="tag-search" placeholder="Search tags...">
                            <ul></ul>
                        </div>`).hide().appendTo("body");
        this.$search = this.$popup.find("#tag-search");
        this.$list = this.$popup.find("ul");

        this.$search.on("input", () => this.renderTagList(this.$search.val()));
        this.$popup.on("keydown", e => {
            if (e.key === "Escape") { this.hide(); this.editor.$el.focus(); return; }
            const items = this.$list.find("li");
            let idx = items.index(items.filter(":focus"));
            if (e.key === "ArrowDown") { e.preventDefault(); idx = (idx + 1) % items.length; items.eq(idx).focus(); }
            if (e.key === "ArrowUp") { e.preventDefault(); idx = (idx - 1 + items.length) % items.length; items.eq(idx).focus(); }
            if (e.key === "Enter") { e.preventDefault(); items.filter(":focus").click(); }
        });
        $(document).on("click.tagger", e => !$(e.target).closest("#tag-popup, #insert-tag-btn").length && this.hide());
    }

    renderTagList(query = "") {
        this.$list.empty();
        const results = query ? this.fuse.search(query) : Object.keys(TagOntology).map(item => ({ item }));
        results.forEach(({ item }) =>
            this.$list.append($(`<li>${item}</li>`).on("click", () => { this.insertTag(item); this.hide(); }))
        );
    }

    show(e) {
        e?.stopPropagation();
        this.editor.ensureFocus();
        this.editor.saveSelection();
        this.renderTagList();
        const coords = this.caretCoord();
        this.$popup.css({ left: coords.x, top: coords.y + 20 }).show();
        this.$search.val("").focus();
    }

    hide() { this.$popup.hide(); }

    caretCoord() {
        const sel = window.getSelection();
        if (!sel?.rangeCount) {
            const offset = this.editor.$el.offset();
            return { x: offset.left, y: offset.top };
        }
        const range = sel.getRangeAt(0).cloneRange();
        range.collapse(true);
        return range.getBoundingClientRect();
    }

    insertTag(tag) {
        const tagComponent = new InlineTag({ name: tag }, this.onUpdate);
        this.editor.insertNodeAtCaret(tagComponent.$el[0]);
    }
}
