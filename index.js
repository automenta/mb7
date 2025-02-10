// Imports assumed to exist
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

const formatDate = (timestamp) => {
    if (!timestamp) return "";
    const date = typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp);
    return isValidDate(date) ? format(date, localStorage.getItem("dateFormat") || "Pp") : "";
};

const Ontology = {
    General: {
        Location: {
            dataType: "location",
            conditions: ["is exactly", "contains", "matches regex"],
            defaultCondition: "is exactly",
            allowedNatures: ["definite", "indefinite"]
        },
        Time: {
            dataType: "time",
            conditions: ["is exactly", "is before", "is after", "is between", "matches regex"],
            defaultCondition: "is exactly",
            allowedNatures: ["definite", "indefinite"]
        },
        Description: {
            dataType: "string",
            conditions: ["is", "contains", "matches regex"],
            defaultCondition: "is",
            allowedNatures: ["definite"]
        },
    },
    Emotion: {
        Mood: {
            dataType: "string",
            conditions: ["is", "contains", "matches regex"],
            defaultCondition: "is",
            allowedNatures: ["definite"]
        },
    },
};

// Flatten and normalize the ontology for easier use.
const flattenOntology = (ontology) => {
    const flattened = [];
    for (const category in ontology) {
        for (const tagName in ontology[category]) {
            const tagDef = ontology[category][tagName];
            const conditions = {};
            tagDef.conditions.forEach(cond => {
                conditions[cond] = {label: cond}; // Standardize condition structure
            });

            flattened.push({
                name: tagName.toLowerCase(),
                category: category,
                dataType: tagDef.dataType,
                conditions: conditions,
                defaultCondition: tagDef.defaultCondition,
                allowedNatures: tagDef.allowedNatures
            });
        }
    }
    return flattened;
};

const availableTags = flattenOntology(Ontology);

const getTagDefinition = (tagName) => {
    const tag = availableTags.find(t => t.name === tagName.toLowerCase());
    return tag || { // Fallback for unknown tags.
        name: tagName.toLowerCase(),
        dataType: "string",
        conditions: {"is": {label: "is"}, "contains": {label: "contains"}, "matches regex": {label: "matches regex"}},
        defaultCondition: "is",
        allowedNatures: ["definite"],
    };
};

// Base UI Component
class UIComponent {
    constructor(selector = null, template = null) {
        this.$el = selector ? $(selector) : $(template || "<div></div>");
    }

    remove() {
        this.$el.remove();
    }
}

// Editor Component
class Editor extends UIComponent {
    #savedSelection = null;

    constructor() {
        super("#editor");
        this.bindEvents();
    }

    bindEvents() {
        this.$el.on("mouseup keyup", () => this.saveSelection())
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
        if (!this.#savedSelection) return;
        const sel = window.getSelection();
        const range = this.#savedSelection;
        range.deleteContents();

        // Determine if we're at the end to add an extra <br> for spacing
        const isAtEnd = this.isCaretAtEnd();
        const br = document.createElement("br");
        range.insertNode(br);
        if (isAtEnd) {
            range.insertNode(document.createElement("br")); // Insert another <br>
        }
        range.setStartAfter(br);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        this.saveSelection(); // save immediately
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
        if (sel?.rangeCount) {
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
            // If no selection, place cursor at the end
            const sel = window.getSelection();
            if (!sel?.rangeCount) {
                const range = document.createRange();
                range.selectNodeContents(this.$el[0]);
                range.collapse(false);
                sel.removeAllRanges();
                sel.addRange(range);
            }
            this.saveSelection(); // Save the current selection or the newly created one
        }
    }

    isCaretAtEnd() {
        const sel = window.getSelection();
        if (!sel?.rangeCount) return false;

        const range = sel.getRangeAt(0);
        const endNode = range.endContainer;

        // Check if we are at the very end of the editor content
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
            range.collapse(false); // Move caret after the inserted node.
            sel.removeAllRanges();
            sel.addRange(range);
            this.saveSelection();
        }
    }
}

