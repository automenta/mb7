import * as Net from "./net.js";
import * as DB from "./db.js";
import { format, formatISO, isValid as isValidDate, parseISO } from "https://cdn.jsdelivr.net/npm/date-fns@2.29.3/esm/index.js";
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.js";
import { nanoid } from "https://cdn.jsdelivr.net/npm/nanoid@5.0.9/nanoid.js";
import * as NostrTools from 'https://cdn.jsdelivr.net/npm/nostr-tools@latest/+esm'
import { UIComponent, View } from "./view.js";
import { FriendsView } from "./view.friends.js";
import { SettingsView } from "./view.settings.js";


const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), localStorage.getItem("dateFormat") || "Pp")
        : "";


const TagOntology = {
    "location": {
        conditions: ["is", "contains", "near"],
        validate: (value, condition) => typeof value === "string" && value.length > 0,
        serialize: (value) => value,
        deserialize: (value) => value
    },
    "time": {
        conditions: ["is", "before", "after", "between"],
        validate: (value, condition) => {
            if (condition === "between") {
                return isValidDate(parseISO(value.start)) && isValidDate(parseISO(value.end));
            }
            return isValidDate(parseISO(value));
        },
        serialize: (value) => typeof value === 'object' && value !== null ?
            { start: formatISO(parseISO(value.start)), end: formatISO(parseISO(value.end)) } : formatISO(parseISO(value)),
        deserialize: (value) => value
    },
    "string": {
        conditions: ["is", "contains", "matches regex"],
        validate: (value, condition) => typeof value === "string",
        serialize: (value) => value,
        deserialize: (value) => value
    },
    "number": {
        conditions: ["is", "greater than", "less than", "between"],
        validate: (value, condition) => {
            if (condition === "between") {
                return !isNaN(parseFloat(value.lower)) && isFinite(value.lower) &&
                    !isNaN(parseFloat(value.upper)) && isFinite(value.upper);
            }
            return !isNaN(parseFloat(value)) && isFinite(value);
        },
        serialize: (value) => {
            if(typeof value === 'object' && value !== null) {
                return { lower: String(value.lower), upper: String(value.upper) };
            }
            return String(value)
        },
        deserialize: (value) => value // Could also convert back to number if needed
    },
};

const getTagDefinition = (name) => TagOntology[name] || TagOntology.string;

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

class Editor extends UIComponent {
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

class Tagger extends UIComponent {
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
class ContentView extends View {
    constructor(app) {
        super(app, '<div id="content-view" class="view"><h2>Content</h2></div>');
    }

    build() {
        this.$el.append(
            `<div class="filter-bar"><input type="text" id="search-input" placeholder="Search items..."></div>`,
            `<div id="object-list"></div>`,
            `<button id="new-object-btn">New Object</button>`,
            `<div id="editor-container" style="display:none;">
            <div class="toolbar"><button id="insert-tag-btn">Insert Tag</button></div>
            <div id="editor" contenteditable="true"></div>
            <div class="metadata-panel">
                <label for="object-name">Name:</label>
                <input type="text" id="object-name">
                <p>Created At: <span id="created-at"></span></p>
            </div>
            <button id="save-object-btn">Save</button>
            <button id="cancel-edit-btn">Cancel</button>
            <button id="delete-object-btn">Delete Object</button>
        </div>`
        );
        this.tagger = new Tagger(this.app.editor, () => this.app.updateCurrentObject());
    }

    bindEvents() {
        this.$el.find("#search-input").on("input", _.debounce(() => this.app.renderList(this.$el.find("#search-input").val()), 300));
        this.$el.find("#new-object-btn").on("click", () => this.app.createNewObject());
        this.$el.find("#save-object-btn").on("click", () => this.app.saveObject());
        this.$el.find("#cancel-edit-btn").on("click", () => this.app.hideEditor());
        this.$el.find("#delete-object-btn").on("click", () => this.app.deleteCurrentObject());
        this.$el.find("#insert-tag-btn").on("click", (e) => {
            e.preventDefault();
            this.tagger.show(e)
        });
        this.$el.find("#object-list").on("click", ".object-item", (e) => this.app.editOrViewObject($(e.currentTarget).data("id")));
    }
}
class DashboardView extends View {
    constructor(app) { super(app, `<div id="dashboard-view" class="view"><h2>Dashboard</h2></div>`); }

