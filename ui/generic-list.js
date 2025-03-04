import { UIComponent } from './component.js';

export class GenericListComponent extends UIComponent {
    constructor(renderer, yArray) {
        super('<ul></ul>');
        this.renderer = renderer;
        this.yArray = yArray;
        this.listElement = this.el;

        this.renderList = this.renderList.bind(this);
        this.createListItem = this.createListItem.bind(this);

        this.yArray.observe(this.renderList);
        this.renderList();
    }

    renderList() {
        this.listElement.innerHTML = '';
        this.yArray.forEach(yMap => {
            const listItem = this.createListItem(yMap);
            this.listElement.appendChild(listItem);
        });
    }

    createListItem(yMap) {
        const listItem = document.createElement('li');
        listItem.className = 'list-item';
        const renderedItem = this.renderer.render(yMap);
        listItem.appendChild(renderedItem);
        return listItem;
    }

    render() {
        return this.el;
    }
}
