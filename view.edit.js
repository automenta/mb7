import {View} from "./view.js";
import {Edit} from './edit.js';

export class EditView extends View {
    constructor(app) {
        super(app);
        this.edit = new Edit();
        this.el.innerHTML = `
            <div class="edit-view">
                <input type="text" class="object-name" placeholder="Object Name">
                <span class="created-at"></span>
                </div>
            <button class="save-button">Save</button>
            <button class="delete-button">Delete</button>
        `;
        this.el.append(this.edit.el);
        this.elements = {
            objectName: this.el.querySelector(".object-name"),
            createdAt: this.el.querySelector(".created-at"),
            saveButton: this.el.querySelector(".save-button"),
            deleteButton: this.el.querySelector(".delete-button")
        };
        this.elements.saveButton.addEventListener('click', () => {
            const objectName = this.elements.objectName.value;
            const content = this.getContent();
            this.app.saveOrUpdateObject({id: this.app.selected?.id, name: objectName, content: content});
        });
        this.elements.deleteButton.addEventListener('click', () => {
            this.app.deleteCurrentObject(this.app.selected);
        });
    }

    /*
        delete button
    */


    setContent(html) {
        this.edit.setContent(html);
    }

    getContent() {
        return this.edit.getContent();
    }

    render() {
        return this.el;
    }
}