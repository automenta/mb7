import DOMPurify from 'dompurify';
import $ from 'jquery';
import { nanoid } from 'nanoid';
import{UIComponent}from "./view.js";
import{TagOntology}from './ontology.js';
const LowerCaseTagOntology = {};
for (const cat in TagOntology) {
    LowerCaseTagOntology[cat] = TagOntology[cat];
}
import{OntologyBrowser}from './ontology_browser.js';

class InlineTag extends UIComponent{
    constructor(tagData, onUpdate){
        super(`<span class="inline-tag" contenteditable="false" tabindex="0" id="${nanoid()}"></span>`);
        this.tagData ={
            name: tagData.name,
            condition: tagData.condition || getTagDefinition(tagData.name).conditions[0],
            value: tagData.value ?? ''
       };
        this.onUpdate = onUpdate;
        this.render();
   }

    render(){
        const{name, condition, value}= this.tagData;
        const tagDef = getTagDefinition(name);
        this.$el.empty().append(
            `<span class="tag-name">${name}</span>`,
            `<select class="tag-condition">${tagDef.conditions.map(c => `<option value="${c}" ${c === condition ? 'selected' : ''}>${c}</option>`).join('')}</select>`,
            this.createValueInput(tagDef, condition, value),
            `<button class="tag-remove">×</button>`
        );
        this.bindEvents();
   }

    createValueInput(tagDef, condition, value){
        const{type, unit, options}= tagDef;
        const{mode, min, max}= this.tagData;

        if (["number", "range"].includes(type)){
            if (mode === "is"){
                const inp = $(`<input type="number" value="${this.tagData.value ?? ""}" placeholder="Value">`);
                inp.on("input", e =>{
                    const p = parseFloat(e.target.value);
                    if (!isNaN(p)) this.tagData.value = p;
                    this.onUpdate?.();
               });
                return inp;
                //if (this.tagData.unit) this.$el.append($(`<span class="unit-label"> ${this.tagData.unit}</span>`));
           }else if (mode === "is between"){
                const inpMin = $(`<input type="number" value="${min ?? ""}" placeholder="Min">`);
                inpMin.on("input", e =>{
                    const p = parseFloat(e.target.value);
                    this.tagData.min = isNaN(p) ? 0 : p;
                    this.onUpdate?.();
               });
                const inpMax = $(`<input type="number" value="${max ?? ""}" placeholder="Max">`);
                inpMax.on("input", e =>{
                    const p = parseFloat(e.target.value);
                    this.tagData.max = isNaN(p) ? 0 : p;
                    this.onUpdate?.();
               });
                return [inpMin, " and ", inpMax];
                //if (this.tagData.unit) this.$el.append($(`<span class="unit-label"> ${this.tagData.unit}</span>`));
           }else if (mode === "is below"){
                const inp = $(`<input type="number" value="${max ?? ""}" placeholder="Max">`);
                inp.on("input", e =>{
                    const p = parseFloat(e.target.value);
                    this.tagData.max = isNaN(p) ? 0 : p;
                    this.onUpdate?.();
               });
                return inp;
                //if (this.tagData.unit) this.$el.append($(`<span class="unit-label"> ${this.tagData.unit}</span>`));
           }else if (mode === "is above"){
                const inp = $(`<input type="number" value="${min ?? ""}" placeholder="Min">`);
                inp.on("input", e =>{
                    const p = parseFloat(e.target.value);
                    this.tagData.min = isNaN(p) ? 0 : p;
                    this.onUpdate?.();
               });
                return inp;
                //if (this.tagData.unit) this.$el.append($(`<span class="unit-label"> ${this.tagData.unit}</span>`));
           }
       }else if (type === "time"){
            // TODO: Implement time input
            return document.createTextNode("Time input not implemented");
       }else if (type === "color"){
            // TODO: Implement color input
            return document.createTextNode("Color input not implemented");
       }else if (type === "list"){
            const sel = $(`<select></select>`);
            (options || []).forEach(opt => sel.append($(`<option value="${opt}">${opt}</option>`)));
            sel.val(this.tagData.value);
            sel.on("change", () =>{
                this.tagData.value = sel.val();
                this.onUpdate?.();
           });
            return sel;
       }else if (type === "location"){
            // TODO: Implement location input
            return document.createTextNode("Location input not implemented");
       }
        return document.createTextNode("Unknown input type");
   }

