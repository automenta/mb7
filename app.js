import $ from 'jquery';
import {formatISO} from "date-fns";
import {ContentView, formatDate, MainContent, Menubar} from "./view.app.js";
import {FriendsView} from "./view.friends.js";
import {SettingsView} from "./view.settings.js";
import {EditView} from "./view.edit.js";
import * as Net from "./net.js";
import * as DB from "./db.js";
import {Matcher} from "./match.js";
import {nanoid} from 'nanoid';

const NOTIFICATION_DURATION = 4000;

class App {

    constructor() {
        this.db = new DB.DB();
        this.matcher = new Matcher(this);
        this.selected = null;
        this.notificationQueue = [];
        this.nostrClient = new Net.Nostr(this);  // Initialize Nostr client and make it globally accessible within the app
        this.mainContent = new MainContent();
        this.settingsView = new SettingsView(this);
        this.friendsView = new FriendsView(this);
        //this.$editorContainer = $("#editor-container");
        this.$objectName = $("#object-name");
        this.$createdAt = $("#created-at");

    }

    async init() {
        await DB.DB.initDB(); // Initialize the database *first*
        await this.loadKeysAndConnect();
        await this.initUI();      // *Then* initialize the UI
    }

    async initUI() {

        this.$container = document.createElement('div');
        this.$container.className = 'container';
        this.sidebar = new Menubar(this);
        this.sidebar.build();
        this.$container.append(this.sidebar.el);
        this.$container.append(this.mainContent.el);
        const appDiv = document.getElementById('app');
        appDiv.append(this.$container);
        const notificationArea = document.createElement('div');
        notificationArea.setAttribute("id", "notification-area");
        document.body.append(notificationArea);

        // initial view
        this.setView(
            "new_object"
            //"content"
        );
    }

    /*initSidebar() {};
    initMainContent() {};
    initViews() {};*/
    async loadKeysAndConnect() {
        window.keys = await DB.loadKeys();
        this.nostrClient.connectToRelays();
    }

    //Add a method to easily update network status:
    updateNetworkStatus(message) {
        const networkStatusEl = document.querySelector("#network-status");
        if (networkStatusEl) {
            networkStatusEl.innerHTML = message;
        }
    }

    async deleteCurrentObject() {
        if (this.selected && confirm(`Delete "${this.selected.name}"?`)) {
            const event = {
                kind: 5,
                created_at: Math.floor(Date.now() / 1000),
                tags: [["e", this.selected.id]],
                content: "",
                pubkey: window.keys.pub,
            };
            try {
                await this.nostrClient.publishEvent(event);
            } catch (e) {
                console.error("Failed to publish event:", e);
                throw e; // Re-throw the error to allow Vite to catch it
            }

            await this.db.delete(this.selected.id);
            this.hideEditor();
            await this.renderList();
            this.showNotification(`"${this.selected.name}" deleted.`, "success");
        }
    }

    setView(viewName) {
        const views = {
            "content": () => {
                const contentView = new ContentView(this);
                contentView.render();
                return contentView;
            },
            "settings": () => this.settingsView,
            "friends": () => this.friendsView,
            "new_object": () => {
                const editView = new EditView(this);
                this.createNewObject(editView);
                this.mainContent.showView(editView);
                return editView;
            }
        };

        const view = views[viewName]();
        this.mainContent.showView(view);
        this.mainContent.currentView = view;
        if (viewName === "content") {
            view.build();
            this.renderList();
        }
    }

    async renderList(filter = "") {
        const listEl = document.querySelector("#object-list");
        listEl.innerHTML = "";
        const objects = await this.db.getAll();
        const filtered = filter
            ? objects.filter(o => Object.values(o).some(val => typeof val === 'string' && val.toLowerCase().includes(filter.toLowerCase())))
            : objects;

        if (filtered.length) {
            filtered.forEach(obj => {
                const itemEl = document.createElement('div');
                itemEl.className = "object-item";
                itemEl.dataset.id = obj.id;
                itemEl.tabIndex = 0;
                itemEl.innerHTML = `
                    <div class="object-header">
                        <strong>${obj.name}</strong>
                        <small>Updated: ${formatDate(obj.updatedAt)}</small>
                    </div>
                    <div class="object-content">${obj.content.substring(0, 100)}...</div>
                    <div class="object-tags">${obj.tags?.map(tag => `<span class="tag">${tag.name}</span>`).join('')}</div>
                `;
                listEl.append(itemEl);
            });
        } else {
            listEl.innerHTML = "<p>No objects found.</p>";
        }
    }

    createNewObject(editView) {
        editView.setContent(""); // Clear the editor content
        this.showEditor({
            id: nanoid(),
            editView: editView,
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
        this.mainContent.showView(object.editView);
        const objectNameEl = document.querySelector("#object-name");
        const createdAtEl = document.querySelector("#created-at");

        if (objectNameEl) {
            objectNameEl.value = object.name || "";
        }
        if (createdAtEl) {
            createdAtEl.textContent = object.createdAt ? formatDate(object.createdAt) : "";
        }
        object.editView.setContent(object.content || "");
    }

    hideEditor() {
        //this.$editorContainer.hide();
        this.selected = null;
        // Clear input fields and editor content
        document.querySelector("#object-name").value = '';
        document.querySelector("#created-at").textContent = '';
        this.selected?.editView?.edit.setContent('');
    }

    async saveObject() {
        if (!this.selected) return;
        const name = $("#object-name").val().trim();
        if (!name) {
            this.showNotification("Object name is required.", "warning");
            return;
        }

        const sanitizedContent = DOMPurify.sanitize(this.selected?.editView?.edit.getContent(), {
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
            switch (true) {
                case condition === "between" && tagDef.name === "time":
                    value = {
                        start: v[0]?.value ?? undefined,
                        end: v[1]?.value ?? undefined
                    };
                    break;
                case condition === "between" && tagDef.name === "number":
                    value = {
                        lower: v[0]?.value ?? undefined,
                        upper: v[1]?.value ?? undefined
                    };
                    break;
                default:
                    value = v[0]?.value ?? undefined;
            }
            return {name, condition, value};
        });
    }

    async updateCurrentObject() {
        if (!this.selected) return;
        const sanitizedContent = DOMPurify.sanitize(this.selected?.editView?.edit.getContent(), {
            ALLOWED_TAGS: ["br", "b", "i", "span"],
            ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
        });
        this.selected.content = sanitizedContent;
        this.selected.tags = this.extractTags(sanitizedContent);
        try {
            await this.db.save(this.selected);
            //this.nostrClient.publish(this.selected);
        } catch (e) {
            this.showNotification("Object update failed.", "error");
        }
        //throw e;
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
        const icon = type === "success" ? "✅" : type === "warning" ? "⚠️" : type === "error" ? "❌" : "ℹ️";
        const notificationArea = document.querySelector("#notification-area");
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification ${type}`;
        notificationEl.innerHTML = `${icon} ${message}`;
        notificationArea.append(notificationEl);
        notificationEl.style.right = '-300px';
        notificationEl.style.opacity = 0;

        notificationEl.animate({
            right: '10px',
            opacity: 1
        }, {duration: 300, fill: 'forwards'});

        this.notificationTimeout = setTimeout(() => {
            notificationEl.animate({
                right: '-300px',
                opacity: 0
            }, {duration: 300, fill: 'forwards'}).finished.then(() => {
                notificationEl.remove();
                this.showNextNotification();
            });
        }, NOTIFICATION_DURATION);
    }

}

document.addEventListener("DOMContentLoaded", async () => {
    window.app = new App();
    await window.app.init();
});