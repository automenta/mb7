import * as Net from "./net.js";
import * as DB from "./db.js";
import { format, formatISO, isValid as isValidDate, parseISO } from "https://cdn.jsdelivr.net/npm/date-fns@2.29.3/esm/index.js";
import Fuse from "https://cdn.jsdelivr.net/npm/fuse.js@6.6.2/dist/fuse.esm.js";
import { nanoid } from "https://cdn.jsdelivr.net/npm/nanoid@5.0.9/nanoid.js";
import * as NostrTools from 'https://cdn.jsdelivr.net/npm/nostr-tools@2.2.1/+esm'

// Utility function for date formatting
const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), localStorage.getItem("dateFormat") || "Pp")
        : "";

// Base class for UI components
class UIComponent {
    constructor(selectorOrTemplate = "<div></div>") {
        this.$el = $(selectorOrTemplate);
    }
    remove() { this.$el.remove(); }
}

// Tag ontology
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
        validate: (value, condition) => !isNaN(parseFloat(value)) && isFinite(value),
        serialize: (value) => String(value),
        deserialize: (value) => value
    },
};

// Retrieves a tag definition
const getTagDefinition = (name) => TagOntology[name] || TagOntology.string;

// InlineTag component
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
        if (this.tagData.condition === "between" && tagDef.name === "time") {
            this.tagData.value = {
                start: this.$el.find(".lower").val(),
                end: this.$el.find(".upper").val(),
            };
        } else if (this.tagData.condition === "between" && tagDef.name === "number") {
            this.tagData.value = {
                lower: this.$el.find(".lower").val(),
                upper: this.$el.find(".upper").val(),
            };
        }
        else {
            this.tagData.value = this.$el.find(".tag-value").val();
        }
        this.onUpdate?.();
    }

    getTagData() { return this.tagData; }
}

// Editor component
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

