import $ from 'jquery';
import _ from 'lodash';
import {format, isValid as isValidDate, parseISO} from "date-fns";
import {UIComponent, View} from "./view.js";
import {Edit} from './edit.js';
import * as NostrTools from 'nostr-tools';

export const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), localStorage.getItem("dateFormat") || "Pp")
        : "";


export class ContentView extends View {
    constructor(app) {
        super(app, '<div id="content-view" class="view"><h2>Dashboard</h2><div class="dashboard-container"><div id="recent-feed" class="dashboard-column"><h3>Recent Activity</h3><div id="recent-activity"></div></div><div id="live-feed" class="dashboard-column"><h3>Live Feed</h3><div id="nostr-feed"></div></div></div></div>');
    }

    build() {
        this.renderRecentActivity();
    }

    async renderRecentActivity() {
        const recent = await this.app.db.getRecent(5);
        this.$el.find("#recent-activity").html(recent.map(obj => `<p><strong>${obj.name}</strong> - Updated: ${formatDate(obj.updatedAt)}</p>`).join(''));
    }

    bindEvents() {
        this.$el.on("click", "button[data-view], button[data-list]", (e) => {
            e.preventDefault();
            this.app.setView($(e.currentTarget).data("view") || "content");
        });
    }

    async render() {
        // const selectedView = this.$el.find("#content-view-select").val();
        // this.$el.find("#object-list, #dashboard-stats, #recent-activity, #tag-cloud").hide();

        // if (selectedView === "objects") {
        //     this.$el.find("#object-list").show();
        //     this.app.renderList();
        // } else if(selectedView === "recent") {
        //     const stats = await this.app.db.getStats();
        //     this.$el.find("#dashboard-stats").html(`<p>Objects: ${stats.objectCount}</p><p>Tags: ${stats.tagCount}</p>`).show();
        //     const recent = await this.app.db.getRecent(5);
        //     this.$el.find("#recent-activity").html(recent.map(obj => `<p><strong>${obj.name}</strong> - Updated: ${formatDate(obj.updatedAt)}</p>`).join('')).show();
        // } else if (selectedView === "tagcloud") {
        //     this.renderTagCloud();
        //     this.$el.find("#tag-cloud").show();
        // } else if (selectedView === "friends") {
        //     this.$el.find("#recent-activity").html("<p>Friends activity will be here</p>").show();
        // }
        this.renderRecentActivity();
        this.displayPubkeyOnDashboard();
    }

    displayPubkeyOnDashboard() {
        if (window.keys?.pub && !$("#dashboard-view #pubkey-display").length) {
            $("#content-view").append(`<p id="pubkey-display">Your Public Key: ${NostrTools.nip19.npubEncode(window.keys.pub)}</p>`);
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

export class Menubar extends View {
    constructor(app) {
        super(app, `<div class="menubar-top" role="navigation" aria-label="Main menu"></div>`);
    }

    build() {
        this.$el.append(
            this.buildSection("Menu", [ {
                label: "Content",
                view: "content"
            }, {label: "New Object", view: "new_object"},
            {label: "Settings", view: "settings"}, {label: "Friends", view: "friends"}]),
            //this.buildSection("Links", [{label: "Recent Items", list: "recent"}]),
            this.buildSection("Network", [{
                label: '<span id="network-status" style="float: right;">Connecting...</span>',
                list: "network"
            }]),
            //$(`<div id='nostr-feed'></div>`)
        );
    }

    bindEvents() {
        this.$el.on("click", "button[data-view], button[data-list]", (e) => {
            e.preventDefault();
            this.app.setView($(e.currentTarget).data("view") || "content");
        });
    }

    buildSection(title, items) {
        const buttonStyle = "border: none; background: transparent; color: #ddd; padding: 0.5em; cursor: pointer; font-size: 1.5em;";
        const emojiMap = {
            "Content": "📄",
            "New Object": "✨",
            "Settings": "⚙️",
            "Friends": "👥",
            "Network": "🌐"
        };
        return [
            //`<h3>${title}</h3>`,
            `${items.map(item => `<button tabindex="0" title="${item.label}" style="${buttonStyle}" ${item.view ? `data-view="${item.view}"` : `data-list="${item.list}"`}>${emojiMap[item.label] || ""}</button>`).join('')}<hr>`
        ];
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