    bindEvents(){
        this.$el.on("change", ".tag-condition", (e) => this.setCondition(e.target.value))
            .on("click", ".tag-remove", () =>{
                this.remove();
                this.onUpdate?.();
           });
   }

    setCondition(newCondition){
        this.tagData.condition = newCondition;
        this.tagData.value = (newCondition === "between") ?{lower: "", upper: ""}: '';
        this.render();
        this.onUpdate?.();
   }

    updateValue(){
        const tagDef = getTagDefinition(this.tagData.name);
        let newValue;
        // ... (existing between logic for time and number)

        if (this.tagData.condition === "between" && tagDef.name === "number"){
            newValue ={
                lower: this.$el.find(".lower").val(),
                upper: this.$el.find(".upper").val(),
           };
       }else{
            newValue = this.$el.find(".tag-value").val();
       }

        if (tagDef.validate(newValue, this.tagData.condition)){
            this.tagData.value = newValue;
            this.$el.find(".tag-value").removeClass("invalid-tag"); // Remove error class
            this.onUpdate?.();
       }else{
            this.$el.find(".tag-value").addClass("invalid-tag"); // Add error class
            // Optionally show an inline error message
       }
   }
}

export class Edit extends UIComponent{
    #savedSelection = null;
    ontologyBrowser;
    toolbar;

    constructor(){
        super("#editor");
        this.ontologyBrowser = new OntologyBrowser((tagData) => this.insertTag(tagData));
        this.createUI();
        this.setupFormattingButtons();
        this.bindEvents();
   }

