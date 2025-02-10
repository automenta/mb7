import * as Net from "./net.js";
import * as DB from "./db.js";
import {
    format,
    formatISO,
    isValid as isValidDate,
    parseISO
} from "https://cdn.jsdelivr.net/npm/date-fns@2.29.3/esm/index.js";
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.js";
import {nanoid} from "https://cdn.jsdelivr.net/npm/nanoid@5.0.9/nanoid.js";

function formatDate(timestamp) {
    if (!timestamp) return "";
    else {
        const date = typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp);
        return isValidDate(date) ? format(date, localStorage.getItem("dateFormat") || "Pp") : "";
    }
}

function bind(selector, event, handler, delegate = null) {
    $(selector).off(event, delegate).on(event, delegate, handler);
}

const Ontology = {
    General: {
        Location: {
            dataType: "location",
            conditions: {exact: {label: "is exactly"}, contains: {label: "contains"}, regex: {label: "matches regex"}},
            defaultCondition: "exact",
            allowedNatures: ["definite", "indefinite"]
        },
        Time: {
            dataType: "time",
            conditions: {
                exact: {label: "is exactly"},
                before: {label: "is before"},
                after: {label: "is after"},
                between: {label: "is between"},
                regex: {label: "matches regex"}
            },
            defaultCondition: "exact",
            allowedNatures: ["definite", "indefinite"]
        },
        Description: {
            dataType: "string",
            conditions: {exact: {label: "is"}, contains: {label: "contains"}, regex: {label: "matches regex"}},
            defaultCondition: "exact",
            allowedNatures: ["definite"]
        }
    },
    Emotion: {
        Mood: {
            dataType: "string",
            conditions: {exact: {label: "is"}, contains: {label: "contains"}, regex: {label: "matches regex"}},
            defaultCondition: "exact",
            allowedNatures: ["definite"]
        }
    }
};

function flattenOntology(ont) {
    return Object.entries(ont)
        .flatMap(([category, tags]) =>
            Object.entries(tags).map(([name, def]) => ({name: name.toLowerCase(), category, ...def}))
        );
}

let availableTags = flattenOntology(Ontology);

function getTagDefinition(tagName) {
    return availableTags.find(t => t.name === tagName.toLowerCase()) || {
        name: tagName.toLowerCase(),
        dataType: "string",
        conditions: {exact: {label: "is"}, contains: {label: "contains"}, regex: {label: "matches regex"}},
        defaultCondition: "exact",
        allowedNatures: ["definite"]
    };
}

class UIComponent {
    constructor(selector = null, templateHTML = null) {
        this.$el = selector ? $(selector) : templateHTML ? $(templateHTML) : $("<div></div>");
    }
}

class Editor extends UIComponent {
    #savedSelection = null;

    constructor() {
        super("#editor");
        this.bindEvents();
    }

    bindEvents() {
        this.$el
            .on("mouseup keyup", () => this.saveSelection())
            .on("keydown", (e) => {
                if (e.code === "Enter") {
                    e.preventDefault();
                    this.insertLineBreak();
                }
            })
            .on("input", () => {
                this.sanitizeContent();
                this.restoreSelection();
            });
    }

    insertLineBreak() {
        this.ensureFocus();
        this.restoreSelection();
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            const isEnd = this.isCaretAtEnd();
            const frag = document.createRange().createContextualFragment(isEnd ? "<br><br>" : "<br>");
            range.insertNode(frag);
            range.collapse(false);
            sel.removeAllRanges();
            sel.addRange(range);
            this.saveSelection();
        }
    }

    sanitizeContent() {
        const safe = DOMPurify.sanitize(this.$el.html(), {
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
        });
        this.$el.html(safe);
    }

    saveSelection() {
        const sel = window.getSelection();
        if (sel && sel.rangeCount) {
            this.#savedSelection = sel.getRangeAt(0).cloneRange();
        }
    }

    restoreSelection() {
        if (this.#savedSelection) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.#savedSelection);
        }
    }

    ensureFocus() {
        if (!this.$el.is(":focus")) {
            this.$el.focus();
            const sel = window.getSelection();
            if (!sel?.rangeCount) {
                const range = document.createRange();
                range.selectNodeContents(this.$el[0]);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            this.saveSelection();
        }
    }

    isCaretAtEnd() {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return false;
        const range = sel.getRangeAt(0);
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
        if (sel?.rangeCount) {
            const range = sel.getRangeAt(0);
            range.deleteContents();
            range.insertNode(node);
            range.setStartAfter(node);
            sel.removeAllRanges();
            sel.addRange(range);
            this.saveSelection();
        }
    }
}

class InlineTag extends UIComponent {
    #tagDef;
    #condition;
    #value;
    #debouncedUpdate;

