import {GenericListComponent} from '../generic-list.js';
import {createElement} from '../utils.js';

export class MyObjectsList {
    constructor(noteView, yMyObjectsList) {
        this.noteView = noteView;
        this.yMyObjectsList = yMyObjectsList;
        this.myObjectsListComponent = new GenericListComponent(this, this.yMyObjectsList);
    }

    renderListItem(objectId) { // Renamed from renderMyObjectItem to renderListItem
        // The renderListItem function in ui/note/my-objects-list.js should now return only the content of the list item, not the <li> element itself.
        const listItemContent = document.createTextNode(objectId); // Create text node for objectId
        return listItemContent; // Return only the content of the list item
    }

    render() {
        const myObjectsArea = this.noteView.noteUI.createMyObjectsArea();
        myObjectsArea.appendChild(this.myObjectsListComponent.el);

        const createObjectButton = createElement('button', {}, 'Create New Object');
        myObjectsArea.appendChild(createObjectButton);

        return myObjectsArea;
    }
}
