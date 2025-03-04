ui/note/note.create.js
import { createElement } from '../utils.js';

export class CreateNoteButton {
    constructor(app, noteView) {
        this.app = app;
        this.noteView = noteView;
        this.el = createElement('button', {className: 'create-note-button'}, 'Create Note');
        this.el.addEventListener('click', () => this.handleClick());
    }

    handleClick() {
        this.app.createNote().then(() => {
            this.noteView.renderNotesList();
        });
    }

    render() {
        return this.el;
    }
}
