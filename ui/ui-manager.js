import {UIComponent, View} from "./view.js";
import {renderNetworkStatus, renderNostrFeed} from "./content-view-renderer.js";

/**
 * Manages the main content area of the application.
 */
class ContentView extends View {
    constructor() {
        super();
        this.elements = {};
        this.el = document.createElement('div');
        this.el.id = 'content-view';
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


export {ContentView};