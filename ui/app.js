import $ from 'jquery';
import { dateISO, formatDate } from './content-view-renderer.js';
import { ContentView, MainContent, Menubar } from "./view.app.js";
import { FriendsView } from "./view.friends.js";
import { SettingsView } from "./view.settings.js";
import { ListItemRenderer } from "./list-item-renderer.js";
import * as Net from "../core/net.js";
import * as DB from "../core/db.js";
import { Matcher } from "../core/match.js";
import { nanoid } from 'nanoid';
import { extractTags } from "../core/tag-utils.js";
import { NotificationManager } from "./notification-manager.js";
import { NotesView } from './view.notes.js';
import DOMPurify from 'dompurify';
import { ErrorHandler } from '../core/error-handler.js';

const DOMPURIFY_CONFIG = {
    ALLOWED_TAGS: ["br", "b", "i", "span", "p", "strong", "em", "ul", "ol", "li", "a"],
    ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
};


class App {

    constructor() {
        this.notificationManager = new NotificationManager(this);
        this.errorHandler = new ErrorHandler(this);

        this.db = new DB.DB();
        this.nostrClient = new Net.Nostr(this);
        this.matcher = new Matcher(this);

        this.mainContent = new MainContent();
        this.settingsView = new SettingsView(this);
        this.friendsView = new FriendsView(this);
        this.elements = {};

    }

    async init() {
        await DB.DB.the();
        await this.loadKeysAndConnect();
        this.initUI();
    }

    initUI() {
        this.$container = document.createElement('div');
        this.$container.className = 'container';
        this.menubar = new Menubar(this);
        this.$container.append(this.menubar.el, this.mainContent.el);

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

    setView = (viewName) => {
        const contentView = new ContentView(this);
        const views = new Map([
            ["content", () => {
                contentView.render();
                return contentView;
            }],
            ["settings", () => this.settingsView],
            ["friends", () => this.friendsView],
            ["notes", () => new NotesView(this)]
        ]);
        const view = views.get(viewName)();
        this.mainContent.showView(view);
        this.mainContent.currentView = view;
        if (viewName === "content") {
            //view.build();
            this.renderList();
        }
    }
    /** DEPRECATED: Render NObjects, such as those containing List tag's, through the Ontology */
    async renderList(filter = "") {
        const listEl = this.mainContent.currentView.elements.objectList;
        while (listEl.firstChild) listEl.removeChild(listEl.firstChild);
        const objects = await this.db.getAll();
        const filtered = filter ? objects.filter(o => Object.values(o).some(val => typeof val === 'string' && val.toLowerCase().includes(filter.toLowerCase()))) : objects;
        const itemRenderer = new ListItemRenderer();
        if (filtered.length) {
            filtered.forEach(obj => {
                const itemEl = itemRenderer.render(obj);
                listEl.append(itemEl);
            });
        } else {
            listEl.innerHTML = "<p>No objects found.</p>";
        }
    }


    /** TODO move to DB? */
    prepareObjectForSaving(object) {
        if (!object.name)
            throw new Error('Object name is required.');
        if (object.name.length > 100)
            throw new Error('Object name is too long (max 100 characters).');
        if (object.content && object.content.length > 10000)
            throw new Error('Object content is too long (max 10000 characters).');
        if (object.tags) {
            object.tags.forEach(tag => {
                if (!tag.name) throw new Error('Tag name is required.');
                if (tag.name.length > 50) throw new Error('Tag name is too long (max 50 characters).');
            });
        }
        const contentSane = DOMPurify.sanitize(object.content, DOMPURIFY_CONFIG);
        const now = dateISO();
        let updatedObject = {
            ...object,
            name: object.name,
            content: contentSane,
            tags: extractTags(contentSane),
            updatedAt: now
        };

        if (!updatedObject.id)
            updatedObject.id = nanoid();

        if (!updatedObject.id || typeof updatedObject.id !== 'string')
            throw new Error('Invalid object ID.');

        if (!updatedObject.createdAt || isNaN(Date.parse(updatedObject.createdAt)))
            throw new Error('Invalid createdAt date.');

        if (!updatedObject.updatedAt || isNaN(Date.parse(updatedObject.updatedAt)))
            throw new Error('Invalid updatedAt date.');

        return updatedObject;
    }

    createNewObject(/* DEPRECATED parameter: creating a new object should not involve a particular view */ newNote) {
        return this.selected = {
            id: nanoid(),
            name: newNote?.name,
            content: newNote?.content,
            tags: [],
            createdAt: dateISO(),
            updatedAt: dateISO()
        };
    }

    async saveOrUpdateObject(object) {
        try {
            const updatedObject = this.prepareObjectForSaving(object);
            const savedObject = await this.db.save(updatedObject);
            this.hideEditor(); //???
            await this.renderList();
            this.notificationManager.showNotification("Object saved.", "success");
            this.selected = savedObject;
        } catch (error) {
            console.error("Error saving object:", error);
            this.errorHandler.handleError(error, `Error saving object: ${error.message}`);
        }
    }

}


document.addEventListener("DOMContentLoaded", async () => {
    await (window.app = new App()).init();
});