// InlineTag Component
class InlineTag extends UIComponent {
    constructor(tagDef, options = {}) {
        super(null, `<span class="inline-tag" contenteditable="false" tabindex="0" id="${nanoid()}"></span>`);
        this.tagDef = tagDef;
        this.condition = tagDef.defaultCondition || "is exactly";
        this.value = this.condition === "is between" ? {lower: "", upper: ""} : "";
        this.options = options;
        this.debouncedUpdate = _.debounce(() => this.options.onUpdate?.(), 500);
        this.render();
    }

    render() {
        this.$el.empty().append(
            $(`<span class="tag-name" title="${this.tagDef.category}">${this.tagDef.name}</span>`),
            this.createConditionSelect(),
            this.createValueInputs(),
            $('<button class="tag-remove" aria-label="Remove tag">×</button>')
        );
        this.bindEvents();
    }

    createConditionSelect() {
        const $select = $('<select class="tag-condition" aria-label="Condition"></select>');
        for (const [cond, {label}] of Object.entries(this.tagDef.conditions)) {
            $select.append($(`<option value="${cond}" ${cond === this.condition ? 'selected' : ''}>${label}</option>`));
        }
        return $select;
    }

    createValueInputs() {
        const inputType = this.tagDef.dataType === "time" ? "datetime-local" : "text";
        const makeInput = (className, placeholder, val = "") => $(`<input type="${inputType}" class="tag-value ${className}" placeholder="${placeholder}" value="${DOMPurify.sanitize(val)}">`);

        if (this.condition === "is between") {
            const lowerVal = this.value?.lower ? (this.tagDef.dataType === "time" ? format(parseISO(this.value.lower), "yyyy-MM-dd'T'HH:mm") : this.value.lower) : "";
            const upperVal = this.value?.upper ? (this.tagDef.dataType === "time" ? format(parseISO(this.value.upper), "yyyy-MM-dd'T'HH:mm") : this.value.upper) : "";
            return [makeInput("lower", "min", lowerVal), " and ", makeInput("upper", "max", upperVal)];
        }

        const val = this.value ? (this.tagDef.dataType === "time" && this.value ? format(parseISO(this.value), "yyyy-MM-dd'T'HH:mm") : this.value) : "";
        return makeInput("", "Enter value", val);
    }

    bindEvents() {
        this.$el.on("change", ".tag-condition", (e) => this.setCondition(e.target.value))
            .on("input", ".tag-value", () => this.updateFromInputs())
            .on("click", ".tag-remove", () => {
                this.remove(); // Uses UIComponent's remove
                this.options.onUpdate?.();
            });
    }

    setCondition(newCondition) {
        if (this.condition !== newCondition) {
            this.condition = newCondition;
            this.value = this.condition === "is between" ? {lower: "", upper: ""} : "";
            this.render();
            this.options.onUpdate?.();
        }
    }

    updateFromInputs() {
        const getValue = (selector) => {
            const val = this.$el.find(selector).val();
            return this.tagDef.dataType === "time" ? (val && isValidDate(parseISO(val)) ? formatISO(parseISO(val)) : "") : val;
        };

        if (this.condition === "is between") {
            const newValue = {lower: getValue(".lower"), upper: getValue(".upper")};
            if (!_.isEqual(this.value, newValue)) {
                this.value = newValue;
                this.debouncedUpdate();
            }
        } else {
            const updatedValue = getValue(".tag-value");
            if (this.value !== updatedValue) {
                this.value = updatedValue;
                this.debouncedUpdate();
            }
        }
    }

    getTagData() {
        return {name: this.tagDef.name, condition: this.condition, value: this.value};
    }
}

