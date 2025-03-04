import {UIComponent} from './view.js';

export class GenericListComponent extends UIComponent {
    constructor(renderer, yArray) {
        super('<ul></ul>');
        this.renderer = renderer;
        this.yArray = yArray;
        this.listElement = this.el;

        this.renderList = this.renderList.bind(this);
        this.createListItem = this.createListItem.bind(this);

        if (this.yArray) {
            this.yArray.observe(() => {
                this.renderList();
            });
        }

        this.renderList();
    }

    renderList() {
        this.listElement.innerHTML = '';
        const data = this.yArray.toArray();
        if (data.length === 0) {
            // No default "No items yet." text.
        } else {
            data.forEach(item => {
                const listItem = this.createListItem(item);
                this.listElement.appendChild(listItem);
            });
        }
    }

    createListItem(item) {
        const listItem = document.createElement('li');
        const listItemContent = this.renderer.renderListItem(item);
        listItem.appendChild(listItemContent);
        return listItem;
    }
}
