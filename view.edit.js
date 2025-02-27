import {View} from "./view.js";
import {Edit} from './edit.js';

export class EditView extends View {
    constructor(app) {
        super(app);
        this.edit = new Edit();
        this.el.innerHTML = `
            <div class="edit-view">
                <input type="text" id="object-name" placeholder="Object Name">
                <span id="created-at"></span>
                </div>
        `;
        this.el.append(this.edit.el);
        this.elements = {
            objectName: this.el.querySelector("#object-name"),
            createdAt: this.el.querySelector("#created-at")
        };
    }

    setContent(html) {
        this.edit.setContent(html);
    }

    getContent() {
        return this.edit.getContent();
    }
}