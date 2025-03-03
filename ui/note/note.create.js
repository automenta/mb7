import { createElement } from '../utils';

export class CreateNoteButton {
    constructor(app, noteView) {
        this.app = app;
        this.noteView = noteView;
        this.el = createElement('button', { className: 'create-note-button' }, 'Create Note');
        this.el.addEventListener('click', () => this.handleClick());
    }

    handleClick() {
        this.app.createNote().then(() => {
            this.noteView.loadNotes();
        });
    }

    render() {
        return this.el;
    }
}
