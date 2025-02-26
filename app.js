import { formatISO } from "https://cdn.jsdelivr.net/npm/date-fns@2.29.3/esm/index.js";
import { Sidebar, MainContent, DashboardView, ContentView, formatDate } from "./index.js";
import * as Net from "./net.js";
import * as DB from "./db.js";
import * as NostrTools from 'https://cdn.jsdelivr.net/npm/nostr-tools@latest/+esm'
import { FriendsView } from "./view.friends.js";
import { SettingsView } from "./view.settings.js";
import { Matcher } from "./match.js";
import { nanoid } from 'https://cdnjs.cloudflare.com/ajax/libs/nanoid/5.0.9/nanoid.min.js';
import { Edit } from "./edit.js";

class App {

    constructor() {
        this.db = new DB.DB();
        this.matcher = new Matcher(this);
        this.selected = null;
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

        this.editor = new Edit();
        this.settingsView = new SettingsView(this); // Create settingsView here
        this.friendsView = new FriendsView(this);

        this.$container = $('<div class="container"></div>');
        $("body").append(
            this.$container.append(this.sidebar.$el, this.mainContent.$el),
            $('<div id="notification-area"></div>')
            //$('<div class="loading-overlay"><div class="spinner"></div></div>')
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

        this.selected = { ...this.selected, name, content: sanitizedContent, tags: this.extractTags(sanitizedContent), updatedAt: formatISO(new Date()) };
        await this.db.save(this.selected);
        this.nostrClient.publish(this.selected); //use this.nostrClient

        this.hideEditor();
        await this.renderList();
        this.showNotification("Object saved.", "success");
    }

    extractTags(html) {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return Array.from(doc.querySelectorAll(".inline-tag")).map(el => {
            const name = el.querySelector(".tag-name").textContent.trim();
            const condition = el.querySelector(".tag-condition").value;
            const tagDef = getTagDefinition(name);
            const v = el.querySelectorAll(".tag-value");

            let value;
            if (condition === "between" && tagDef.name === "time") {
                value = {
                    start: v[0]?.value,
                    end: v[1]?.value
                }
            } else if (condition === "between" && tagDef.name === "number") {
                value = {
                    lower: v[0]?.value,
                    upper: v[1]?.value
                };
            }
            else {
                value = v[0]?.value;
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

}

$(() => { window.app = new App(); });