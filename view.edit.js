import { View } from "./view.js";
import { Edit } from './edit.js';

export class EditView extends View {
    constructor(app) {
        super(app);
        this.edit = new Edit();    
        this.$el.append(this.edit.$el);
    }

    build() {
        // this.$el.find("#editor").html("<h1>New Object</h1>");
    }

    setContent(html) {
        this.edit.setContent(html);
    }

    getContent() {
        return this.edit.getContent();
    }
}