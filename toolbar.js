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
            createButton("Bold (Ctrl+B)", "B", "bold"),
            createButton("Italic (Ctrl+I)", "I", "italic"),
            createButton("Underline (Ctrl+U)", "U", "underline"),
            createButton("Strike Through", "S", "strikeThrough"),
            createButton("Clear Formatting", "Unformat", "removeFormat")
        );

        const undoRedoGroup = createGroup();
        undoRedoGroup.append(
            createButton("Undo (Ctrl+Z)", "Undo", "undo"),
            createButton("Redo (Ctrl+Y)", "Redo", "redo")
        );

        this.el.append(formattingGroup, undoRedoGroup);
    }

    getElement() {
        return this.el;
    }
}

import { createElement } from './utils.js';

export {Toolbar};