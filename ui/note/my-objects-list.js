ui/note/my-objects-list.js
import { GenericListComponent } from '../generic-list.component.js';
import { createElement } from '../utils.js';

export class MyObjectsList {
    constructor(noteView, yMyObjectsList, app) {
        this.noteView = noteView;
        this.yMyObjectsList = yMyObjectsList;
        this.app = app;
        this.myObjectsListComponent = new GenericListComponent(this, this.yMyObjectsList);
    }

    async renderListItem(objectId) {
        try {
            const object = await this.app.db.get(objectId);
            if (!object) {
                return 'Object not found';
            }
            return object.name || object.id;
        } catch (error) {
            console.error('Error rendering list item:', error);
            return 'Error loading item';
        }
    }


    render() {
        const myObjectsArea = this.noteView.noteUI.createMyObjectsArea();
        myObjectsArea.appendChild(this.myObjectsListComponent.el);

        const createObjectButton = createElement('button', {}, 'Create New Object');
        myObjectsArea.appendChild(createObjectButton);

        return myObjectsArea;
    }
}
