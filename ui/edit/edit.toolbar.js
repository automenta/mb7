class Toolbar {
    constructor(editor) {
        this.editor = editor;
        this.el = createElement("div", {id: "toolbar"});
        this.build();
    }

    build() {
        const createGroup = () => createElement("div", {class: "group"});
        const createButton = (title, text, command, arg = null) =>
            createElement("button", {title, onclick: () => document.execCommand(command, false, arg)}, text);

        const formattingGroup = createGroup();
        formattingGroup.append(
            createButton("Bold (Ctrl+B)", "<b>💪</b>", "bold"),
            createButton("Italic (Ctrl+I)", "<i>✍️</i>", "italic"),
            createButton("Underline (Ctrl+U)", "<u>⬇️</u>", "underline"),
            createButton("Strike Through", "<del>🚫</del>", "strikeThrough"),
            createButton("Clear Formatting", "🧹", "removeFormat")
        );

        const undoRedoGroup = createGroup();
        undoRedoGroup.append(
            createButton("Undo (Ctrl+Z)", "↩️", "undo"),
            createButton("Redo (Ctrl+Y)", "↪️", "redo")
        );

        this.el.append(formattingGroup, undoRedoGroup);
    }

    getElement() {
        return this.el;
    }
}

import {createElement} from '../utils.js';

export {Toolbar};