    build() {
        this.$el.append(
            `<div id="dashboard-stats"></div>
            <h3>Recent Activity</h3><div id="recent-activity"></div>
            <h3>Tag Cloud</h3><div id="tag-cloud"></div>`
        );
        this.app.displayPubkeyOnDashboard(); //display pubkey on load
    }

    async render() {
        const stats = await this.app.db.getStats();
        this.$el.find("#dashboard-stats").html(`<p>Objects: ${stats.objectCount}</p><p>Tags: ${stats.tagCount}</p>`);
        const recent = await this.app.db.getRecent(5);
        this.$el.find("#recent-activity").html(recent.map(obj => `<p><strong>${obj.name}</strong> - Updated: ${formatDate(obj.updatedAt)}</p>`).join(''));
        this.renderTagCloud();
    }

    renderTagCloud() {
        this.app.db.getAll().then(objects => {
            const tagCounts = {};
            objects.forEach(obj => obj.tags?.forEach(tag => tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1));
            this.$el.find("#tag-cloud").html(Object.entries(tagCounts)
                .sort(([, countA], [, countB]) => countB - countA)
                .map(([tagName, count]) => `<span style="font-size:${10 + count * 2}px; margin-right:5px;">${tagName}</span>`).join(''));
        });
    }
}

class Sidebar extends View {
    constructor(app) { super(app, `<div class="sidebar-left"></div>`); }

    build() {
        this.$el.append(
            this.buildSection("Menu", [{ label: "Dashboard", view: "dashboard" }, { label: "Content", view: "content" }, { label: "Settings", view: "settings" }, { label: "Friends", view: "friends" }]),
            this.buildSection("Links", [{ label: "Recent Items", list: "recent" }]),
            $("<h3>Network</h3>", `<div id="network-status">Connecting...</div><hr>`),
            $("<div id='nostr-feed'></div>")
        );
    }

    buildSection(title, items) {
        return [
            `<h3>${title}</h3>`,
            `<ul>${items.map(item => `<li><a href="#" ${item.view ? `data-view="${item.view}"` : `data-list="${item.list}"`}>${item.label}</a></li>`).join('')}</ul><hr>`
        ];
    }

    bindEvents() {
        this.$el.on("click", "a[data-view], a[data-list]", (e) => {
            e.preventDefault();
            this.app.setView($(e.currentTarget).data("view") || "content");
        });
    }
}

class MainContent extends UIComponent {
    constructor() { super(`<div class="main-content"><div class="content"></div></div>`); }
    showView(view) { this.$el.find(".content").empty().append(view.$el); }
}

class Matcher {
    constructor(app) {
        this.app = app;
        this.fuse = new Fuse([], { keys: ["name", "content", "tags.value"], threshold: 0.4, includeScore: true, ignoreLocation: true });
    }

    async matchEvent(event) {
        const text = (event.content || "").toLowerCase();
        const matches = [];
        const objects = await this.app.db.getAll();

        for (const obj of objects) {
            if (obj.tags?.some(tagData => this.matchTagData(tagData, text, event)))
                matches.push(obj);
        }

        if (!matches.length) {
            this.fuse.setCollection(objects);
            matches.push(...this.fuse.search(text).filter(r => r.score <= this.fuse.options.threshold).map(r => r.item));
        }

        if(matches.length) {
            //dedupe matches
            const uniqueMatches = [...new Set(matches.map(m => m.id))].map(id => matches.find(m => m.id === id));

            this.app.showNotification(
                `Match in ${uniqueMatches.length} object(s) for event from ${NostrTools.nip19.npubEncode(event.pubkey)}:<br>${uniqueMatches.map(m => `<em>${m.name}</em> (updated ${formatDate(m.updatedAt)})`).join("<br>")}`
            );
        }
    }

