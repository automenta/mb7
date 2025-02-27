import $ from 'jquery';
import { formatISO } from "date-fns";
import { formatDate } from './content-view-renderer.js';
import {ContentView, MainContent, Menubar} from "./view.app.js";
import {FriendsView} from "./view.friends.js";
import {SettingsView} from "./view.settings.js";
import {EditView} from "./view.edit.js";
import * as Net from "./net.js";
import * as DB from "./db.js";
import {Matcher} from "./match.js";
import {nanoid} from 'nanoid';
import { extractTags } from "./tag-utils.js";
import { NotificationManager } from "./notification-manager.js";

const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: ["br", "b", "i", "span"],
    ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
};

class App {

    constructor() {
        this.db = new DB.DB();
        this.matcher = new Matcher(this);
        this.selected = null;
        this.nostrClient = new Net.Nostr(this);
        this.mainContent = new MainContent();
        this.settingsView = new SettingsView(this);
        this.friendsView = new FriendsView(this);
        this.$objectName = $("#object-name");
        this.$createdAt = $("#created-at");
        this.elements = {};
        this.notificationManager = new NotificationManager(this);
    }

    async init() {
        await DB.DB.initDB(); // Initialize the database *first*
        await this.loadKeysAndConnect();
        await this.initUI();      // *Then* initialize the UI
    }

    async initUI() {

        this.$container = document.createElement('div');
        this.$container.className = 'container';
        this.menubar = new Menubar(this);
        this.$container.append(this.menubar.el);
        this.$container.append(this.mainContent.el);

        const appDiv = document.getElementById('app');
        appDiv.append(this.$container);
        const notificationArea = document.createElement('div');
        notificationArea.setAttribute("id", "notification-area");
        document.body.append(notificationArea);
        this.elements.notificationArea = notificationArea;

        // initial view
        this.setView(
            "new_object"
        );
    }

    async loadKeysAndConnect() {
        window.keys = await DB.loadKeys();
        this.nostrClient.connectToRelays();
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
            this.notificationManager.showNotification(`"${this.selected.name}" deleted.`, "success");
        }
    }

    setView(viewName) {
        const views = {
            content: () => {
                const contentView = new ContentView(this);
                contentView.render();
                return contentView;
            },
            settings: () => this.settingsView,
            friends: () => this.friendsView,
            new_object: () => {
                const editView = new EditView(this);
                this.mainContent.currentView = editView;
                this.mainContent.showView(editView);
                this.createNewObject(editView);
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
        const listEl = this.mainContent.currentView.elements.objectList;
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
        const object = {
            id: nanoid(),
            editView: editView,
            name: "",
            content: "",
            tags: [],
            createdAt: (() => { const now = new Date(); return formatISO(now); })(),
            updatedAt: (() => { const now = new Date(); return formatISO(now); })()
        };
        this.showEditor(object);
    }

    async editOrViewObject(id) {
        const obj = await this.db.get(id);
        obj && this.showEditor(obj);
    }

    showEditor(object) {
        this.selected = object;
        this.mainContent.showView(object.editView);
        const objectNameEl = this.mainContent.currentView.elements.objectName;
        const createdAtEl = this.mainContent.currentView.elements.createdAt;

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
        this.mainContent.currentView.elements.objectName.value = '';
        this.mainContent.currentView.elements.createdAt.textContent = '';
        this.selected?.editView?.edit.setContent('');
    }

    async saveObject() {
        if (!this.selected) return;
        const name = $("#object-name").val().trim();
        if (!name) {
            this.notificationManager.showNotification("Object name is required.", "warning");
            return;
        }

        const sanitizedContent = DOMPurify.sanitize(this.selected?.editView?.edit.getContent(), DOMPURIFY_CONFIG);

        this.selected = {
            ...this.selected,
            name,
            content: sanitizedContent,
            tags: extractTags(sanitizedContent),
            updatedAt: (() => { const now = new Date(); return formatISO(now); })()
        };
        await this.db.save(this.selected);

        this.hideEditor();
        await this.renderList();
        this.notificationManager.showNotification("Object saved.", "success");
    }

    async updateCurrentObject() {
        if (!this.selected) return;
        const sanitizedContent = DOMPurify.sanitize(this.selected?.editView?.edit.getContent(), DOMPURIFY_CONFIG);
        this.selected.content = sanitizedContent;
        this.selected.tags = extractTags(sanitizedContent);
        try {
            await this.db.save(this.selected);
        } catch (e) {
            this.notificationManager.showNotification("Object update failed.", "error");
        }
    }
}

document.addEventListener("DOMContentLoaded", async () => {
    window.app = new App();
    await window.app.init();
});