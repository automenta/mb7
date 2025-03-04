ui/note/note.sidebar.js
import { createElement } from '../utils.js';
import { CreateNoteButton } from './note.create.js';

export class NotesSidebar extends HTMLElement {
    constructor(app, noteView) {
        super();
        this.app = app;
        this.noteView = noteView;
        this.el = createElement('aside', {id: 'notes-sidebar', className: 'notes-sidebar'});
        this.elements = {};
        this.build();
    }

    build() {
        this.elements.header = this.createHeader();
        this.elements.noteList = this.createNoteList();
        this.elements.createNoteButton = new CreateNoteButton(this.app, this.noteView);

        this.el.append(this.elements.header);
        this.el.append(this.elements.createNoteButton.render());
        this.el.append(this.elements.noteList);
    }


    createHeader() {
        return createElement('header', {}, 'Notes');
    }

    createNoteList() {
        this.noteList = createElement('ul', {id: 'note-list'});
        return this.noteList;
    }


    renderNoteList(notes) {
        this.noteList.innerHTML = '';
        notes.forEach(note => {
            const noteItem = createElement('li', {class: 'note-item'}, note.name);
            noteItem.addEventListener('click', () => {
                this.noteView.handleNoteSelect(note.id);
            });
            this.noteList.appendChild(noteItem);
        });
    }


    render() {
        return this.el;
    }
}

customElements.define('notes-sidebar', NotesSidebar);
