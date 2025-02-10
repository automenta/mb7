import { getPublicKey } from "https://esm.sh/nostr-tools@1.8.0";
import * as Net from "./net.js";
import * as dateFns from "https://cdn.jsdelivr.net/npm/date-fns@2.29.3/esm/index.js";
import * as nanoid from "https://cdn.jsdelivr.net/npm/nanoid@5.0.9/nanoid.js";

const { set, get, del, keys: idbKeys } = idbKeyval;
const KEY_STORAGE = "nostr_keys";

async function loadKeys() {
    try {
        let keysData = await get(KEY_STORAGE);
        if (!keysData) {
            const priv = Net.privateKey();
            const pub = getPublicKey(priv);
            keysData = { priv, pub };
            await set(KEY_STORAGE, keysData);
        }
        return keysData;
    } catch (error) {
        console.error("Error accessing IndexedDB for keys:", error);
        alert("Failed to access keys. IndexedDB might be unavailable.");
        return null;
    }
}

const Ontology = {
    General: {
        Location: {
            dataType: "location",
            conditions: { exact: { label: "is exactly" }, approx: { label: "is near" } },
            defaultCondition: "exact",
            allowedNatures: ["definite", "indefinite"],
        },
        Time: {
            dataType: "time",
            conditions: { exact: { label: "is exactly" }, before: { label: "is before" }, after: { label: "is after" }, between: { label: "is between" } },
            defaultCondition: "exact",
            allowedNatures: ["definite", "indefinite"],
        },
    },
    Emotion: {
        Mood: {
            dataType: "string",
            conditions: { exact: { label: "is" } },
            defaultCondition: "exact",
            allowedNatures: ["definite"],
        },
    },
};

const availableTags = [
    { name: "Weight", defaultCondition: "is" },
    { name: "Location", defaultCondition: "is" },
    { name: "Time", defaultCondition: "is" },
    { name: "Mood", defaultCondition: "is" },
];