// Tagger component
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
        const coords = this.getCaretCoordinates();
        this.$popup.css({ left: coords.x, top: coords.y + 20 }).show();
        this.$search.val("").focus();
    }

    hide() { this.$popup.hide(); }

    getCaretCoordinates() {
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

// Abstract View class for common view functionality.
class View extends UIComponent {
    constructor(app, selectorOrTemplate) {
        super(selectorOrTemplate)
        this.app = app;
        this.build();
        this.bindEvents();
    }

    build() { } // To be implemented by subclasses.
    bindEvents() { } // To be implemented by subclasses.
}

// Sidebar component
class Sidebar extends View {
    constructor(app) { super(app, `<div class="sidebar-left"></div>`); }

    build() {
        this.$el.append(
            this.buildSection("Menu", [{ label: "Dashboard", view: "dashboard" }, { label: "Content", view: "content" }, { label: "Settings", view: "settings" }, { label: "Friends", view: "friends" }]),
            this.buildSection("Links", [{ label: "Recent Items", list: "recent" }]),
            $("<h3>Network</h3>", `<div id="network-status">Connecting...</div><hr>`)
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

// ContentView component
class ContentView extends View {
    constructor(app) { super(app, `<div id="content-view" class="view"><h2>Content</h2></div>`); }

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
        this.$el.find("#insert-tag-btn").on("click", (e) => { e.preventDefault(); this.tagger.show(e) });
        this.$el.find("#object-list").on("click", ".object-item", (e) => this.app.editOrViewObject($(e.currentTarget).data("id")));
    }
}

// SettingsView component.
class SettingsView extends View {
    constructor(app) { super(app, `<div id="settings-view" class="view"><h2>Settings</h2></div>`); }

    build() {
        this.$el.append(
            `<h3>Nostr Keys</h3>
            <button id="generate-key-btn">Generate Key Pair</button>
            <button id="import-key-btn">Import Key</button>
            <button id="export-key-btn">Export Key</button>
            <div id="key-display"></div>
            <h3>Relays</h3>
            <textarea id="relay-list" placeholder="Relays (one per line)"></textarea>
            <button id="save-relays-btn">Save Relays</button>
            <h3>Preferences</h3>
            <label>Date/Time Format: <select id="date-format-select"><option value="Pp">Pp</option><option value="MM/dd/yyyy">MM/dd/yyyy</option></select></label>
            <h3>User Profile (Nostr)</h3>
            <label for="profile-name">Name:</label><input type="text" id="profile-name">
            <label for="profile-picture">Picture:</label><input type="text" id="profile-picture">
            <button id="save-profile-btn">Save Profile</button>
            <div id="profile-display"></div>
            <button id="clear-all-data-btn">Clear All Data</button> `
        );
    }

    bindEvents() {
        this.$el.find("#generate-key-btn").on("click", this.generateKeyPair.bind(this));
        this.$el.find("#import-key-btn").on("click", this.importKey.bind(this));
        this.$el.find("#export-key-btn").on("click", this.exportKey.bind(this));
        this.$el.find("#save-relays-btn").on("click", this.saveRelays.bind(this));
        this.$el.find("#date-format-select").on("change", () => localStorage.setItem("dateFormat", this.$el.find("#date-format-select").val()));
        this.$el.find("#save-profile-btn").on("click", this.saveProfile.bind(this));
        this.$el.find("#clear-all-data-btn").on("click", () => {
            if (confirm("Are you sure you want to clear all data? This cannot be undone.")) {
                this.app.db.clearAllData().then(() => {
                    this.app.showNotification("All data cleared.", "success");
                    // Reload the application or reset to a default state
                    window.location.reload(); // Simplest approach for complete reset
                });
            }
        });

    }

    async generateKeyPair() {
        try {
            const privKey = DB.generatePrivateKey();
            const pubKey = await NostrTools.getPublicKey(privKey);
            window.keys = { priv: privKey, pub: pubKey };
            this.displayKeys();
            await this.app.db.saveKeys(window.keys); //Use app.db
            this.app.showNotification("Keys generated.", "success");
        } catch { this.app.showNotification("Key generation failed.", "error"); }
    }

    async importKey() {
        const privKey = prompt("Enter private key (hex):");
        if (!privKey) return;
        try {
            if (!/^[0-9a-fA-F]{64}$/.test(privKey)) throw new Error("Invalid key format.");
            window.keys = { priv: privKey, pub: await NostrTools.getPublicKey(privKey) };
            this.displayKeys();
            await this.app.db.saveKeys(window.keys);
            this.app.showNotification("Key imported.", "success");
        } catch (err) { this.app.showNotification(`Error importing key: ${err.message}`, "error"); }
    }

    async exportKey() {
        const loadedKeys = await DB.loadKeys();
        if (!loadedKeys) { this.app.showNotification("No keys to export.", "error"); return; }
        try {
            await navigator.clipboard.writeText(JSON.stringify(loadedKeys, null, 2));
            this.app.showNotification("Keys copied to clipboard.", "success");
        } catch { this.app.showNotification("Failed to copy keys.", "error"); }
    }

    displayKeys() {
        this.$el.find("#key-display").html(`<p><strong>Public Key:</strong> ${NostrTools.nip19.npubEncode(window.keys?.pub) || "No key"}</p>`);
    }

    saveRelays() {
        const relays = this.$el.find("#relay-list").val().split("\n").map(l => l.trim()).filter(Boolean);
        relays.length && this.app.nostrClient?.setRelays(relays); // Use app.nostrClient
        this.app.showNotification("Relays saved and updated.", "success"); //consistent feedback
    }

    async saveProfile() {
        const profile = { name: this.$el.find("#profile-name").val(), picture: this.$el.find("#profile-picture").val() };
        const event = {
            kind: 0,
            created_at: Math.floor(Date.now() / 1000),
            tags: [],
            content: JSON.stringify(profile),
            pubkey: window.keys.pub,
        };
        try {
            event.id = await NostrTools.getEventHash(event);
            event.sig = await NostrTools.signEvent(event, window.keys.priv);
            this.app.nostrClient.publishRawEvent(event);  //use app.nostrClient
            this.displayProfile(profile);
            this.app.showNotification("Profile saved and published.", "success"); //consistent feedback

        } catch(error) {
            console.error("Error saving profile:", error);
            this.app.showNotification("Error saving profile.", "error");
        }
    }

    displayProfile(profile) {
        this.$el.find("#profile-display").html(`<p><strong>Name:</strong> ${profile.name || ""}</p>${profile.picture ? `<img src="${profile.picture}" style="max-width:100px;max-height:100px;">` : ""}`);
    }
}

// DashboardView component
class DashboardView extends View {
    constructor(app) { super(app, `<div id="dashboard-view" class="view"><h2>Dashboard</h2></div>`); }

    build() {
        this.$el.append(
            `<div id="dashboard-stats"></div>
            <h3>Recent Activity</h3><div id="recent-activity"></div>
            <h3>Tag Cloud</h3><div id="tag-cloud"></div>`
        );
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

// FriendsView component
class FriendsView extends View {
    constructor(app) {
        super(app, `<div id="friends-view" class="view"><h2>Friends</h2></div>`);
    }

    build() {
        this.$el.append(
            `<input type="text" id="friend-pubkey" placeholder="Enter friend's nPub or pubkey">
             <button id="add-friend-btn">Add Friend</button>
             <h3>Your Friends</h3>
             <ul id="friends-list"></ul>`
        );
    }

    bindEvents() {
        this.$el.find("#add-friend-btn").on("click", () => this.addFriend());
        this.loadFriends(); // Load friends on initialization
    }

    async addFriend() {
        let pubkey = this.$el.find("#friend-pubkey").val().trim();
        if (!pubkey) return;

        // Check if input is an npub and decode to hex
        try {
            if (pubkey.startsWith("npub")) {
                pubkey = NostrTools.nip19.decode(pubkey).data;
            }
        } catch (error) {
            this.app.showNotification("Invalid nPub format", "error");
            return;
        }

        // Validate the public key format (hex)
        if (!/^[0-9a-fA-F]{64}$/.test(pubkey)) {
            this.app.showNotification("Invalid public key format", "error");
            return;
        }

        try {
            await this.app.db.addFriend(pubkey);
            this.app.showNotification(`Added friend: ${NostrTools.nip19.npubEncode(pubkey)}`, "success");
            this.loadFriends();
            this.app.nostrClient.connectToPeer(pubkey); // Connect immediately

        } catch(error) {
            this.app.showNotification("Failed to add friend.", "error")
        }
    }

    async loadFriends() {
        const friends = await this.app.db.getFriends();
        this.$el.find("#friends-list").html(friends.map(friend => `<li>${NostrTools.nip19.npubEncode(friend.pubkey)} <button class="remove-friend" data-pubkey="${friend.pubkey}">Remove</button></li>`).join(''));
        this.$el.find(".remove-friend").on("click", (e) => this.removeFriend($(e.target).data("pubkey")));
    }

    async removeFriend(pubkey) {
        try {
            await this.app.db.removeFriend(pubkey);
            this.loadFriends(); // Refresh list after removing.
        } catch(error) {
            this.app.showNotification("Failed to remove friend.", "error");
        }
    }
}

// MainContent component
class MainContent extends UIComponent {
    constructor() { super(`<div class="main-content"><div class="content"></div></div>`); }
    showView(view) { this.$el.find(".content").empty().append(view.$el); }
}

// Matcher class
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
            if (obj.tags?.some(tagData => this.matchTagData(tagData, text, event))) {
                matches.push(obj);
            }
        }

        if (!matches.length) {
            this.fuse.setCollection(objects);
            matches.push(...this.fuse.search(text).filter(r => r.score <= this.fuse.options.threshold).map(r => r.item));
        }

        matches.length && this.app.showNotification(
            `Match in ${matches.length} object(s) for event from ${NostrTools.nip19.npubEncode(event.pubkey)}:<br>${matches.map(m => `<em>${m.name}</em> (updated ${formatDate(m.updatedAt)})`).join("<br>")}`
        );
    }

    matchTagData(tagData, text, event) {
        const { name, condition, value } = tagData;
        const tagDef = getTagDefinition(name);

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

            } catch { return false; }
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

// Main App class
class App {
    constructor() {
        this.db = new DB.DB();
        this.matcher = new Matcher(this);
        this.selected = null;
        this.$container = $('<div class="container"></div>');
        this.notificationQueue = [];
        window.nostrClient = this.nostrClient = new Net.Nostr(this.matcher);  // Make globally accessible
        this.initUI();
    }

    async initUI() {
        this.sidebar = new Sidebar(this);
        this.mainContent = new MainContent();
        this.editor = new Editor();

        $("body").append(
            this.$container.append(this.sidebar.$el, this.mainContent.$el),
            $('<div id="notification-area"></div>'),
            $('<div class="loading-overlay"><div class="spinner"></div></div>')
        );
        const keys = await DB.loadKeys();
        if(keys) {
            window.keys = keys;
            this.nostrClient.connect(); // Connect to Nostr relays on load
            this.displayPubkeyOnDashboard();
        }
        this.setView("dashboard");
    }

    displayPubkeyOnDashboard() {
        if(window.keys && window.keys.pub) {
            $("#dashboard-view").append(`<p>Your Public Key: ${NostrTools.nip19.npubEncode(window.keys.pub)}</p>`)
        }
    }

    setView(viewName) {
        const viewMap = {
            dashboard: () => { const v = new DashboardView(this); v.render(); return v; },
            content: () => new ContentView(this),
            settings: () => new SettingsView(this),
            friends: () => new FriendsView(this),
        };
        const view = (viewMap[viewName] || viewMap.dashboard)();
        this.mainContent.showView(view);
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

    hideEditor() { $("#editor-container").hide(); this.selected = null; }

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

    async deleteCurrentObject() {
        if (this.selected && confirm(`Delete "${this.selected.name}"?`)) {
            await this.db.delete(this.selected.id);
            this.hideEditor();
            await this.renderList();
            this.showNotification(`"${this.selected.name}" deleted.`, "success");
        }
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