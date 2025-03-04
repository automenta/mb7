import { GenericListComponent } from '../generic-list.js';
import { NoteListItemRenderer } from './note-list-item-renderer.js';

export class NoteListComponent {
    constructor(noteView, yNotesList, app) {
        this.noteView = noteView;
        this.yNotesList = yNotesList;
        this.app = app;
        this.renderer = new NoteListItemRenderer(this, this.app);
        this.genericListComponent = new GenericListComponent(this.renderer, this.yNotesList);
    }


    render() {
        return this.genericListComponent.render();
    }
}