    constructor(tagDef, options = {}) {
        super(null, `<span class="inline-tag" contenteditable="false" tabindex="0" id="${nanoid()}"></span>`);
        this.#tagDef = tagDef;
        this.#condition = tagDef.defaultCondition || "exact";
        this.#value = this.#condition === "between" ? {lower: "", upper: ""} : "";
        this.options = options;
        this.#debouncedUpdate = _.debounce(() => this.options.onUpdate?.(), 500);
        this.render();
    }

    render() {
        this.$el.empty().append(
            $(`<span class="tag-name" title="${this.#tagDef.category}">${this.#tagDef.name}</span>`),
            this.createConditionSelect(),
            this.createValueInputs(),
            $('<button class="tag-remove" aria-label="Remove tag">×</button>')
        );
        this.bindEvents();
    }

    createConditionSelect() {
        const $select = $('<select class="tag-condition" aria-label="Condition"></select>');
        Object.entries(this.#tagDef.conditions).forEach(([cond, {label}]) => {
            $select.append($(`<option value="${cond}" ${cond === this.#condition ? 'selected' : ''}>${label}</option>`));
        });
        return $select;
    }

    createValueInputs() {
        const dataType = this.#tagDef.dataType;
        const inputType = dataType === "time" ? "datetime-local" : "text";

        const makeInput = (className, placeholder, val = "") => $(`<input type="${inputType}" class="tag-value ${className}" placeholder="${placeholder}" value="${DOMPurify.sanitize(val)}">`);

        if (this.#condition === "between") {
            let lowerVal = "", upperVal = "";
            if (typeof this.#value === "object") {
                const val = this.#value;
                lowerVal = dataType === "time" ? (val.lower ? format(parseISO(val.lower), "yyyy-MM-dd'T'HH:mm") : "") : (val.lower || "");
                upperVal = dataType === "time" ? (val.upper ? format(parseISO(val.upper), "yyyy-MM-dd'T'HH:mm") : "") : (val.upper || "");
            }
            return [makeInput("lower", "min", lowerVal), " and ", makeInput("upper", "max", upperVal)];
        } else {
            let val;
            if (this.#value && dataType === "time")
                val = format(parseISO(this.#value), "yyyy-MM-dd'T'HH:mm");
            else if (typeof this.#value === "string")
                val = this.#value;
            else
                val = "";
            return makeInput("", "Enter value", val);
        }
    }


    bindEvents() {
        this.$el.on("change", ".tag-condition", (e) => this.setCondition(e.target.value));
        this.$el.on("input", ".tag-value", () => this.updateFromInputs());
        this.$el.on("click", ".tag-remove", (e) => {
            e.preventDefault();
            this.remove();
        });
    }

    setCondition(newCond) {
        if (this.#condition !== newCond) {
            this.#condition = newCond;
            this.#value = newCond === "between" ? {lower: "", upper: ""} : "";
            this.render();
            this.options.onUpdate?.();
        }
    }

    updateFromInputs() {
        const dataType = this.#tagDef.dataType;
        const updateValue = (val) => {
            if (dataType === "time") {
                const parsedDate = parseISO(val);
                return val && isValidDate(parsedDate) ? formatISO(parsedDate) : "";
            } else {
                return val;
            }
        };

        if (this.#condition === "between") {
            const lowerRaw = this.$el.find(".tag-value.lower").val();
            const upperRaw = this.$el.find(".tag-value.upper").val();
            const newVal = {lower: updateValue(lowerRaw), upper: updateValue(upperRaw)};

            if (!_.isEqual(this.#value, newVal)) {
                this.#value = newVal;
                this.#debouncedUpdate();
            }
        } else {
            const rawValue = this.$el.find(".tag-value").val();
            const updatedValue = updateValue(rawValue);
            if (this.#value !== updatedValue) {
                this.#value = updatedValue;
                this.#debouncedUpdate();
            }
        }
    }


    remove() {
        this.$el.remove();
        this.options.onUpdate?.();
    }

    getTagData() {
        return {name: this.#tagDef.name, condition: this.#condition, value: this.#value};
    }
}

class Tagger extends UIComponent {
    constructor(editor, availableTags = [], options = {}) {
        super();
        this.editor = editor;
        this.availableTags = availableTags;
        this.options = options;
        this.fuse = new Fuse(this.availableTags, {keys: ["name"], threshold: 0.3, includeScore: true});
        this.initPopup();
        this.bindGlobalEvents();
    }

    initPopup() {
        this.$popup = $("#tag-popup");
        if (!this.$popup.length) {
            this.$popup = $(`
                <div id="tag-popup" class="popup-menu" role="listbox" aria-labelledby="tag-search">
                  <input type="text" id="tag-search" placeholder="Search tags..." aria-label="Search Tags">
                  <ul></ul>
                </div>
            `).hide().appendTo("body");
        }

        this.$popup.find("#tag-search").on("input", (e) => this.renderTagList(e.target.value.toLowerCase()));

        this.$popup.on("keydown", (e) => {
            if (e.key === "Escape") {
                this.hide();
                this.editor.$el.focus();
            } else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
                e.preventDefault();
                const $items = this.$popup.find("li[role='option']");
                let idx = $items.index($items.filter(":focus"));
                idx = e.key === "ArrowDown" ? (idx + 1) % $items.length : (idx - 1 + $items.length) % $items.length;
                $items.eq(idx).focus();
            } else if (e.key === "Enter") {
                this.$popup.find("li:focus").click();
            }
        });
    }

    bindGlobalEvents() {
        $(document).on("click.tagger", (ev) => {
            if (!$(ev.target).closest("#tag-popup, #insert-tag-btn").length) {
                this.hide();
            }
        });
    }

    renderTagList(query = "") {
        const $ul = this.$popup.find("ul").empty();
        const results = query ? this.fuse.search(query) : this.availableTags.map((tag) => ({item: tag, score: 0}));

        if (!results.length) {
            $ul.append(`<li role="option" aria-disabled="true">No matching tags found.</li>`);
            return;
        }

        results.forEach(({item}) => {
            const highlightedName = item.name.replace(new RegExp(`(${_.escapeRegExp(query)})`, "gi"), "<strong>$1</strong>");
            $ul.append($(`<li role="option" tabindex="0" title="${item.category}">${highlightedName}</li>`).on("click", (ev) => {
                ev.stopPropagation();
                this.insertTag(item);
                this.hide();
                this.editor.$el.focus();
            }));
        });
    }

    show(e) {
        e?.stopPropagation();
        this.editor.ensureFocus();
        this.editor.saveSelection();
        this.renderTagList();
        const coords = this.caretCoord();
        this.$popup.css({left: coords.x + "px", top: (coords.y + 20) + "px"}).show();
        this.$popup.find("#tag-search").val("").focus();
    }

    hide() {
        this.$popup.hide();
    }

    caretCoord() {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            const range = sel.getRangeAt(0).cloneRange();
            range.collapse(true);
            const rect = range.getBoundingClientRect();
            return {x: rect?.left || 0, y: rect?.top || 0};
        } else {
            const offset = this.editor.$el.offset();
            return {x: offset.left, y: offset.top};
        }
    }

    insertTag(tag) {
        this.editor.insertNodeAtCaret(new InlineTag(getTagDefinition(tag.name), {onUpdate: this.options.onWidgetUpdate}).$el[0]);
    }
}

class Sidebar extends UIComponent {
    constructor(app) {
        super(null, `<div class="sidebar-left" role="navigation"></div>`);
        this.app = app;
        this.build();
        this.bindEvents();
    }

    build() {
        this.$el.append(
            this.buildSection("Menu", [
                {label: "Dashboard", view: "dashboard"},
                {label: "Content", view: "content"},
                {label: "Ontology", view: "ontology"},
                {label: "Settings", view: "settings"}
            ], "view"),
            this.buildSection("Links", [{label: "Recent Items", list: "recent"}], "list"),
            this.buildStatus()
        );
    }

    buildSection(title, items, dataAttr) {
        const $ul = $("<ul></ul>");
        items.forEach(item => {
            $ul.append(`<li><a href="#" data-${dataAttr}="${item[dataAttr]}" aria-label="${item.label}">${item.label}</a></li>`);
        });
        return [$(`<h3>${title}</h3>`), $ul, $("<hr>")];
    }

    buildStatus() {
        return [$("<h3>Network</h3>"), $(`<div id="network-status">Connecting...</div>`), $("<hr>")];
    }

    bindEvents() {
        bind(this.$el, "click", (e) => {
            const viewName = $(e.target).closest("a").data("view");
            if (viewName) {
                e.preventDefault();
                this.app.setView(viewName);
            }
        }, "a[data-view]");

        bind(this.$el, "click", async (e) => {
            const listName = $(e.target).closest("a").data("list");
            if (listName === "recent") {
                e.preventDefault();
                this.app.setView("content");
                await this.app.renderList();
            }
        }, "a[data-list='recent']");
    }
}

class ContentView extends UIComponent {
    constructor(app) {
        super(null, `<div id="content-view" class="view"><h2>Content</h2></div>`);
        this.app = app;
        this.build();
        this.bindEvents();
    }

    build() {
        this.$el.append(
            $(`
                <div class="filter-bar">
                    <input type="text" id="search-input" placeholder="Search items..." aria-label="Search items">
                </div>
            `),
            $(`<div id="object-list" aria-live="polite"></div>`),
            $(`<button id="new-object-btn" aria-label="New Object">New Object</button>`),
            $(`
                <div id="editor-container" style="display:none;">
                    <div class="toolbar">
                        <button id="insert-tag-btn" aria-label="Insert Tag">Insert Tag</button>
                    </div>
                    <div id="editor" contenteditable="true" aria-label="Editor text"></div>
                    <div class="metadata-panel">
                        <label for="object-name">Name:</label>
                        <input type="text" id="object-name">
                        <p>Created At: <span id="created-at"></span></p>
                    </div>
                    <button id="save-object-btn" aria-label="Save">Save</button>
                    <button id="cancel-edit-btn" aria-label="Cancel">Cancel</button>
                    <button id="delete-object-btn" aria-label="Delete Object">Delete Object</button>
                </div>
            `)
        );
    }

    bindEvents() {
        bind(this.$el, "input", _.debounce(() => this.app.renderList(this.$el.find("#search-input").val()), 300), "#search-input");
        bind(this.$el, "click", this.app.createNewObject.bind(this.app), "#new-object-btn");
        bind(this.$el, "click", this.app.saveObject.bind(this.app), "#save-object-btn");
        bind(this.$el, "click", this.app.hideEditor.bind(this.app), "#cancel-edit-btn");
        bind(this.$el, "click", this.app.deleteCurrentObject.bind(this.app), "#delete-object-btn");
        bind(this.$el, "click", (e) => {
            e.preventDefault();
            this.app.tagger.show(e);
        }, "#insert-tag-btn");
        bind(this.$el, "click", (e) => this.app.editOrViewObject($(e.target).closest(".object-item").data("id")), ".object-item");
    }

    render() { /* Optional, might be needed later */
    }
}

class OntologyView extends UIComponent {
    constructor(app) {
        super(null, `<div id="ontology-view" class="view"><h2>Ontology</h2></div>`);
        this.app = app;
        this.build();
        this.bindEvents();
    }

    build() {
        this.$el.append(
            $(`<button id="add-category-btn">Add Category</button>`),
            $(`<button id="add-tag-btn">Add Tag</button>`),
            $(`<div id="ontology-list"></div>`),
            $(`<div id="ontology-details" style="display:none;"></div>`),
            $(`<button id="import-ontology-btn">Import Ontology</button>`),
            $(`<button id="export-ontology-btn">Export Ontology</button>`)
        );
    }

    bindEvents() {
        bind(this.$el, "click", this.addCategory, "#add-category-btn");
        bind(this.$el, "click", this.addTag, "#add-tag-btn");
        bind(this.$el, "click", this.importOntology, "#import-ontology-btn");
        bind(this.$el, "click", this.exportOntology, "#export-ontology-btn");
        bind(this.$el, "click", (e) => {
            const {category, tag} = $(e.target).data();
            if (category && tag) this.showTagDetails(category, tag);
        }, ".edit-tag-btn");
    }

    render() {
        const $list = this.$el.find("#ontology-list").empty();
        for (const [category, tags] of Object.entries(Ontology)) {
            const $catDiv = $(`<div><h3>${category}</h3></div>`);
            for (const [tagName] of Object.entries(tags)) {
                $catDiv.append(`<p>${tagName}<button class="edit-tag-btn" data-category="${category}" data-tag="${tagName}">Edit</button></p>`);
            }
            $list.append($catDiv);
        }
        availableTags = flattenOntology(Ontology);
        if (this.app.tagger) {
            this.app.tagger.availableTags = availableTags;
            this.app.tagger.fuse.setCollection(availableTags);
        }
    }

    showTagDetails(category, tagName) {
        const tagDef = Ontology[category][tagName];
        this.$el.find("#ontology-details").empty().show().html(`
          <h3>Edit Tag: <em>${tagName}</em></h3>
          <label>Name: <input type="text" id="edit-tag-name" value="${tagName}"></label><br>
          <label>Category: <input type="text" id="edit-tag-category" value="${category}"></label><br>
          <label>Data Type: <input type="text" id="edit-tag-datatype" value="${tagDef.dataType}"></label><br>
          <label>Conditions: <textarea id="edit-tag-conditions">${JSON.stringify(tagDef.conditions, null, 2)}</textarea></label><br>
          <label>Default Condition: <input type="text" id="edit-tag-default-condition" value="${tagDef.defaultCondition}"></label><br>
          <label>Allowed Natures: <input type="text" id="edit-tag-allowed-natures" value="${(tagDef.allowedNatures || []).join(",")}"></label><br>
          <button id="save-tag-changes-btn">Save Changes</button>
          <button id="delete-tag-btn">Delete Tag</button>
      `);

        bind(this.$el, "click", () => this.saveTagChanges(category, tagName), "#save-tag-changes-btn");
        bind(this.$el, "click", () => this.deleteTag(category, tagName), "#delete-tag-btn");
    }


    saveTagChanges(originalCategory, originalTagName) {
        const $details = this.$el.find("#ontology-details");
        const newTagName = $details.find("#edit-tag-name").val().trim().toLowerCase() || originalTagName;
        const newCategory = $details.find("#edit-tag-category").val().trim();
        const newDataType = $details.find("#edit-tag-datatype").val().trim();
        let newConditions;
        try {
            newConditions = JSON.parse($details.find("#edit-tag-conditions").val());
        } catch {
            this.app.showNotification("Invalid conditions JSON.", "error");
            return;
        }
        const newDefaultCond = $details.find("#edit-tag-default-condition").val().trim();
        const newAllowedNatures = $details.find("#edit-tag-allowed-natures").val().split(",").map(s => s.trim()).filter(Boolean);

        if (!Ontology[originalCategory]?.[originalTagName]) return;

        delete Ontology[originalCategory][originalTagName];
        if (!Object.keys(Ontology[originalCategory]).length) delete Ontology[originalCategory];

        Ontology[newCategory] ??= {};
        Ontology[newCategory][newTagName] = {
            dataType: newDataType,
            conditions: newConditions,
            defaultCondition: newDefaultCond,
            allowedNatures: newAllowedNatures
        };

        this.render();
        $details.hide();
        this.app.showNotification(`Tag "${originalTagName}" updated.`, "success");
    }

    deleteTag(category, tagName) {
        if (confirm(`Delete tag "${tagName}"?`)) {
            delete Ontology[category][tagName];
            if (!Object.keys(Ontology[category]).length) delete Ontology[category];
            this.render();
            this.$el.find("#ontology-details").hide();
            this.app.showNotification(`Tag "${tagName}" deleted.`, "success");
        }
    }

    addCategory() {
        const name = prompt("New category name:");
        if (name) {
            Ontology[name] ??= {};
            this.render();
            this.app.showNotification(`Category "${name}" added.`, "success");
        }
    }

    addTag() {
        const category = prompt("Category for new tag:");
        if (!category || !Ontology[category]) {
            this.app.showNotification("Category does not exist.", "error");
            return;
        }
        const tagName = (prompt("New tag name:") || "").toLowerCase();
        if (tagName) {
            Ontology[category][tagName] = {
                dataType: "string",
                conditions: {exact: {label: "is"}, contains: {label: "contains"}, regex: {label: "matches regex"}},
                defaultCondition: "exact",
                allowedNatures: ["definite"]
            };
            this.render();
            this.app.showNotification(`Tag "${tagName}" added to "${category}".`, "success");
        }
    }

    importOntology() {
        const input = Object.assign(document.createElement("input"), {
            type: "file", accept: ".json", onchange: async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                    try {
                        Object.assign(Ontology, JSON.parse(await file.text()));
                        this.render();
                        this.app.showNotification("Ontology imported.", "success");
                    } catch (err) {
                        this.app.showNotification("Invalid JSON.", "error");
                    }
                }
            }
        });
        input.click();
    }

    exportOntology() {
        const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(Ontology, null, 2))}`;
        Object.assign(document.createElement("a"), {href: dataStr, download: "ontology.json"}).click();
        this.app.showNotification("Ontology exported.", "info");
    }
}

class SettingsView extends UIComponent {
    constructor(app) {
        super(null, `<div id="settings-view" class="view"><h2>Settings</h2></div>`);
        this.app = app;
        this.build();
        this.bindEvents();
    }

    build() {
        this.$el.append(
            $("<h3>Nostr Keys</h3>"),
            $(`<button id="generate-key-btn">Generate Key Pair</button>`),
            $(`<button id="import-key-btn">Import Key</button>`),
            $(`<button id="export-key-btn">Export Key</button>`),
            $(`<div id="key-display"></div>`),
            $("<h3>Relays</h3>"),
            $(`<textarea id="relay-list" placeholder="Relays (one per line)" aria-label="Relay List"></textarea>`),
            $(`<button id="save-relays-btn">Save Relays</button>`),
            $("<h3>Preferences</h3>"),
            $(`<label>Date/Time Format: <select id="date-format-select"><option value="Pp">Pp</option><option value="MM/dd/yyyy">MM/dd/yyyy</option></select></label>`),
            $("<h3>User Profile (Nostr)</h3>"),
            $(`<label for="profile-name">Name:</label>`),
            $(`<input type="text" id="profile-name">`),
            $(`<label for="profile-picture">Picture:</label>`),
            $(`<input type="text" id="profile-picture">`),
            $(`<button id="save-profile-btn">Save Profile</button>`),
            $(`<div id="profile-display"></div>`)
        );
    }

    bindEvents() {
        bind(this.$el, "click", this.generateKeyPair, "#generate-key-btn");
        bind(this.$el, "click", this.importKey, "#import-key-btn");
        bind(this.$el, "click", this.exportKey, "#export-key-btn");
        bind(this.$el, "click", this.saveRelays, "#save-relays-btn");
        bind(this.$el, "change", this.saveDateFormat, "#date-format-select");
        bind(this.$el, "click", this.saveProfile, "#save-profile-btn");
    }

    async generateKeyPair() {
        try {
            const keys = await Net.generateKeys();
            window.keys = keys;
            this.displayKeys();
            await DB.saveKeys(keys);
            this.app.showNotification("Keys generated.", "success");
        } catch (err) {
            this.app.showNotification("Key generation failed.", "error");
        }
    }

    async importKey() {
        const privKey = prompt("Enter private key (hex):");
        if (privKey) {
            try {
                if (!/^[0-9a-fA-F]{64}$/.test(privKey)) throw new Error("Invalid key format.");
                window.keys = {priv: privKey, pub: await window.NostrTools.getPublicKey(privKey)};
                this.displayKeys();
                await DB.saveKeys(window.keys);
                this.app.showNotification("Key imported.", "success");
            } catch (err) {
                this.app.showNotification(`Error importing key: ${err.message}`, "error");
            }
        }
    }

    async exportKey() {
        const loadedKeys = await DB.loadKeys();
        if (loadedKeys) {
            try {
                await navigator.clipboard.writeText(JSON.stringify(loadedKeys, null, 2));
                this.app.showNotification("Keys copied to clipboard.", "success");
            } catch {
                this.app.showNotification("Failed to copy keys.", "error");
            }
        } else {
            this.app.showNotification("No keys to export.", "error");
        }
    }

    displayKeys() {
        this.$el.find("#key-display").html(`<p><strong>Public Key:</strong> ${window.keys?.pub || "No key"}</p>`);
    }

    saveRelays() {
        const relays = this.$el.find("#relay-list").val().split("\n").map(l => l.trim()).filter(Boolean);
        if (relays.length) {
            window.nostrClient?.setRelays(relays);
            this.app.showNotification("Relays saved.", "info");
        }
    }

    saveDateFormat() {
        localStorage.setItem("dateFormat", this.$el.find("#date-format-select").val());
        this.app.showNotification("Date format saved.", "info");
    }

    async saveProfile() {
        const profile = {
            name: this.$el.find("#profile-name").val(),
            picture: this.$el.find("#profile-picture").val()
        };
        try {
            const event = {
                kind: 0,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: JSON.stringify(profile),
                pubkey: window.keys.pub
            };
            event.id = await window.NostrTools.getEventHash(event);
            event.sig = await window.NostrTools.signEvent(event, window.keys.priv);
            window.nostrClient?.publishRawEvent(event);
            this.displayProfile(profile);
            this.app.showNotification("Profile saved.", "success");
        } catch (err) {
            this.app.showNotification("Error saving profile.", "error");
        }
    }

    displayProfile(profile) {
        this.$el.find("#profile-display").html(`
            <p><strong>Name:</strong> ${profile.name || ""}</p>
            ${profile.picture ? `<img src="${profile.picture}" style="max-width:100px;max-height:100px;">` : ""}
        `);
    }
}

class DashboardView extends UIComponent {
    constructor(app) {
        super(null, `<div id="dashboard-view" class="view"><h2>Dashboard</h2></div>`);
        this.app = app;
        this.build();
    }

    build() {
        this.$el.append(
            $(`<div id="dashboard-stats"></div>`),
            $(`<h3>Recent Activity</h3><div id="recent-activity" aria-live="polite"></div>`),
            $(`<h3>Tag Cloud</h3><div id="tag-cloud"></div>`)
        );
    }

    async render() {
        try {
            const stats = await this.app.db.getStats();
            this.$el.find("#dashboard-stats").html(`<p>Objects: ${stats.objectCount}</p><p>Tags: ${stats.tagCount}</p>`);

            const recent = await this.app.db.getRecent(5);
            const $recentActivity = this.$el.find("#recent-activity").empty();
            recent.forEach(obj => $recentActivity.append(`<p><strong>${obj.name}</strong> - Updated: ${formatDate(obj.updatedAt)}</p>`));

            this.renderTagCloud();
        } catch (err) {
            this.app.showNotification("Error rendering dashboard", "error");
        }
    }

    renderTagCloud() {
        const $tagCloud = this.$el.find("#tag-cloud").empty();
        const tagCounts = {};
        availableTags.forEach(t => tagCounts[t.name] = 0);

        this.app.db.getAll().then(objects => {
            objects.forEach(obj => obj.tags?.forEach(tag => {
                const tagName = (tag.name || "").toLowerCase();
                if (tagCounts[tagName] !== undefined) tagCounts[tagName]++;
            }));
            Object.entries(tagCounts)
                .filter(([, count]) => count > 0)
                .forEach(([tagName, count]) => $tagCloud.append(`<span style="font-size:${10 + count * 2}px; margin-right:5px;">${tagName}</span>`));
        }).catch(() => this.app.showNotification("Error rendering tag cloud.", "error"));
    }
}

class MainContent extends UIComponent {
    constructor() {
        super(null, `<div class="main-content"><div class="content"></div></div>`);
    }

    showView(view) {
        this.$el.find(".content").empty().append(view.$el);
    }
}

class Matcher {
    constructor(app) {
        this.app = app;
        this.fuse = new Fuse([], {
            keys: ["name", "content", "tags.value"],
            threshold: 0.4,
            includeScore: true,
            ignoreLocation: true
        });
    }

    async matchEvent(event) {
        const text = (event.content || "").toLowerCase();
        const matches = [];
        const objects = await this.app.db.getAll();

        for (const obj of objects) {
            if (obj.tags?.some(tagData => this.matchTagData(tagData, text))) {
                matches.push(obj);
            }
        }

        if (!matches.length) {
            this.fuse.setCollection(objects);
            this.fuse.search(text).forEach(result => {
                if (result.score <= this.fuse.options.threshold) matches.push(result.item);
            });
        }

        if (matches.length) {
            const snippet = matches.map(m => `<em>${m.name}</em> (updated ${formatDate(m.updatedAt)})`).join("<br>");
            this.app.showNotification(`Match in ${matches.length} object(s) for event from ${event.pubkey}:<br>${snippet}`);
        }
    }

    matchTagData(tagData, text) {
        const {condition, value, name} = tagData;
        const definition = getTagDefinition(name);
        const lowerText = text.toLowerCase();

        switch (condition) {
            case "between":
                if (definition.dataType === "time") {
                    try {
                        const lowerDate = parseISO(value.lower);
                        const upperDate = parseISO(value.upper);
                        if (!isValidDate(lowerDate) || !isValidDate(upperDate)) return false;
                        return (text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g) || [])
                            .some(m => {
                                const d = parseISO(m);
                                return isValidDate(d) && d >= lowerDate && d <= upperDate;
                            });
                    } catch {
                        return false;
                    }
                } else {
                    const lower = parseFloat(value.lower);
                    const upper = parseFloat(value.upper);
                    if (Number.isNaN(lower) || Number.isNaN(upper)) return false;
                    return (text.match(/\d+(\.\d+)?/g) || []).map(Number).some(n => n >= lower && n <= upper);
                }
            case "regex":
                try {
                    return new RegExp(value, "i").test(text);
                } catch {
                    return false;
                }
            case "before":
                if (definition.dataType !== "time") return false;
                try {
                    const limitDate = parseISO(value);
                    if (!isValidDate(limitDate)) return false;
                    return (text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g) || []).some(m => isValidDate(parseISO(m)) && parseISO(m) < limitDate);
                } catch {
                    return false;
                }
            case "after":
                if (definition.dataType !== "time") return false;
                try {
                    const limitDate = parseISO(value);
                    if (!isValidDate(limitDate)) return false;
                    return (text.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g) || []).some(m => isValidDate(parseISO(m)) && parseISO(m) > limitDate);
                } catch {
                    return false;
                }
            case "contains":
                return value && lowerText.includes(value.toLowerCase());
            case "exact":
                return value && lowerText === value.toLowerCase();
            default:
                return false;
        }
    }
}

class App {
    constructor() {
        this.db = new DB.DB();
        this.matcher = new Matcher(this);
        this.selected = null;
        this.notificationQueue = [];
        this.notificationTimeout = null;
        this.$container = $('<div class="container"></div>');
        window.nostrClient = this.nostrClient = new Net.Nostr(this.matcher);
        this.initUI();
    }

    async initUI() {
        this.sidebar = new Sidebar(this);
        this.mainContent = new MainContent();

        $("body").append(
            this.$container.append(this.sidebar.$el, this.mainContent.$el),
            $('<div id="notification-area" aria-live="assertive"></div>'),
            $('<div class="loading-overlay"><div class="spinner"></div></div>')
        );

        this.editor = new Editor();
        this.tagger = new Tagger(this.editor, availableTags, {onWidgetUpdate: () => this.updateCurrentObject()});

        const keys = await DB.loadKeys();
        if (keys) {
            window.keys = keys;
            window.nostrClient.connect();
        }
        this.setView("dashboard");
    }

    setView(viewName) {
        let view;
        switch (viewName) {
            case "dashboard":
                view = new DashboardView(this);
                view.render();
                break;
            case "content":
                view = new ContentView(this);
                this.renderList();
                break;
            case "ontology":
                view = new OntologyView(this);
                view.render();
                break;
            case "settings":
                view = new SettingsView(this);
                break;
            default:
                console.warn("Unknown view:", viewName);
                return;
        }
        this.mainContent.showView(view);
    }

    async renderList(filter = "") {
        const $list = $("#object-list").empty();
        try {
            const objects = await this.db.getAll();
            const filtered = filter.trim()
                ? objects.filter(o => new RegExp(_.escapeRegExp(filter), "i").test(o.name) || new RegExp(_.escapeRegExp(filter), "i").test(o.content))
                : objects;

            if (!filtered.length) {
                $list.html("<p>No objects.</p>");
                return;
            }

            filtered.forEach(obj => {
                const item = document.createElement('div');
                item.classList.add('object-item');
                item.setAttribute('data-id', obj.id);
                item.setAttribute('tabindex', '0');

                const strong = document.createElement('strong');
                strong.textContent = obj.name;
                item.appendChild(strong);

                const div = document.createElement('div');
                div.textContent = obj.content; // Safer than innerHTML
                item.appendChild(div);

                const small = document.createElement('small');
                small.textContent = `Updated: ${formatDate(obj.updatedAt)}`;
                item.appendChild(small);

                $list.append(item);
            });
        } catch (err) {
            this.showNotification("Error rendering list.", "error");
        }
    }

    createNewObject() {
        this.showEditor({
            id: nanoid(),
            name: "",
            content: "",
            tags: [],
            createdAt: formatISO(Date.now()),
            updatedAt: formatISO(Date.now())
        });
    }

    async editOrViewObject(id) {
        try {
            const obj = _.find(await this.db.getAll(), {id});
            if (obj) this.showEditor(obj);
        } catch (err) {
            this.showNotification("Error editing object.", "error");
        }
    }

    showEditor(object) {
        this.selected = object;
        $("#editor-container").show();
        $("#object-name").val(object.name || "");
        $("#created-at").text(object.createdAt ? formatDate(object.createdAt) : "");
        this.editor.setContent(object.content || "");
    }

    hideEditor() {
        $("#editor-container").hide();
        this.selected = null;
    }

    async saveObject() {
        if (!this.selected) return;
        const name = $("#object-name").val().trim();
        if (!name) {
            this.showNotification("Name is required.", "warning");
            return;
        }

        const sanitizedContent = DOMPurify.sanitize(this.editor.getContent(), {
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
        });

        try {
            const all = await this.db.getAll();
            if (all.find(o => o.name.toLowerCase() === name.toLowerCase() && o.id !== this.selected.id)) {
                this.showNotification("Object name must be unique.", "warning");
                return;
            }

            this.selected.name = name;
            this.selected.content = sanitizedContent;
            this.selected.tags = this.extractTags(sanitizedContent);
            this.selected.updatedAt = formatISO(Date.now());

            await this.db.save(this.selected);
            this.hideEditor();
            await this.renderList();
            this.nostrClient.publish(this.selected);
            this.showNotification("Object saved.", "success");
        } catch (err) {
            this.showNotification("Save failed.", "error");
        }
    }

    extractTags(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return Array.from(doc.querySelectorAll(".inline-tag")).map(el => {
            const name = el.querySelector(".tag-name").textContent.toLowerCase();
            const condition = el.querySelector(".tag-condition").value;
            const tagDef = getTagDefinition(name);

            const getValue = () => {
                if (condition === "between") {
                    const lower = el.querySelector(".tag-value.lower")?.value || "";
                    const upper = el.querySelector(".tag-value.upper")?.value || "";
                    return {
                        lower: tagDef.dataType === "time" ? (lower ? formatISO(new Date(lower)) : "") : lower,
                        upper: tagDef.dataType === "time" ? (upper ? formatISO(new Date(upper)) : "") : upper
                    };
                } else {
                    const value = el.querySelector(".tag-value")?.value || "";
                    return tagDef.dataType === "time" ? (value ? formatISO(new Date(value)) : "") : value;
                }
            };

            return {name, condition, value: getValue()};
        });
    }

    updateCurrentObject() {
        if (!this.selected) return;
        const sanitizedContent = DOMPurify.sanitize(this.editor.getContent(), {
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
        });

        this.selected.content = sanitizedContent;
        this.selected.tags = this.extractTags(sanitizedContent);

        this.db.save(this.selected)
            .then(() => {
                this.nostrClient.publish(this.selected);
                this.editor.setContent(sanitizedContent); // Ensure editor reflects sanitized content
            })
            .catch(() => this.showNotification("Update failed.", "error"));
    }

    async deleteCurrentObject() {
        if (this.selected && confirm(`Delete "${this.selected.name}"?`)) {
            try {
                await this.db.delete(this.selected.id);
                this.hideEditor();
                await this.renderList();
                this.showNotification(`Object "${this.selected.name}" deleted.`, "success");
            } catch (err) {
                this.showNotification("Failed to delete.", "error");
            }
        }
    }

    showNotification(message, type = "info") {
        this.notificationQueue.push({message, type});
        if (!this.notificationTimeout) this.showNextNotification();
    }

    showNextNotification() {
        if (!this.notificationQueue.length) {
            this.notificationTimeout = null;
            return;
        }
        const {message, type} = this.notificationQueue.shift();
        const $notification = $(`<div class="notification ${type}" role="status">${message}</div>`).appendTo("#notification-area");
        $notification.fadeIn(300);
        this.notificationTimeout = setTimeout(() => {
            $notification.fadeOut(300, () => {
                $notification.remove();
                this.showNextNotification();
            });
        }, 4000);
    }

    showLoading() {
        $(".loading-overlay").show();
    }

    hideLoading() {
        $(".loading-overlay").hide();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    window.app = new App(); // For debugging
});