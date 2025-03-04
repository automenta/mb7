import {UIComponent} from './view.js';

export class GenericListComponent extends UIComponent {
    constructor(renderer, yArray) {
        super('<ul></ul>'); // Use a ul as the base template
        this.renderer = renderer;
        this.yArray = yArray;
        this.listElement = this.el; // Get the ul element

        this.renderList = this.renderList.bind(this);

        // Observe Yjs array changes
        if (this.yArray) {
            this.yArray.observe(() => {
                this.renderList();
            });
        }

        this.renderList();
    }

    renderList() {
        this.listElement.innerHTML = ''; // Clear existing list
        const data = this.yArray.toArray();
        if (data.length === 0) {
            this.listElement.textContent = 'No items yet.';
        } else {
            data.forEach(item => { // item is noteId
                const listItemContent = this.renderer.renderListItem(item); // Use the renderer.renderListItem function to get the content
                const listItem = document.createElement('li'); // Create the <li> element
                listItem.appendChild(listItemContent); // Append the content to the <li> element
                this.listElement.appendChild(listItem); // Append the <li> element to the list
            });
        }
    }
}
