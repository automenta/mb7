import $ from 'jquery';
import _ from 'lodash';
import {format, isValid as isValidDate, parseISO} from "date-fns";
import {UIComponent, View} from "./view.js";
import {Edit} from './edit.js';

export const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), localStorage.getItem("dateFormat") || "Pp")
        : "";


export class ContentView extends View {
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
        this.editor = new Edit();
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

export class DashboardView extends View {
    constructor(app) {
        super(app, `<div id="dashboard-view" class="view"><h2>Dashboard</h2></div>`);
    }

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
        this.displayPubkeyOnDashboard();
    }

    displayPubkeyOnDashboard() {
        if (window.keys?.pub && !$("#dashboard-view #pubkey-display").length) {
            $("#dashboard-view").append(`<p id="pubkey-display">Your Public Key: ${NostrTools.nip19.npubEncode(window.keys.pub)}</p>`);
        }
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

export class Sidebar extends View {
    constructor(app) {
        super(app, `<div class="sidebar-left"></div>`);
    }

    build() {
        this.$el.append(
            this.buildSection("Menu", [{label: "Dashboard", view: "dashboard"}, {
                label: "Content",
                view: "content"
            }, {label: "Settings", view: "settings"}, {label: "Friends", view: "friends"}]),
            this.buildSection("Links", [{label: "Recent Items", list: "recent"}]),
            this.buildSection("Network", [{
                label: `<div id="network-status">Connecting...</div><hr>`,
                list: "network"
            }]),
            $(`<div id='nostr-feed'></div>`)
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

export class MainContent extends UIComponent {
    constructor() {
        super(`<div class="main-content"><div class="content"></div></div>`);
    }

    showView(view) {
        this.$el.find(".content").empty().append(view.$el);
    }
}
