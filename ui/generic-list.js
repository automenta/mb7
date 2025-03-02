import { UIComponent } from './view.js';

export class GenericListComponent extends UIComponent {
    constructor(renderItem, yArray) {
        super('<ul></ul>'); // Use a ul as the base template
        this.renderItem = renderItem;
        this.yArray = yArray;
        this.listElement = this.el.querySelector('ul'); // Get the ul element

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
                const listItem = document.createElement('li');
                listItem.appendChild(this.renderItem(item)); // Pass only item (noteId)
                this.listElement.appendChild(listItem);
            });
        }
    }

    async fetchDataAndRender() {
        await this.fetchData();
        this.renderList();
    }

    async fetchData() {
        // Placeholder for fetching data if needed
        return [];
    }
}