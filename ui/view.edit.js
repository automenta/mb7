import {View} from "./view.js";
import {Edit} from './edit.js';

export class EditView extends View {
    constructor(app) {
        super(app);
        this.app = app;
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
        this.objectName = this.el.querySelector(".object-name");
        this.createdAt = this.el.querySelector(".created-at");
        this.saveButton = this.el.querySelector(".save-button");
        this.deleteButton = this.el.querySelector(".delete-button");

        this.saveButton.addEventListener('click', () => {
            this.saveOrUpdateObject();
        });
        this.deleteButton.addEventListener('click', () => {
            this.deleteCurrentObject();
        });
    }

    async saveOrUpdateObject() {
        const objectName = this.objectName.value;
        const content = this.getContent();
        await this.app.saveOrUpdateObject({id: this.app.selected?.id, name: objectName, content: content});
    }

    async deleteCurrentObject() {
        await this.app.db.deleteCurrentObject(this.app.selected);
    }


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