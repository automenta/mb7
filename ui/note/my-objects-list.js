import {GenericListComponent} from '../generic-list.js';
import {createElement} from '../utils.js';

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
                console.warn(`Object with ID ${objectId} not found.`);
                this.app.notificationManager.showNotification(`Object with ID ${objectId} not found.`, 'warning');
                return document.createTextNode(`Object ID: ${objectId.substring(0, 8)}... (Not Found)`);
            }
            const objectName = object.name || `Object ID: ${objectId.substring(0, 8)}...`;
            return document.createTextNode(objectName);
        } catch (error) {
            console.error("Error fetching object:", error);
            this.app.notificationManager.showNotification(`Error fetching object with ID ${objectId}: ${error.message}`, 'error');
            return document.createTextNode(`Object ID: ${objectId.substring(0, 8)}... (Error)`);
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
