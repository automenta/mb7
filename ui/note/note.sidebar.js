import {NotesToolbar} from './note.toolbar.js';

export class NotesSidebar extends HTMLElement {
    constructor(app, notesView) {
        super();
        this.app = app;
        this.notesView = notesView;

        this.el = document.createElement('div');
        this.el.classList.add('notes-sidebar');

        const toolbar = new NotesToolbar();
        const addButton = document.createElement('button');
        addButton.textContent = 'Add Note';
        addButton.addEventListener('click', () => {
            this.notesView.createNote({name: 'New Note', content: ''});
        });
        this.el.appendChild(addButton);


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