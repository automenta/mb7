ui/edit/edit.toolbar.js
import { createElement } from '../utils.js';

export class EditToolbar {
    constructor(edit) {
        this.edit = edit;
        this.el = createElement('div', {className: 'edit-toolbar'});
        this.build();
    }

    build() {
        const createGroup = () => createElement("div", {class: "group"});
        const createButton = (title, text, command, arg = null) =>
            createElement("button", {title, onclick: () => document.execCommand(command, false, arg)});

        const formattingGroup = createGroup();
        formattingGroup.append(
            createButton("Bold (Ctrl+B)", "<b>💪</b>", "bold"),
            createButton("Italic (Ctrl+I)", "<i>✍️</i>", "italic"),
            createButton("Underline (Ctrl+U)", "<u>⬇️</u>", "underline"),
        );
        this.el.append(formattingGroup);
    }

    render() {
        return this.el;
    }
}
