import {GenericListComponent} from '../generic-list.js';
import {createElement} from '../utils.js';

export class MyObjectsList {
    constructor(noteView, yMyObjectsList) {
        this.noteView = noteView;
        this.yMyObjectsList = yMyObjectsList;
        this.myObjectsListComponent = new GenericListComponent(this, this.yMyObjectsList);
    }

    renderListItem(objectId) {
        const li = document.createElement('li');
        li.textContent = objectId;
        return li;
    }

    render() {
        const myObjectsArea = this.noteView.noteUI.createMyObjectsArea();
        myObjectsArea.appendChild(this.myObjectsListComponent.el);

        const createObjectButton = createElement('button', {}, 'Create New Object');
        myObjectsArea.appendChild(createObjectButton);

        return myObjectsArea;
    }
}