    matchTagData(tagData, text, event) {
        const { name, condition, value } = tagData;
        const tagDef = this.app.getTagDefinition(name);

        if (!tagDef.validate(value, condition)) return false;

        const checkTime = (val) => {
            if (tagDef.name !== 'time') return false;
            try {
                const eventDate = new Date(event.created_at * 1000);
                const parsedValue = parseISO(val);
                if (!isValidDate(parsedValue)) return false;
                if (condition === "is") return eventDate.getTime() === parsedValue.getTime();
                if (condition === "before") return eventDate < parsedValue;
                if (condition === "after") return eventDate > parsedValue;
            } catch {  }
            return false;
        };

        if (condition === "between" && tagDef.name === "time") {
            try {
                const startDate = parseISO(value.start);
                const endDate = parseISO(value.end);
                const eventDate = new Date(event.created_at * 1000);
                return isValidDate(startDate) && isValidDate(endDate) && eventDate >= startDate && eventDate <= endDate;

            } catch { return false; }
        } else if (condition === "between" && tagDef.name === "number") {
            const lower = parseFloat(value.lower);
            const upper = parseFloat(value.upper);
            const numValue = parseFloat(text); //Try to get a numeric value
            return !isNaN(lower) && !isNaN(upper) && !isNaN(numValue) && numValue >= lower && numValue <= upper;
        }
        else if (condition === "matches regex") { try { return new RegExp(value, "i").test(text); } catch { return false; } }
        else if (["is", "contains"].includes(condition)) { return text.includes(value.toLowerCase()); }
        else if (["before", "after"].includes(condition)) { return checkTime(value); }
        return false;
    }
}

class App {

    constructor() {
        this.db = new DB.DB();
        this.matcher = new Matcher(this);
        this.selected = null;
        this.$container = $('<div class="container"></div>');
        this.notificationQueue = [];
        window.nostrClient = this.nostrClient = new Net.Nostr(this);  // Make globally accessible and get tag defs
        this.init(); // Call the initialization
    }

    async init() {
        await DB.DB.initDB(); // Initialize the database *first*
        this.initUI();      // *Then* initialize the UI
    }

    async initUI() {
        this.sidebar = new Sidebar(this);
        this.mainContent = new MainContent();
        this.editor = new Editor();
        this.settingsView = new SettingsView(this); // Create settingsView here
        this.friendsView = new FriendsView(this);


        $("body").append(
            this.$container.append(this.sidebar.$el, this.mainContent.$el),
            $('<div id="notification-area"></div>'),
            $('<div class="loading-overlay"><div class="spinner"></div></div>')
        );

        // Load keys, *then* connect to Nostr and load initial data
        try {
            const keys = await DB.loadKeys();  //Simplified
            if (keys) {
                window.keys = keys;
                this.nostrClient.connect(); // Connect after loading keys
            }
        } catch (error){
            console.error("Failed to load or generate keys:", error);
        }

        this.setView("dashboard"); // Set initial view

    }

    //Add a method to easily update network status:
    updateNetworkStatus(message) {
        $("#network-status").text(message);
    }

    getTagDefinition(tagName) {
        return TagOntology[tagName] || TagOntology.string;
    }

    async deleteCurrentObject() {
        if (this.selected && confirm(`Delete "${this.selected.name}"?`)) {
            const event = {
                kind: 5,
                created_at: Math.floor(Date.now() / 1000),
                tags: [["e", this.selected.id]],
                content: "", // Content is typically empty for deletions
                pubkey: window.keys.pub,
            };
            try {
                await this.nostrClient.publishEvent(event);
            } catch(e) {
                return; //stop if publish fails.  Error already notified.
            }

            await this.db.delete(this.selected.id);
            this.hideEditor();
            await this.renderList();
            this.showNotification(`"${this.selected.name}" deleted.`, "success");
        }
    }

    displayPubkeyOnDashboard() {
        if(window.keys && window.keys.pub) {
            //check if the element has already been added.
            if($("#dashboard-view #pubkey-display").length === 0) {
                $("#dashboard-view").append(`<p id="pubkey-display">Your Public Key: ${NostrTools.nip19.npubEncode(window.keys.pub)}</p>`)
            }
        }
    }


    setView(viewName) {
        const viewMap = {
            dashboard: () => { const v = new DashboardView(this); v.render(); return v; },
            content: () => new ContentView(this),
            settings: () => this.settingsView, // Return existing instances
            friends: () => this.friendsView,   // Return existing instances
        };
        const view = (viewMap[viewName] || viewMap.dashboard)();
        this.mainContent.showView(view);
        this.mainContent.currentView = view; // Add this line to track currentView
        viewName === "content" &&            this.renderList();
    }

