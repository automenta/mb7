import {View} from "./view.js";
import {renderNetworkStatus, renderNostrFeed} from "./content-view-renderer.js";

/**
 * Manages the main content area of the application.
 */
class ContentView extends View {
    constructor(app) {
        super();
        this.app = app;
        this.elements = {};
        this.el = document.createElement('div');
        this.el.id = 'content-view';
    }

    build() {
        const heading = document.createElement('h2');
        heading.textContent = 'Content';

        const filterInput = document.createElement('input');
        filterInput.type = 'text';
        filterInput.id = 'filter';
        filterInput.placeholder = 'Filter';

        const objectListDiv = document.createElement('div');
        objectListDiv.id = 'object-list';

        const nostrFeedDiv = document.createElement('div');
        nostrFeedDiv.id = 'nostr-feed';

        const networkStatusDiv = document.createElement('div');
        networkStatusDiv.id = 'network-status';

        this.el.appendChild(heading);
        this.el.appendChild(filterInput);
        this.el.appendChild(objectListDiv);
        this.el.appendChild(nostrFeedDiv);
        this.el.appendChild(networkStatusDiv);

        this.elements.filter = filterInput;
        this.elements.objectList = objectListDiv;

        renderNostrFeed(this.app, this.el);
        renderNetworkStatus(this.app, this.el);

        this.elements.filter.addEventListener('input', () => {
            // TODO: Implement filtering logic
            console.log('Filtering...');
        });
    }
}


export {ContentView};