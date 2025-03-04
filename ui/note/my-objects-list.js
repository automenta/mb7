import {GenericListComponent} from '../generic-list.js';
import {createElement} from '../utils.js';

export class MyObjectsList {
    constructor(noteView, yMyObjectsList, app) { // Added app to constructor
        this.noteView = noteView;
        this.yMyObjectsList = yMyObjectsList;
        this.app = app; // Store the app instance
        this.myObjectsListComponent = new GenericListComponent(this, this.yMyObjectsList);
    }

    async renderListItem(objectId) { // Renamed from renderMyObjectItem to renderListItem
        try {
            const object = await this.app.db.get(objectId); // Fetch object from DB
            if (!object) {
                console.warn(`Object with ID ${objectId} not found.`);
                return document.createTextNode(`Object ID: ${objectId.substring(0, 8)}... (Not Found)`); // Indicate if not found
            }
            const objectName = object.name || `Object ID: ${objectId.substring(0, 8)}...`; // Use object name or fallback to ID
            return document.createTextNode(objectName); // Display object name
        } catch (error) {
            console.error("Error fetching object:", error);
            return document.createTextNode(`Object ID: ${objectId.substring(0, 8)}... (Error)`); // Indicate error
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