    async renderList(filter = "") {
        const $list = $("#object-list").empty();
        const objects = await this.db.getAll();
        const filtered = filter
            ? objects.filter(o => Object.values(o).some(val => typeof val === 'string' && val.toLowerCase().includes(filter.toLowerCase())))
            : objects;

        $list.html(filtered.length
            ? filtered.map(obj => `<div class="object-item" data-id="${obj.id}" tabindex="0"><strong>${obj.name}</strong><div>${obj.content}</div><small>Updated: ${formatDate(obj.updatedAt)}</small></div>`).join('')
            : "<p>No objects found.</p>");
    }

    createNewObject() {
        this.showEditor({ id: nanoid(), name: "", content: "", tags: [], createdAt: formatISO(new Date()), updatedAt: formatISO(new Date()) });
    }

    async editOrViewObject(id) {
        const obj = await this.db.get(id);
        obj && this.showEditor(obj);
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
        // Clear input fields and editor content
        $("#object-name").val('');
        $("#created-at").text('');
        this.editor.setContent('');
    }

    async saveObject() {
        if (!this.selected) return;
        const name = $("#object-name").val().trim();
        if (!name) { this.showNotification("Object name is required.", "warning"); return; }

        const sanitizedContent = DOMPurify.sanitize(this.editor.getContent(), { ALLOWED_TAGS: ["br", "b", "i", "span"], ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"] });

        if ((await this.db.getAll()).some(o => o.name.toLowerCase() === name.toLowerCase() && o.id !== this.selected.id)) {
            this.showNotification("An object with this name already exists.", "warning");
            return;
        }

        this.selected = { ...this.selected, name, content: sanitizedContent, tags: this.extractTags(sanitizedContent), updatedAt: formatISO(new Date()) };
        await this.db.save(this.selected);
        this.hideEditor();
        await this.renderList();
        this.nostrClient.publish(this.selected); //use this.nostrClient
        this.showNotification("Object saved.", "success");
    }

    extractTags(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return Array.from(doc.querySelectorAll(".inline-tag")).map(el => {
            const name = el.querySelector(".tag-name").textContent.trim();
            const condition = el.querySelector(".tag-condition").value;
            const tagDef = getTagDefinition(name);
            const valueElements = el.querySelectorAll(".tag-value");

            let value;
            if (condition === "between" && tagDef.name === "time") {
                value = {
                    start: valueElements[0]?.value,
                    end: valueElements[1]?.value
                }
            } else if (condition === "between" && tagDef.name === "number") {
                value = {
                    lower: valueElements[0]?.value,
                    upper: valueElements[1]?.value
                };
            }
            else {
                value = valueElements[0]?.value;
            }
            return { name, condition, value };
        });
    }

    updateCurrentObject() {
        if (!this.selected) return;
        const sanitizedContent = DOMPurify.sanitize(this.editor.getContent(), { ALLOWED_TAGS: ["br", "b", "i", "span"], ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"] });
        this.selected.content = sanitizedContent;
        this.selected.tags = this.extractTags(sanitizedContent);
        this.db.save(this.selected)
            .then(() => { this.nostrClient.publish(this.selected); this.editor.setContent(sanitizedContent); }) //use this.nostrClient
            .catch(() => this.showNotification("Object update failed.", "error"));
    }

    showNotification(message, type = "info") {
        this.notificationQueue.push({ message, type });
        if (!this.notificationTimeout) { this.showNextNotification(); }
    }

    showNextNotification() {
        if (!this.notificationQueue.length) { this.notificationTimeout = null; return; }
        const { message, type } = this.notificationQueue.shift();
        const $notification = $(`<div class="notification ${type}">${message}</div>`).appendTo("#notification-area");
        $notification.fadeIn(300, () => {
            this.notificationTimeout = setTimeout(() => {
                $notification.fadeOut(300, () => { $notification.remove(); this.showNextNotification(); });
            }, 4000);
        });
    }

    showLoading() { $(".loading-overlay").show(); }
    hideLoading() { $(".loading-overlay").hide(); }
}

// Initialize the app.
$(() => { window.app = new App(); });