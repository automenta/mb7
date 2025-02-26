import $ from 'jquery';
import { View } from "./view.js";
import { Edit } from './edit.js';

export class EditView extends View {
    constructor(app) {
            super(app, '<div id="editor-container" class="view" style="border: 1px solid #ccc; padding: 10px;"><div id="toolbar"></div><div id="editor" contenteditable="true" style="min-height: 200px; border: 1px solid #eee;"></div></div>');
            const toolbar = this.$el.find("#toolbar");
            this.edit = new Edit(toolbar);
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