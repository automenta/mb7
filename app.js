import $ from 'jquery';
import { formatISO } from "date-fns";
import { formatDate } from './content-view-renderer.js';
import { ContentView, MainContent, Menubar } from "./view.app.js";
import { FriendsView } from "./view.friends.js";
import { SettingsView } from "./view.settings.js";
import * as Net from "./net.js";
import * as DB from "./db.js";
import { Matcher } from "./match.js";
import { nanoid } from 'nanoid';
import { extractTags } from "./tag-utils.js";
import { NotificationManager } from "./notification-manager.js";
import { NotesView } from './view.notes.js';
import DOMPurify from 'dompurify';
import { ErrorHandler } from './error-handler.js';


const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: ["br", "b", "i", "span", "p", "strong", "em", "ul", "ol", "li", "a"],
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
        this.errorHandler = new ErrorHandler(this);
    }

    async init() {
        await DB.DB.initDB();
        await this.loadKeysAndConnect();                
        await this.initUI();
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

        this.setView(
            "notes"
        );
    }

    async loadKeysAndConnect() {
        window.keys = await DB.loadKeys();
        this.nostrClient.connectToRelays();
    }


    async deleteCurrentObject(note) {
        if (note && note.id) {
            try {
                await this.db.delete(note.id);
                await this.renderList();
                this.notificationManager.showNotification(`"${note.name}" deleted.`, "success");
            } catch (dbError) {
                console.error("Error deleting object:", dbError);
                this.errorHandler.handleError(dbError, `Error deleting object from database: ${dbError.message}`);
            }
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
            notes: () => {
                const notesView = new NotesView(this);
                this.mainContent.showView(notesView);
                return notesView;
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
        const filtered = filter ? objects.filter(o => Object.values(o).some(val => typeof val === 'string' && val.toLowerCase().includes(filter.toLowerCase()))) : objects;
        if (filtered.length) {
            filtered.forEach(obj => {
                const itemEl = document.createElement('div');
                itemEl.className = "object-item";
                itemEl.dataset.id = obj.id;
                itemEl.tabIndex = 0;

                const headerEl = document.createElement('div');
                headerEl.className = "object-header";

                const nameEl = document.createElement('strong');
                nameEl.textContent = obj.name;

                const updatedEl = document.createElement('small');
                updatedEl.textContent = `Updated: ${formatDate(obj.updatedAt)}`;

                headerEl.append(nameEl, updatedEl);

                const contentEl = document.createElement('div');
                contentEl.className = "object-content";
                contentEl.textContent = obj.content ? `${obj.content.substring(0, 100)}...` : "";

                const tagsEl = document.createElement('div');
                tagsEl.className = "object-tags";
                if (obj.tags) {
                    obj.tags.forEach(tag => {
                        const tagEl = document.createElement('span');
                        tagEl.className = "tag";
                        tagEl.textContent = tag.name;
                        tagsEl.append(tagEl);
                    });
                }

                itemEl.append(headerEl, contentEl, tagsEl);
                listEl.append(itemEl);
            });
        } else {
            listEl.innerHTML = "<p>No objects found.</p>";
        }
    }

    async saveOrUpdateObject(object) {
        try {
            const updatedObject = this.prepareObjectForSaving(object);
            const savedObject = await this.db.save(updatedObject);
            this.hideEditor();
            await this.renderList();
            this.notificationManager.showNotification("Object saved.", "success");
            this.selected = savedObject;
        } catch (error) {
            console.error("Error saving object:", error);
            this.errorHandler.handleError(error, `Error saving object: ${error.message}`);
        }
    }

    prepareObjectForSaving(object) {
        if (!object.name) {
            throw new Error('Object name is required.');
        }
        if (object.name.length > 100) {
            throw new Error('Object name is too long (max 100 characters).');
        }
        if (object.content && object.content.length > 10000) {
            throw new Error('Object content is too long (max 10000 characters).');
        }
        if (object.tags) {
            object.tags.forEach(tag => {
                if (!tag.name)
                    throw new Error('Tag name is required.');
                if (tag.name.length > 50)
                    throw new Error('Tag name is too long (max 50 characters).');
            });
        }
        const sanitizedContent = DOMPurify.sanitize(object.content, DOMPURIFY_CONFIG);
        const now = formatISO(new Date());
        let updatedObject = {
            ...object,
            name: object.name,
            content: sanitizedContent,
            tags: extractTags(sanitizedContent),
            updatedAt: now
        };
        if (!updatedObject.id) {
            updatedObject.id = nanoid();
        }
        // Validate id, createdAt, and updatedAt
        if (!updatedObject.id || typeof updatedObject.id !== 'string')
            throw new Error('Invalid object ID.');

        if (!updatedObject.createdAt || isNaN(Date.parse(updatedObject.createdAt)))
            throw new Error('Invalid createdAt date.');

        if (!updatedObject.updatedAt || isNaN(Date.parse(updatedObject.updatedAt)))
            throw new Error('Invalid updatedAt date.');

        return updatedObject;
    }

    createNewObject(editView, newNote) {
        if (editView && editView.edit)
            editView.edit.setContent('');

        return this.selected = {
            id: nanoid(),
            editView: editView,
            name: "",
            content: "",
            tags: [],
            createdAt: formatISO(new Date()),
            updatedAt: formatISO(new Date())
        };
    }

    async editOrViewObject(id) {
        const obj = await this.db.get(id);
        obj && this.showEditor(obj);
    }

    showEditor(object) {
        this.selected = object;
        this.mainContent.showView(object.editView);
        this.$objectName.val(object.name);
        this.$createdAt.text(object.createdAt);
    }

    hideEditor() {
        this.selected = null;
        this.$objectName.val('');
        this.$createdAt.text('');
        //this.selected?.editView?.edit.setContent('');
    }
}


document.addEventListener("DOMContentLoaded", async () => { await (window.app = new App()).init(); });