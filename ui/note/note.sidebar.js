import {createElement} from '../utils.js';

export class NotesSidebar extends HTMLElement {
    constructor(app, noteView) {
        super();
        this.app = app;
        this.noteView = noteView;
        this.el = createElement('aside', {id: 'notes-sidebar', className: 'notes-sidebar'});
        this.elements = {}; // Store references to important elements
        this.build();
    }

    build() {
        this.el.innerHTML = ''; // Clear existing content

        // Create and append the "Notes" heading
        const notesHeading = createElement('h2', {}, 'Notes');
        this.el.appendChild(notesHeading);

        // Create and append the notes list
        this.elements.notesList = createElement('ul', {id: 'notes-list', className: 'notes-list'});
        this.el.appendChild(this.elements.notesList);

        // Create and append the "Add" button (but don't add it to the list yet)
        this.elements.addButton = this.newAddButton();

        // Append the sidebar to the main container
        this.el.appendChild(this.elements.addButton);
    }

    newAddButton() {
        const addButton = createElement('button', {}, 'Add Note');
        addButton.addEventListener('click', async () => {
            await this.noteView.createNote();
        });
        return addButton;
    }

    render() {
        return this.el;
    }
}

if (!customElements.get('notes-sidebar')) {
    customElements.define('notes-sidebar', NotesSidebar);
}