// Tagger Component
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
                </div>`).hide().appendTo("body");
        }
        this.$search = this.$popup.find("#tag-search");
        this.$list = this.$popup.find("ul");

        this.$search.on("input", () => this.renderTagList(this.$search.val()));
        this.$popup.on("keydown", (e) => this.handlePopupKeydown(e));
    }

    handlePopupKeydown(e) {
        if (e.key === "Escape") {
            this.hide();
            this.editor.$el.focus();
            return;
        }

        const $items = this.$list.find("li[role='option']");
        let idx = $items.index($items.filter(":focus"));

        if (e.key === "ArrowDown") {
            e.preventDefault();
            idx = (idx + 1) % $items.length;
            $items.eq(idx).focus();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            idx = (idx - 1 + $items.length) % $items.length;
            $items.eq(idx).focus();
        } else if (e.key === "Enter") {
            e.preventDefault();
            $items.filter(":focus").click();
        }
    }

    bindGlobalEvents() {
        $(document).on("click.tagger", (e) => {
            if (!$(e.target).closest("#tag-popup, #insert-tag-btn").length) {
                this.hide();
            }
        });
    }

    renderTagList(query = "") {
        this.$list.empty();
        const results = query ? this.fuse.search(query) : this.availableTags.map(tag => ({item: tag}));

        if (!results.length) {
            this.$list.append(`<li role="option" aria-disabled="true">No matching tags found.</li>`);
            return;
        }

        results.forEach(({item}) => {
            const highlightedName = item.name.replace(new RegExp(`(${_.escapeRegExp(query)})`, "gi"), "<strong>$1</strong>");
            this.$list.append($(`<li role="option" tabindex="0" title="${item.category}">${highlightedName}</li>`)
                .on("click", () => {
                    this.insertTag(item);
                    this.hide();
                }));
        });
    }

    show(e) {
        e?.stopPropagation();
        this.editor.ensureFocus();
        this.editor.saveSelection();
        this.renderTagList();
        const coords = this.getCaretCoordinates();
        this.$popup.css({left: coords.x, top: coords.y + 20}).show();
        this.$search.val("").focus();
    }

    hide() {
        this.$popup.hide();
    }

    getCaretCoordinates() {
        const sel = window.getSelection();
        if (sel?.rangeCount) {
            const range = sel.getRangeAt(0).cloneRange();
            range.collapse(true); // Collapse to the start
            const rect = range.getBoundingClientRect();
            return {x: rect.left, y: rect.top};
        }
        // Fallback: top-left of editor
        const offset = this.editor.$el.offset();
        return {x: offset.left, y: offset.top};
    }

    insertTag(tag) {
        const tagComponent = new InlineTag(getTagDefinition(tag.name), {onUpdate: this.options.onWidgetUpdate});
        this.editor.insertNodeAtCaret(tagComponent.$el[0]);
    }
}

// Sidebar Component
class Sidebar extends UIComponent {
    constructor(app) {
        super(null, `<div class="sidebar-left" role="navigation"></div>`);
        this.app = app;
        this.build();
        this.bindEvents();
    }

    build() {
        this.$el.append(
            this.buildSection("Menu", [{label: "Dashboard", view: "dashboard"}, {
                label: "Content",
                view: "content"
            }, {label: "Settings", view: "settings"}]),
            this.buildSection("Links", [{label: "Recent Items", list: "recent"}]),
            this.buildStatus()
        );
    }

    buildSection(title, items) {
        const $ul = $("<ul></ul>");
        items.forEach(item => {
            const dataAttr = item.view ? `data-view="${item.view}"` : `data-list="${item.list}"`;
            $ul.append(`<li><a href="#" ${dataAttr} aria-label="${item.label}">${item.label}</a></li>`);
        });
        return [$(`<h3>${title}</h3>`), $ul, $("<hr>")];
    }

    buildStatus() {
        return [$("<h3>Network</h3>"), $(`<div id="network-status">Connecting...</div>`), $("<hr>")];
    }

    bindEvents() {
        this.$el.on("click", "a[data-view], a[data-list]", (e) => {
            e.preventDefault();
            const $target = $(e.currentTarget);
            const view = $target.data("view");
            const list = $target.data("list");

            if (view) {
                this.app.setView(view);
            } else if (list === "recent") {
                this.app.setView("content");
            }
        });
    }
}

// ContentView Component
class ContentView extends UIComponent {
    constructor(app) {
        super(null, `<div id="content-view" class="view"><h2>Content</h2></div>`);
        this.app = app;
        this.build();
        this.bindEvents();
    }

    build() {
        this.$el.append(
            $(`<div class="filter-bar"><input type="text" id="search-input" placeholder="Search items..." aria-label="Search items"></div>`),
            $(`<div id="object-list" aria-live="polite"></div>`),
            $(`<button id="new-object-btn" aria-label="New Object">New Object</button>`),
            $(`<div id="editor-container" style="display:none;">
                    <div class="toolbar"><button id="insert-tag-btn" aria-label="Insert Tag">Insert Tag</button></div>
                    <div id="editor" contenteditable="true" aria-label="Editor text"></div>
                    <div class="metadata-panel">
                        <label for="object-name">Name:</label>
                        <input type="text" id="object-name">
                        <p>Created At: <span id="created-at"></span></p>
                    </div>
                    <button id="save-object-btn" aria-label="Save">Save</button>
                    <button id="cancel-edit-btn" aria-label="Cancel">Cancel</button>
                    <button id="delete-object-btn" aria-label="Delete Object">Delete Object</button>
                </div>`)
        );
    }

    bindEvents() {
        const debouncedRender = _.debounce(() => this.app.renderList(this.$el.find("#search-input").val()), 300);
        this.$el.find("#search-input").on("input", debouncedRender);
        this.$el.find("#new-object-btn").on("click", () => this.app.createNewObject());
        this.$el.find("#save-object-btn").on("click", () => this.app.saveObject());
        this.$el.find("#cancel-edit-btn").on("click", () => this.app.hideEditor());
        this.$el.find("#delete-object-btn").on("click", () => this.app.deleteCurrentObject());
        this.$el.find("#insert-tag-btn").on("click", (e) => {
            e.preventDefault();
            this.app.tagger.show(e)
        });
        this.$el.find("#object-list").on("click", ".object-item", (e) => this.app.editOrViewObject($(e.currentTarget).data("id")));
    }
}

// SettingsView Component
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
        this.$el.find("#generate-key-btn").on("click", () => this.generateKeyPair());
        this.$el.find("#import-key-btn").on("click", () => this.importKey());
        this.$el.find("#export-key-btn").on("click", () => this.exportKey());
        this.$el.find("#save-relays-btn").on("click", () => this.saveRelays());
        this.$el.find("#date-format-select").on("change", () => this.saveDateFormat());
        this.$el.find("#save-profile-btn").on("click", () => this.saveProfile());
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
        if (!loadedKeys) {
            this.app.showNotification("No keys to export.", "error");
            return;
        }
        try {
            await navigator.clipboard.writeText(JSON.stringify(loadedKeys, null, 2));
            this.app.showNotification("Keys copied to clipboard.", "success");
        } catch {
            this.app.showNotification("Failed to copy keys.", "error");
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

// DashboardView Component
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

        // Initialize counts
        availableTags.forEach(t => tagCounts[t.name] = 0);

        this.app.db.getAll().then(objects => {
            objects.forEach(obj => {
                obj.tags?.forEach(tag => {
                    const tagName = tag.name.toLowerCase();
                    if (tagName in tagCounts) {
                        tagCounts[tagName]++;
                    }
                });
            });

            // Convert to array, filter, sort, and create elements
            Object.entries(tagCounts)
                .filter(([, count]) => count > 0)
                .sort(([, countA], [, countB]) => countB - countA) // Sort by count descending
                .forEach(([tagName, count]) => {
                    $tagCloud.append(`<span style="font-size:${10 + count * 2}px; margin-right:5px;">${tagName}</span>`);
                });
        }).catch(() => this.app.showNotification("Error rendering tag cloud.", "error"));
    }
}

// MainContent Component (Container for Views)
class MainContent extends UIComponent {
    constructor() {
        super(null, `<div class="main-content"><div class="content"></div></div>`);
    }

    showView(view) {
        this.$el.find(".content").empty().append(view.$el);
    }
}

// Matcher Class (for Nostr event matching)
class Matcher {
    constructor(app) {
        this.app = app;
        this.fuse = new Fuse([], { // Initialize Fuse.js
            keys: ["name", "content", "tags.value"],
            threshold: 0.4,
            includeScore: true,
            ignoreLocation: true
        });
    }

    async matchEvent(event) {
        const text = (event.content || "").toLowerCase();
        const matches = [];

        // First, try direct tag matching.
        const objects = await this.app.db.getAll();
        for (const obj of objects) {
            if (obj.tags?.some(tagData => this.matchTagData(tagData, text))) {
                matches.push(obj);
            }
        }

        // If no direct matches, use fuzzy search.
        if (!matches.length) {
            this.fuse.setCollection(objects);
            const results = this.fuse.search(text);
            results.forEach(result => {
                if (result.score <= this.fuse.options.threshold) {
                    matches.push(result.item);
                }
            });
        }

        if (matches.length) {
            const snippet = matches.map(m => `<em>${m.name}</em> (updated ${formatDate(m.updatedAt)})`).join("<br>");
            this.app.showNotification(`Match in ${matches.length} object(s) for event from ${event.pubkey}:<br>${snippet}`);
        }
    }

    matchTagData(tagData, text) {
        const {condition, value, name} = tagData;
        const definition = getTagDefinition(name); // Get the tag definition.
        const lowerText = text.toLowerCase();

        const checkDate = (dateStr) => {
            if (definition.dataType !== "time") return false; // Only applicable for time.
            try {
                const limitDate = parseISO(dateStr);
                if (!isValidDate(limitDate)) return false;

                // Find *any* valid date in the text.
                return (lowerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g) || []).some(date => {
                    const d = parseISO(date);
                    return isValidDate(d); // Check if *this* matched date is valid.
                });
            } catch {
                return false;
            }
        };

        switch (condition) {
            case "is between":
                if (definition.dataType === "time") {
                    // For time, ensure dates are valid before comparison.
                    try {
                        const lowerDate = parseISO(value.lower);
                        const upperDate = parseISO(value.upper);
                        if (!isValidDate(lowerDate) || !isValidDate(upperDate)) return false;

                        return (lowerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g) || []).some(date => {
                            const d = parseISO(date);
                            return isValidDate(d) && d >= lowerDate && d <= upperDate;
                        });
                    } catch {
                        return false;
                    }
                } else {
                    // For numeric values, parse and check if any numbers in text fall within range.
                    const lower = parseFloat(value.lower);
                    const upper = parseFloat(value.upper);
                    if (isNaN(lower) || isNaN(upper)) return false;
                    return (lowerText.match(/\d+(\.\d+)?/g) || []).map(Number).some(n => n >= lower && n <= upper);
                }
            case "matches regex":
                try {
                    return new RegExp(value, "i").test(lowerText);
                } catch {
                    return false; // Invalid regex.
                }
            case "is before":
                if (!checkDate(value)) return false;
                return (lowerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g) || []).some(date => isValidDate(parseISO(date)) && parseISO(date) < parseISO(value));

            case "is after":
                if (!checkDate(value)) return false;
                return (lowerText.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z/g) || []).some(date => isValidDate(parseISO(date)) && parseISO(date) > parseISO(value));
            case "contains":
                return value && lowerText.includes(value.toLowerCase());
            case "is exactly":
                return value && lowerText === value.toLowerCase();
            default:
                return false;
        }
    }
}

// Main App Class
class App {
    constructor() {
        this.db = new DB.DB();
        this.matcher = new Matcher(this);
        this.selected = null; // Currently selected object
        this.notificationQueue = [];
        this.notificationTimeout = null;
        this.$container = $('<div class="container"></div>');
        window.nostrClient = this.nostrClient = new Net.Nostr(this.matcher); // Expose for debugging
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

        // Load keys and connect to Nostr if available
        const keys = await DB.loadKeys();
        if (keys) {
            window.keys = keys;
            window.nostrClient.connect();
        }
        this.setView("dashboard"); // Initial view
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
            case "settings":
                view = new SettingsView(this);
                break;
            default:
                console.warn(`Unknown view: ${viewName}`);
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

            if (filtered.length === 0) {
                $list.html("<p>No objects found.</p>");
                return;
            }

            filtered.forEach(obj => {
                const $item = $(`<div class="object-item" data-id="${obj.id}" tabindex="0">
                    <strong>${obj.name}</strong>
                    <div>${obj.content}</div>
                    <small>Updated: ${formatDate(obj.updatedAt)}</small>
                </div>`);
                $list.append($item);
            });
        } catch (error) {
            this.showNotification("Error rendering list.", "error");
        }
    }

    createNewObject() {
        this.showEditor({
            id: nanoid(),
            name: "",
            content: "",
            tags: [],
            createdAt: formatISO(new Date()),
            updatedAt: formatISO(new Date()),
        });
    }

    async editOrViewObject(id) {
        try {
            const obj = await this.db.get(id);
            if (obj) {
                this.showEditor(obj);
            }
        } catch (error) {
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
            this.showNotification("Object name is required.", "warning");
            return;
        }

        const sanitizedContent = DOMPurify.sanitize(this.editor.getContent(), {
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
        });


        try {
            // Check for duplicate names (excluding the current object being edited)
            const allObjects = await this.db.getAll();
            if (allObjects.some(o => o.name.toLowerCase() === name.toLowerCase() && o.id !== this.selected.id)) {
                this.showNotification("An object with this name already exists.", "warning");
                return;
            }

            this.selected.name = name;
            this.selected.content = sanitizedContent;
            this.selected.tags = this.extractTags(sanitizedContent);
            this.selected.updatedAt = formatISO(new Date());

            await this.db.save(this.selected);
            this.hideEditor();
            await this.renderList(); // Refresh the object list
            this.nostrClient.publish(this.selected); // Publish to Nostr
            this.showNotification("Object saved successfully.", "success");
        } catch (error) {
            this.showNotification("Failed to save object.", "error");
        }
    }

    extractTags(html) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const tagElements = doc.querySelectorAll(".inline-tag");

        return Array.from(tagElements).map(el => {
            const name = el.querySelector(".tag-name").textContent.trim().toLowerCase();
            const condition = el.querySelector(".tag-condition").value;
            const tagDef = getTagDefinition(name);

            const getValue = () => {
                if (condition === "is between") {
                    const lower = el.querySelector(".tag-value.lower")?.value || "";
                    const upper = el.querySelector(".tag-value.upper")?.value || "";
                    return {
                        lower: tagDef.dataType === "time" ? (lower ? formatISO(parseISO(lower)) : "") : lower,
                        upper: tagDef.dataType === "time" ? (upper ? formatISO(parseISO(upper)) : "") : upper,
                    };
                } else {
                    const value = el.querySelector(".tag-value")?.value || "";
                    return tagDef.dataType === "time" ? (value ? formatISO(parseISO(value)) : "") : value;
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

        // No need to update `updatedAt` here, as this is for *live* updates,
        // and we only want to change the `updatedAt` field when explicitly saving.

        this.db.save(this.selected)
            .then(() => {
                this.nostrClient.publish(this.selected);
                this.editor.setContent(sanitizedContent); // Reflect changes in the editor.
            })
            .catch(() => this.showNotification("Object update failed.", "error"));
    }

    async deleteCurrentObject() {
        if (this.selected && confirm(`Are you sure you want to delete "${this.selected.name}"?`)) {
            try {
                await this.db.delete(this.selected.id);
                this.hideEditor();
                await this.renderList(); // Update the list after deletion
                this.showNotification(`Object "${this.selected.name}" has been deleted.`, "success");
            } catch (error) {
                this.showNotification("Failed to delete object.", "error");
            }
        }
    }

    // Notification System
    showNotification(message, type = "info") {
        this.notificationQueue.push({message, type});
        if (!this.notificationTimeout) {
            this.showNextNotification();
        }
    }

    showNextNotification() {
        if (this.notificationQueue.length === 0) {
            this.notificationTimeout = null;
            return;
        }

        const {message, type} = this.notificationQueue.shift();
        const $notification = $(`<div class="notification ${type}" role="status">${message}</div>`).appendTo("#notification-area");

        $notification.fadeIn(300, () => {
            this.notificationTimeout = setTimeout(() => {
                $notification.fadeOut(300, () => {
                    $notification.remove();
                    this.showNextNotification(); // Show the next notification
                });
            }, 4000);
        });
    }

    // Loading Indicator
    showLoading() {
        $(".loading-overlay").show();
    }

    hideLoading() {
        $(".loading-overlay").hide();
    }
}

// Initialize the app on DOMContentLoaded
document.addEventListener("DOMContentLoaded", () => {
    window.app = new App(); // Make the app instance globally accessible
});