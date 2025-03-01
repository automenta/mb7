import {UIComponent, View} from "./view.js";
import {renderNetworkStatus, renderNostrFeed} from "./content-view-renderer.js";

class ContentView extends View {
    constructor() {
        super();
        this.elements = {};
        this.el = document.createElement('div');
        this.el.id = 'content-view';
    }


    render() {
        this.build();
        this.bindEvents();
    }

    build() {
        this.el.innerHTML = `
            <h2>Content</h2>
            <input type="text" id="filter" placeholder="Filter" />
            <div id="object-list"></div>
            <div id="nostr-feed"></div>
            <div id="network-status"></div>
        `;
        this.elements.filter = this.el.querySelector('#filter');
        this.elements.objectList = this.el.querySelector('#object-list');

        renderNostrFeed(null, this.el);
        renderNetworkStatus(null, this.el);
    }

    bindEvents() {
    }
}

class MainContent extends UIComponent {
    constructor() {
        super();
        this.el = document.createElement('main');
        this.el.id = 'main-content';
        this.currentView = null;
    }

    showView(view) {
        this.el.innerHTML = '';
        this.el.append(view.el);
        this.currentView = view;
    }
}

export {ContentView, MainContent};