import { NotesToolbar } from './note.toolbar.js';

export class NotesSidebar extends HTMLElement {
    constructor(app) {
        super();
        this.app = app;

        this.el = document.createElement('div');
        this.el.classList.add('notes-sidebar');

        const toolbar = new NotesToolbar();
        this.el.appendChild(toolbar.render());

        this.notesList = document.createElement('ul');
        this.notesList.className = 'notes-list';
        this.el.appendChild(this.notesList);

        this.elements = {
            notesList: this.notesList
        };
    }

    render() {
        return this.el;
    }
}

if (!customElements.get('notes-sidebar')) {
    customElements.define('notes-sidebar', NotesSidebar);
}