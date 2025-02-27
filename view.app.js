import {UIComponent, View} from "./view.js";
import * as NostrTools from 'nostr-tools';
import {emojiMap} from "./menu-config.js";
import {renderRecentActivity, renderTagCloud} from "./content-view-renderer.js";


export class ContentView extends View {
    constructor(app) {
        super(app, '<div id="content-view" class="view"><h2>Dashboard</h2><div class="dashboard-container"><div id="recent-feed" class="dashboard-column"><h3>Recent Activity</h3><div id="recent-activity"></div></div><div id="live-feed" class="dashboard-column"><h3>Live Feed</h3><div id="nostr-feed"></div></div></div><div id="object-list"></div></div>');
        this.elements = {
            objectList: this.el.querySelector("#object-list")
        };
    }

    build() {
        renderRecentActivity(this.app, this.el);
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
        await renderRecentActivity(this.app, this.el);
        this.displayPubkeyOnDashboard();
    }

    displayPubkeyOnDashboard() {
        const contentView = document.querySelector("#content-view");
        if (window.keys?.pub && contentView && !document.querySelector("#pubkey-display")) {
            contentView.append(`<p id="pubkey-display">Your Public Key: ${NostrTools.nip19.npubEncode(window.keys.pub)}</p>`);
        }
    }


    renderTagCloud() {
        renderTagCloud(this.app, this.el);
    }
}

export class Menubar extends View {
    constructor(app) {
        super(app);
    }

    build() {
        this.el.innerHTML = '';
        this.el.className = 'menubar-top';
        this.buildSection("Menu", [
            {label: "Content", view: "content"},
            //{label: "Network", view: "network"},
            {label: "Settings", view: "settings"},
            {label: "Friends", view: "friends"},
            {label: "Notes", view: "notes"}
        ]).forEach(button => this.el.append(button));
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
        return items.map(item => {
            const button = document.createElement('button');
            button.tabIndex = 0;
            button.title = item.label;
            if (item.view) {
                button.dataset.view = item.view;
            } else if (item.list) {
                button.dataset.list = item.list;
            }
            button.textContent = emojiMap[item.label] || "";
            return button;
        });
    }

}

export class MainContent extends UIComponent {
    constructor() {
        super(`<div class="main-content"><div class="content"></div></div>`);
    }

    showView(view) {
        const s = this.el.querySelector(".content");
        s.innerHTML = "";
        s.append(view.el);
    }
}