class Editor {
    constructor($editor) {
        this.$editor = $editor;
        this.savedSel = null;
        this.bindEvents();
    }
    bindEvents() {
        this.$editor.on("mouseup keyup", () => this.saveSelection());
        this.$editor.on("keydown", e => {
            if (e.key === "Enter") {
                e.preventDefault();
                this.ensureFocus();
                document.execCommand("insertHTML", false, this.isCaretAtEnd() ? "<br><br>" : "<br>");
                this.saveSelection();
            }
        });
    }
    saveSelection() {
        const sel = window.getSelection();
        if (sel.rangeCount) this.savedSel = sel.getRangeAt(0).cloneRange();
    }
    restoreSelection() {
        if (this.savedSel) {
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(this.savedSel);
        }
    }
    ensureFocus() {
        if (!this.$editor.is(":focus")) {
            this.$editor.focus();
            const range = document.createRange();
            range.selectNodeContents(this.$editor.get(0));
            range.collapse(false);
            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            this.saveSelection();
        }
    }
    isCaretAtEnd() {
        const editorEl = this.$editor.get(0);
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0);
            return range.endContainer.nodeType === Node.TEXT_NODE
                ? range.endOffset === range.endContainer.nodeValue.length
                : range.endOffset === editorEl.childNodes.length;
        }
        return false;
    }
    getContent() {
        return this.$editor.html();
    }
    setContent(content) {
        this.$editor.html(content);
    }
    insertNodeAtCaret(node) {
        this.ensureFocus();
        this.restoreSelection();
        const sel = window.getSelection();
        if (sel.rangeCount) {
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

class Tagger {
    constructor(editor, availableTags, options = {}) {
        this.editor = editor;
        this.availableTags = availableTags;
        this.options = options;
        this.initPopup();
        this.bindGlobalEvents();
    }
    initPopup() {
        this.$popup = $("#tag-popup");
        if (!this.$popup.length) {
            this.$popup = $('<div id="tag-popup" class="popup-menu"><ul></ul></div>');
            $("body").append(this.$popup);
        }
        this.$popup.hide();
    }
    bindGlobalEvents() {
        $(document).on("click.tagger", e => {
            if (!$(e.target).closest("#tag-popup, #insert-tag-btn").length) this.hide();
        });
    }
    show(e) {
        e?.stopPropagation?.();
        this.editor.ensureFocus();
        this.editor.saveSelection();
        const { x, y } = this.getCaretCoordinates();
        const $ul = this.$popup.find("ul").empty();
        this.availableTags.forEach(tag => {
            $(`<li>${tag.name}</li>`)
                .on("click", ev => {
                    ev.stopPropagation();
                    this.insertTag(tag);
                    this.hide();
                    this.editor.$editor.focus();
                })
                .appendTo($ul);
        });
        this.$popup.css({ left: `${x}px`, top: `${y + 20}px` }).show();
    }
    hide() {
        this.$popup.hide();
    }
    getCaretCoordinates() {
        let x = 0,
            y = 0;
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const range = sel.getRangeAt(0).cloneRange();
            range.collapse(true);
            const rect = range.getBoundingClientRect();
            if (rect?.left && rect?.top) {
                x = rect.left;
                y = rect.top;
            }
        }
        if (!x && !y) {
            const offset = this.editor.$editor.offset();
            x = offset.left;
            y = offset.top;
        }
        return { x, y };
    }
    insertTag(tag) {
        const widget = new InlineTagWidget(tag.name, tag.defaultCondition, "", {
            onUpdate: this.options.onWidgetUpdate || (() => {})
        });
        this.editor.insertNodeAtCaret(widget.$el.get(0));
    }
}

class InlineTagWidget {
    constructor(tagName, condition, value, options = {}) {
        this.tagName = tagName;
        this.condition = condition || "is";
        this.value = value || (this.condition === "between" ? { lower: "", upper: "" } : "");
        this.options = options;
        this.$el = $('<span class="inline-tag" contenteditable="false"></span>');
        this.render();
    }
    render() {
        this.$el.empty().append($(`<span class="tag-name">${this.tagName}</span>`));
        this.$select = $('<select class="tag-condition"></select>');
        const conditionOptions = [
            { value: "is", label: "is", nature: "definite" },
            { value: "between", label: "between", nature: "indefinite" },
            { value: "gt", label: "gt", nature: "indefinite" },
            { value: "lt", label: "lt", nature: "indefinite" }
        ];
        conditionOptions.forEach(option => {
            const $option = $(`<option value="${option.value}" data-nature="${option.nature}">${option.label}</option>`);
            if (option.value === this.condition) $option.prop("selected", true);
            this.$select.append($option);
        });
        this.$el.append(this.$select);
        if (this.condition === "between") {
            this.$lower = $(`<input type="text" class="tag-value lower" placeholder="min" value="${(this.value && this.value.lower) || ''}">`);
            this.$upper = $(`<input type="text" class="tag-value upper" placeholder="max" value="${(this.value && this.value.upper) || ''}">`);
            this.$el.append(this.$lower, " and ", this.$upper);
        } else {
            this.$valueInput = $(`<input type="text" class="tag-value" placeholder="Enter value" value="${this.value || ''}">`);
            this.$el.append(this.$valueInput);
        }
        this.$el.append($(`<button class="tag-remove" title="Remove tag">x</button>`));
        this.attachEvents();
    }
    attachEvents() {
        this.$select.on("change", () => this.setCondition(this.$select.val()));
        this.$el.find("input").on("blur", () => this.updateFromInputs());
        this.$el.find(".tag-remove").on("click", e => {
            e.preventDefault();
            this.remove();
        });
    }
    updateFromInputs() {
        this.value =
            this.condition === "between"
                ? { lower: this.$lower.val(), upper: this.$upper.val() }
                : this.$valueInput.val();
        this.debouncedUpdate();
    }
    setCondition(newCondition) {
        this.condition = newCondition;
        this.value = newCondition === "between" ? { lower: "", upper: "" } : "";
        this.render();
        this.triggerUpdate();
    }
    remove() {
        setTimeout(() => this.$el.remove(), 0);
        this.triggerUpdate();
    }
    triggerUpdate() {
        this.options.onUpdate?.();
    }
    debouncedUpdate = _.debounce(() => this.triggerUpdate(), 500);
}

class Sidebar {
    constructor() {
        this.$el = $('<div class="sidebar-left"></div>');
        this.buildMenu();
        this.buildSidebarLinks();
        this.buildNostrStatus();
        this.buildNostrFeed();
    }
    buildMenu() {
        const menuItems = [
            { label: "Me", view: "me-view" },
            { label: "Friends", view: "friends-view" },
            { label: "Network", view: "network-view" },
            { label: "Database", view: "database-view" },
            { label: "Settings", view: "settings-view" }
        ];
        const $menuList = $("<ul></ul>").append(
            menuItems.map(item => $(`<li><a href="#" data-view="${item.view}">${item.label}</a></li>`))
        );
        this.$el.append($("<h3>Menu</h3>"), $menuList, $("<hr>"));
    }
    buildSidebarLinks() {
        const links = [
            { label: "Recent Objects", list: "recent" },
            { label: "Matches", list: "matches" }
        ];
        const $linkList = $("<ul></ul>").append(
            links.map(link => $(`<li><a href="#" data-list="${link.list}">${link.label}</a></li>`))
        );
        this.$el.append($("<h3>Sidebar</h3>"), $linkList, $("<hr>"));
    }
    buildNostrStatus() {
        this.$el.append($("<h3>Nostr Status</h3>"), $('<div id="nostr-connection-status">Connecting...</div>'), $("<hr>"));
    }
    buildNostrFeed() {
        this.$el.append($("<h3>Nostr Feed</h3>"), $('<div id="nostr-feed" style="max-height: 150px; overflow-y: auto;"></div>'));
    }
}

class SimpleView {
    constructor(title, content) {
        this.$el = $(`<div class="view" style="display: none;"><h2>${title}</h2><p>${content}</p></div>`);
    }
}

class DatabaseView {
    constructor() {
        this.$el = $('<div id="database-view" class="view active"></div>');
        this.$filterBar = $(`
      <div class="filter-bar">
        <input type="text" id="search-input" placeholder="Search TODOs..." />
        <button id="search-btn">Search</button>
      </div>
    `);
        this.$objectList = $('<div id="object-list"></div>');
        this.$newObjectBtn = $('<button id="new-object-btn">New TODO</button>');
        this.$editorContainer = $(`
      <div id="editor-container" style="display: none;">
        <div class="toolbar">
          <button id="bold-btn"><b>B</b></button>
          <button id="italic-btn"><i>I</i></button>
          <button id="insert-tag-btn">Insert Tag</button>
        </div>
        <div id="editor" contenteditable="true"></div>
        <div class="metadata-panel">
          <label for="object-name">Name:</label>
          <input type="text" id="object-name" />
        </div>
        <button id="save-object-btn">Save</button>
        <button id="cancel-edit-btn">Cancel</button>
      </div>
    `);
        this.$el.append(this.$filterBar, this.$objectList, this.$newObjectBtn, this.$editorContainer);
    }
}

class MainContent {
    constructor() {
        this.$el = $('<div class="main-content"></div>').append($('<div class="content"></div>'));
        this.views = {
            "database-view": new DatabaseView(),
            "me-view": new SimpleView("User Profile", "Your personal profile and settings."),
            "friends-view": new SimpleView("Friends", "Friend activity and connection updates."),
            "network-view": new SimpleView("Network Activity", "Relay messages and network events."),
            "settings-view": new SimpleView("Settings", "Application configuration.")
        };
        _.forEach(this.views, view => this.$el.find(".content").append(view.$el));
    }
    showView(viewName) {
        this.$el.find(".view").removeClass("active").hide();
        this.views[viewName]?.$el.addClass("active").show();
    }
}

class Matcher {
    constructor(app) {
        this.app = app;
    }
    async matchEvent(ev) {
        const eventText = ev.content.toLowerCase();
        const matches = [];
        const objs = await this.app.db.getAll();
        for (const obj of objs) {
            const $temp = $("<div></div>").html(obj.content);
            let matchedTagCount = 0;
            $temp.find(".inline-tag").each((_, element) => {
                const $tag = $(element);
                const tagName = $tag.find(".tag-name").text();
                const tagDef = Ontology.General[tagName] || Ontology.Emotion[tagName];
                if (tagDef && this.matchTag($tag, eventText)) matchedTagCount++;
            });
            if (matchedTagCount) matches.push(obj);
        }
        if (matches.length) this.app.notifyMatch(matches, ev);
    }
    matchTag($tag, eventText) {
        const condition = $tag.find("select.tag-condition").val();
        if (condition === "between") {
            const lower = parseFloat($tag.find("input.lower").val());
            const upper = parseFloat($tag.find("input.upper").val());
            const numbersInEvent = eventText.match(/\d+/g)?.map(Number) || [];
            return numbersInEvent.some(num => !isNaN(lower) && !isNaN(upper) && num >= lower && num <= upper);
        }
        const tagVal = $tag.find("input.tag-value").val()?.toLowerCase();
        return tagVal ? (condition === "is" ? eventText === tagVal : eventText.includes(tagVal)) : false;
    }
}

class DB {
    async getAll() {
        try {
            const allKeys = await idbKeys();
            const allObjs = await Promise.all(allKeys.map(key => get(key)));
            return _.orderBy(allObjs.filter(Boolean), ["updatedAt"], ["desc"]);
        } catch (error) {
            console.error("Error getting all objects:", error);
            alert("Failed to retrieve data. IndexedDB might be unavailable.");
            return [];
        }
    }
    async save(o) {
        if (!o.id) {
            console.error("Attempted to save an object without an id:", o);
            throw new Error("Missing id property on object");
        }
        try {
            await set(o.id, o);
            return o;
        } catch (error) {
            console.error("Error saving object:", error);
            alert("Failed to save data. IndexedDB might be unavailable.");
            throw error;
        }
    }
    async delete(id) {
        try {
            await del(id);
        } catch (error) {
            console.error("Error deleting object:", error);
            alert("Failed to delete data. IndexedDB might be unavailable.");
        }
    }
}

class App {
    constructor() {
        this.db = new DB();
        this.selected = null;
        this.matcher = new Matcher(this);
        this.renderListDebounced = _.debounce(filter => this.renderList(filter), 300);
        this.initUI();
    }
    async initUI() {
        this.$container = $('<div class="container"></div>');
        this.sidebar = new Sidebar();
        this.mainContent = new MainContent();
        this.$container.append(this.sidebar.$el, this.mainContent.$el);
        $("body").append(
            this.$container,
            $('<div id="notification-area"></div>'),
            $('<div class="loading-overlay"><div class="spinner"></div></div>')
        );
        this.editor = new Editor($("#editor"));
        this.tagger = new Tagger(this.editor, availableTags, {
            onUpdate: this.updateCurrentObject.bind(this)
        });
        this.$objectNameInput = $("#object-name");
        await this.renderList();
        this.bindUIEvents();
    }
    bindUIEvents() {
        this.sidebar.$el.on("click", "a[data-view]", e => {
            e.preventDefault();
            this.setView($(e.currentTarget).data("view"));
        });
        this.sidebar.$el.on("click", "a[data-list]", e => {
            e.preventDefault();
            if ($(e.currentTarget).data("list") === "recent") {
                this.setView("database-view");
                this.renderList();
            }
        });
        $("#search-btn").on("click", () => this.renderListDebounced($("#search-input").val()));
        $("#new-object-btn").on("click", () => this.createNewObject());
        $("#save-object-btn").on("click", () => this.saveObject());
        $("#cancel-edit-btn").on("click", () => this.hideEditor());
        $("#bold-btn").on("click", () => document.execCommand("bold"));
        $("#italic-btn").on("click", () => document.execCommand("italic"));
        $("#insert-tag-btn").on("click", e => {
            e.preventDefault();
            this.tagger.show(e);
        });
        $("#object-list").on("click", ".object-item", async e => {
            await this.editOrViewObject($(e.currentTarget).data("id"));
        });
    }
    async editOrViewObject(id) {
        try {
            const objToEdit = _.find(await this.db.getAll(), { id });
            if (objToEdit) this.editObject(objToEdit);
        } catch (error) {
            console.error("Error editing object:", error);
        }
    }
    setView(viewName) {
        this.mainContent.showView(viewName);
        if (viewName !== "database-view") this.hideEditor();
    }
    async renderList(filter = "") {
        const $list = $("#object-list");
        try {
            const objs = await this.db.getAll();
            let filteredObjs = objs;
            if (filter.trim()) {
                const regex = new RegExp(_.escapeRegExp(filter), "i");
                filteredObjs = _.filter(objs, o => regex.test(o.name) || regex.test(o.content));
            }
            $list.empty().append(
                filteredObjs.length
                    ? filteredObjs.map(o => this.renderObjectItem(o))
                    : '<p>No TODO items found. Click "New TODO" to create one.</p>'
            );
        } catch (error) {
            console.error("Error rendering list:", error);
        }
    }
    renderObjectItem(o) {
        const safeContent = DOMPurify.sanitize(o.content);
        const updatedStr = o.updatedAt ? dateFns.format(o.updatedAt, "Pp") : "?";
        return $(`
      <div class="object-item" data-id="${o.id}">
        <strong>${o.name}</strong>
        <div>${safeContent}</div>
        <small>Updated: ${updatedStr}</small>
      </div>
    `);
    }
    createNewObject() {
        const now = Date.now();
        const newObj = {
            id: nanoid.nanoid(),
            name: "",
            content: "",
            tags: [],
            createdAt: now,
            updatedAt: now
        };
        this.showEditor(newObj);
    }
    editObject(obj) {
        this.selected = obj;
        this.showEditor(obj);
    }
    showEditor(obj) {
        this.$objectNameInput.val(obj.name);
        this.editor.setContent(DOMPurify.sanitize(obj.content));
        $("#editor-container").show();
    }
    hideEditor() {
        $("#editor-container").hide();
        this.selected = null;
    }
    async saveObject() {
        const name = $("#object-name").val().trim();
        if (!name) {
            alert("Name cannot be empty");
            return;
        }
        const content = this.editor.getContent();
        const now = Date.now();
        const sanitizedContent = DOMPurify.sanitize(content);
        const obj = this.selected
            ? { ...this.selected, name, content: sanitizedContent, updatedAt: now }
            : { id: nanoid.nanoid(), name, content: sanitizedContent, tags: [], createdAt: now, updatedAt: now };
        try {
            await this.db.save(obj);
            this.hideEditor();
            await this.renderList();
            window.nostrClient.publish(obj);
        } catch (error) {
            console.error("Error in App.saveObject:", error);
        }
    }
    updateCurrentObject() {
        if (this.selected) {
            this.selected.content = this.editor.getContent();
            this.db
                .save(this.selected)
                .then(() => window.nostrClient.publish(this.selected))
                .catch(error => console.error("Error updating current object:", error));
        }
    }
    notifyMatch(matchedObjects, ev) {
        const msg = `Match found in ${matchedObjects.length} object(s) for event from ${ev.pubkey}:<br>` +
            matchedObjects
                .map(obj => `<em>${obj.name}</em> (updated ${dateFns.format(obj.updatedAt, "Pp")})`)
                .join("<br>");
        $("#notification-area").html(msg).fadeIn(300).delay(3000).fadeOut(300);
    }
    showLoading() {
        $(".loading-overlay").show();
    }
    hideLoading() {
        $(".loading-overlay").hide();
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    const app = new App();
    const loadedKeys = await loadKeys();
    if (loadedKeys) {
        window.app = app;
        window.keys = loadedKeys;
        window.nostrClient = new Net.Nostr(app.matcher);
    }
});
