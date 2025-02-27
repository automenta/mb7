import {format, isValid as isValidDate, parseISO} from "date-fns";
import {UIComponent, View} from "./view.js";
import * as NostrTools from 'nostr-tools';

export const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), localStorage.getItem("dateFormat") || "Pp")
        : "";



export class ContentView extends View {
    constructor(app) {
        super(app, '<div id="content-view" class="view"><h2>Dashboard</h2><div class="dashboard-container"><div id="recent-feed" class="dashboard-column"><h3>Recent Activity</h3><div id="recent-activity"></div></div><div id="live-feed" class="dashboard-column"><h3>Live Feed</h3><div id="nostr-feed"></div></div></div><div id="object-list"></div></div>');
        this.elements = {
            objectList: this.el.querySelector("#object-list")
        };
    }
    build() {
        this.renderRecentActivity();
    }

    async renderRecentActivity() {
        const recent = await this.app.db.getRecent(5);
        const recentActivity = this.el.querySelector("#recent-activity");
        recentActivity.innerHTML = recent.map(obj => `<p><strong>${obj.name}</strong> - Updated: ${formatDate(obj.updatedAt)}</p>`).join('');
    }

    bindEvents() {
        this.el.addEventListener("click", (e) => {
            if (e.target.matches("button[data-view], button[data-list]")) {
                e.preventDefault();
                this.app.setView(e.target.dataset.view || "content");
            }
        });
    }

    async render() {
        await this.renderRecentActivity();
        this.displayPubkeyOnDashboard();
    }

    displayPubkeyOnDashboard() {
        const contentView = document.querySelector("#content-view");
        if (window.keys?.pub && contentView && !document.querySelector("#dashboard-view #pubkey-display")) {
            contentView.append(`<p id="pubkey-display">Your Public Key: ${NostrTools.nip19.npubEncode(window.keys.pub)}</p>`);
        }
    }


    renderTagCloud() {
        this.app.db.getAll().then(objects => {
            const tagCounts = {};
            objects.forEach(obj => obj.tags?.forEach(tag => tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1));
            const tagCloud = this.el.querySelector("#tag-cloud");
            tagCloud.innerHTML = Object.entries(tagCounts)
                .sort(([, countA], [, countB]) => countB - countA)
                .map(([tagName, count]) => `<span style="font-size:${10 + count * 2}px; margin-right:5px;">${tagName}</span>`).join('');
        });
    }
}

export class Menubar extends View {
    constructor(app) {
        super(app);
    }

    build() {
        this.el.innerHTML = '';
        this.el.className = 'menubar-top';
        this.buildSection("Menu", [{
            label: "Content",
            view: "content"
        }, {label: "New Object", view: "new_object"},
            {label: "Settings", view: "settings"}, {
                label: "Friends",
                view: "friends"
            }]).forEach(htmlString => this.el.append(document.createRange().createContextualFragment(htmlString)));
        //this.buildSection("Links", [{label: "Recent Items", list: "recent"}]),
        //this.buildSection("Network", [{
        //    label: '<span id="network-status" style="float: right;" id="network-status">Connecting...</span>',
        //    list: "network"
        //}]).forEach(htmlString => {
        //    const networkElement = document.createRange().createContextualFragment(htmlString).firstElementChild;
        //    this.el.append(networkElement);
        //});
        //this.el.append($(`<div id='nostr-feed'></div>`))
    }

    bindEvents() {
        this.el.addEventListener("click", (e) => {
            if (e.target.matches("button[data-view], button[data-list]")) {
                e.preventDefault();
                this.app.setView(e.target.dataset.view || "content");
            }
        });
    }

    buildSection(title, items) {
        
        const emojiMap = {
            "Content": "📄",
            "New Object": "✨",
            "Settings": "⚙️",
            "Friends": "👥",
            "Network": "🌐"
        };
        return [
            //`<h3>${title}</h3>`,
            `${items.map(item => `<button tabindex="0" title="${item.label}" ${item.view ? `data-view="${item.view}"` : `data-list="${item.list}"`}>${emojiMap[item.label] || ""}</button>`).join('')}`
        ];
    }

}

export class MainContent extends UIComponent {
    constructor() {
        super(`<div class="main-content"><div class="content"></div></div>`);
    }

    showView(view) {
        this.el.querySelector(".content").innerHTML = "";
        this.el.querySelector(".content").append(view.el);
    }
}
