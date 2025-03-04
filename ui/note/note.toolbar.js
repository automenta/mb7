ui/note/note.toolbar.js
import { createElement } from '../utils.js';

export class NoteToolbar {
    constructor(noteView) {
        this.noteView = noteView;
        this.el = createElement('div', {className: 'note-toolbar'});
        this.elements = {};
        this.build();
    }

    build() {
        this.elements.deleteButton = this.createDeleteButton();

        this.el.append(this.elements.deleteButton);
    }


    createDeleteButton() {
        const deleteButton = createElement('button', {className: 'delete-note-button'}, 'Delete Note');
        deleteButton.addEventListener('click', () => {
            this.noteView.handleDeleteNote();
        });
        return deleteButton;
    }


    render() {
        return this.el;
    }
}