    bindEvents(){
        this.$el.on("mouseup keyup", () => this.#savedSelection = window.getSelection()?.rangeCount > 0 ? window.getSelection().getRangeAt(0).cloneRange() : null)
            .on("keydown", e => e.code === "Enter" && (e.preventDefault(), this.insertLineBreak()))
            .on("input", () =>{
                this.sanitizeContent();
                this.#savedSelection && this.restoreSelection();
           });
   }

    insertLineBreak(){
        if (!this.#savedSelection) return;
        const br = document.createElement("br");
        this.#savedSelection.insertNode(br);
        this.isCaretAtEnd() && this.#savedSelection.insertNode(document.createTextNode("\u200B"));
        this.#savedSelection.setStartAfter(br);
        this.#savedSelection.collapse(true);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(this.#savedSelection);
        this.#savedSelection = window.getSelection().getRangeAt(0).cloneRange();
   }

    sanitizeContent(){
        const current = this.$el.html();
        const sanitized = DOMPurify.sanitize(current,{
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
       });
        current !== sanitized && this.$el.html(sanitized);
   }

    restoreSelection(){
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(this.#savedSelection);
   }

    ensureFocus(){
        if (this.$el.is(":focus")) return;
        this.$el.focus();
        if (!window.getSelection()?.rangeCount){
            const range = document.createRange();
            range.selectNodeContents(this.$el[0]);
            range.collapse(false);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            this.#savedSelection = window.getSelection().getRangeAt(0).cloneRange();
       }
   }

    isCaretAtEnd(){
        if (!window.getSelection()?.rangeCount) return false;
        const range = window.getSelection().getRangeAt(0);
        const endNode = range.endContainer;
        return endNode.nodeType === Node.TEXT_NODE
            ? range.endOffset === endNode.textContent.length
            : range.endOffset === endNode.childNodes.length || (endNode === this.$el[0] && range.endOffset === this.$el[0].childNodes.length);
   }

    getContent(){
        return this.$el.html();
   }

    setContent(html){
        this.$el.html(html);
        this.sanitizeContent();
   }

    insertNodeAtCaret(node){
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

    insertTag(tagData){
        const tagComponent = new InlineTag(tagData, this.onUpdate);
        this.insertNodeAtCaret(tagComponent.$el[0]);
   }

    serialize(){
        let content = "";
        this.$el.contents().each((index, element) =>{
            if (element.nodeType === Node.TEXT_NODE){
                content += element.textContent;
           }else if (element.classList?.contains("inline-tag")){
                const tagData = element.tagData;
                content += `[TAG:${JSON.stringify(tagData)}]`;
           }else if (element.tagName === "BR"){
                content += "\n";
           }
       });
        return content;
   }

    deserialize(text){
        this.$el.empty();
        const tagRegex = /\[TAG:(.*?)\]/g;
        let lastIndex = 0, match;
        while ((match = tagRegex.exec(text)) !== null){
            if (match.index > lastIndex){
                this.$el.append(document.createTextNode(text.substring(lastIndex, match.index)));
           }
            try{
                const data = JSON.parse(match[1]);
                const tag = new InlineTag(data, this.onUpdate);
                this.insertNodeAtCaret(tag.$el[0]);
           }catch (err){
                console.error("Failed to parse tag data:", err);
                this.$el.append(document.createTextNode(match[0]));
           }
            lastIndex = tagRegex.lastIndex;
       }
        if (lastIndex < text.length){
            this.$el.append(document.createTextNode(text.substring(lastIndex)));
       }
   }

    setupFormattingButtons(){
        const cmdMap = [
            [$("<button title='Bold (Ctrl+B)'><strong>B</strong></button>"), "bold"],
            [$("<button title='Italic (Ctrl+I)'><em>I</em></button>"), "italic"],
            [$("<button title='Underline (Ctrl+U)'><u>U</u></button>"), "underline"],
            [$("<button title='Strike Through'>S</button>"), "strikeThrough"],
            [$("<button title='Clear Formatting'>Unformat</button>"), "removeFormat"],
        ];
        cmdMap.forEach(([btn, cmd]) =>{
            btn.on("click", () => document.execCommand(cmd, false, null));
            this.toolbar.append(btn);
       });
   }

    createUI(){
        this.toolbar = $("<div></div>").attr("id", "toolbar").insertBefore(this.$el);
   }

    async applyAutosuggestUnderlines(){
        const walker = document.createTreeWalker(this.$el[0], NodeFilter.SHOW_TEXT,{
            acceptNode: node => (node.parentNode.closest(".inline-tag, .autosuggest") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT)
       });
        const wordRegex = /\b([a-zA-Z]{3,})\b/g;
        let node;
        while ((node = walker.nextNode())){
            if (!node.nodeValue.trim()) continue;
            wordRegex.lastIndex = 0;
            let match, wrap = false;
            while ((match = wordRegex.exec(node.nodeValue)) !== null){
                if (await this.matchesOntology(match[1])){
                    wrap = true;
                    break;
               }
           }
            if (wrap) this.wrapMatches(node, wordRegex);
       }
   }

    async matchesOntology(word){
            const lower = word.toLowerCase();
            for (const cat in LowerCaseTagOntology){
                for (const t of LowerCaseTagOntology[cat]){
                    if (t.nameLower.startsWith(lower)) return true;
               }
           }
            return false;
       }

    wrapMatches(textNode, regex){
        const text = textNode.nodeValue;
        const frag = document.createDocumentFragment();
        let lastIndex = 0, match;
        regex.lastIndex = 0;
        while ((match = regex.exec(text)) !== null){
            const start = match.index, end = regex.lastIndex;
            if (start > lastIndex) frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
            const span = $("<span></span>").addClass("autosuggest").text(match[1]);
            frag.appendChild(span[0]);
            lastIndex = end;
       }
        if (lastIndex < text.length) frag.appendChild(document.createTextNode(text.slice(lastIndex)));
        textNode.parentNode.replaceChild(frag, textNode);
   }

    showSuggestionsForSpan(span){
        const word = span.textContent;
        const suggestions = [];
        Object.keys(TagOntology).forEach(cat =>{
            TagOntology[cat].forEach(tag =>{
                if (tag.name.toLowerCase().startsWith(word.toLowerCase())){
                    suggestions.push({displayText: tag.name, tagData: tag, span});
               }
           });
       });
        if (!suggestions.length) return;
        const rect = span.getBoundingClientRect();
        //this.suggestionDropdown.show(suggestions, rect.left + window.scrollX, rect.bottom + window.scrollY,
        // choice => this.insertTagFromSuggestion(choice));
   }
}
