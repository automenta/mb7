import {formatISO} from "date-fns";
import {ContentView, DashboardView, formatDate, MainContent, Sidebar} from "./view.app.js";
import {FriendsView} from "./view.friends.js";
import {SettingsView} from "./view.settings.js";
import * as Net from "./net.js";
import * as DB from "./db.js";
import * as NostrTools from 'https://cdn.jsdelivr.net/npm/nostr-tools@latest/+esm'
import {Matcher} from "./match.js";
import {nanoid} from 'https://cdnjs.cloudflare.com/ajax/libs/nanoid/5.0.9/nanoid.min.js';
import {Edit} from "./edit.js";
const NOTIFICATION_DURATION = 4000;

class App {

    constructor() {
        this.db = new DB.DB();
        this.matcher = new Matcher(this);
        this.selected = null;
        this.notificationQueue = [];
        this.nostrClient = new Net.Nostr(this);  // Make globally accessible and get tag defs
        this.init(); // Call the initialization
    }

    async init() {
        await this.db.initDB(); // Initialize the database *first*
        this.initUI();      // *Then* initialize the UI
    }

    async initUI() {
        this.initSidebar();
        this.initMainContent();
        this.initViews();
        this.loadKeysAndConnect();

        this.$container = $('<div class="container"></div>');
        $("body").append(
            this.$container.append(this.sidebar.$el, this.mainContent.$el),
            $('<div id="notification-area"></div>')
            //$('<div class="loading-overlay"><div class="spinner"></div></div>')
        );

        this.setView("dashboard"); // Set initial view
    }

    //Add a method to easily update network status:
    updateNetworkStatus(message) {
        $("#network-status").text(message);
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
            } catch (e) {
                console.error("Failed to publish event:", e);
                return; //stop if publish fails.  Error already notified.
            }

            await this.db.delete(this.selected.id);
            this.hideEditor();
            await this.renderList();
            this.showNotification(`"${this.selected.name}" deleted.`, "success");
        }
    }

    //displayPubkeyOnDashboard() {
    //    if (window.keys?.pub && !$("#dashboard-view #pubkey-display").length) {
    //        $("#dashboard-view").append(`<p id="pubkey-display">Your Public Key: ${NostrTools.nip19.npubEncode(window.keys.pub)}</p>`);
    //    }
    //}


    setView(viewName) {
        const views = {
            "dashboard": () => {
                const dashboardView = new DashboardView(this);
                dashboardView.render();
                return dashboardView;
            },
            "content": () => new ContentView(this),
            "settings": () => this.settingsView,
            "friends": () => this.friendsView,
            "default": () => {
                const defaultDashboardView = new DashboardView(this);
                defaultDashboardView.render();
                return defaultDashboardView;
            }
        };

        const view = (views[viewName] || views["default"])();
        this.mainContent.showView(view);
        this.mainContent.currentView = view;
        viewName === "content" && this.renderList();
    }

    async renderList(filter = "") {
        const $list = $("#object-list").empty();
        const objects = await this.db.getAll();
        const filtered = filter
            ? objects.filter(o => Object.values(o).some(val => typeof val === 'string' && val.toLowerCase().includes(filter.toLowerCase())))
            : objects;

        if (filtered.length) {
            filtered.forEach(obj => {
                const $item = $(`<div class="object-item" data-id="${obj.id}" tabindex="0"></div>`);
                $item.append($('<strong>').text(obj.name));
                $item.append($('<div>').html(obj.content));
                $item.append($(`<small>Updated: ${formatDate(obj.updatedAt)}</small>`));
                $list.append($item);
            });
        } else {
            $list.html("<p>No objects found.</p>");
        }
    }

    createNewObject() {
        this.showEditor({
            id: nanoid(),
            name: "",
            content: "",
            tags: [],
            createdAt: formatISO(new Date()),
            updatedAt: formatISO(new Date())
        });
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
        if (!name) {
            this.showNotification("Object name is required.", "warning");
            return;
        }

        const sanitizedContent = DOMPurify.sanitize(this.editor.getContent(), {
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
        });

        this.selected = {
            ...this.selected,
            name,
            content: sanitizedContent,
            tags: this.extractTags(sanitizedContent),
            updatedAt: formatISO(new Date())
        };
        await this.db.save(this.selected);
        //this.nostrClient.publish(this.selected); //use this.nostrClient

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
            } else {
                value = v[0]?.value;
            }
            return {name, condition, value};
        });
    }

    async updateCurrentObject() {
        if (!this.selected) return;
        const sanitizedContent = DOMPurify.sanitize(this.editor.getContent(), {
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
        });
        this.selected.content = sanitizedContent;
        this.selected.tags = this.extractTags(sanitizedContent);
        try {
            await this.db.save(this.selected);
            //this.nostrClient.publish(this.selected);
            this.editor.setContent(sanitizedContent);
        } catch (e) {
            this.showNotification("Object update failed.", "error");
        }
    }

    showNotification(message, type = "info") {
        this.notificationQueue.push({message, type});
        if (!this.notificationTimeout) {
            this.showNextNotification();
        }
    }

    showNextNotification() {
        if (!this.notificationQueue.length) {
            this.notificationTimeout = null;
            return;
        }
        const {message, type} = this.notificationQueue.shift();
        const $notification = $(`<div class="notification ${type}">${message}</div>`).appendTo("#notification-area");
        $notification.fadeIn(300, () => {
            this.notificationTimeout = setTimeout(() => {
                $notification.fadeOut(300, () => {
                    $notification.remove();
                    this.showNextNotification();
                });
            }, NOTIFICATION_DURATION);
        });
    }

}

$(() => {
    window.app = new App();
});