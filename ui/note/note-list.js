ui/note/note-list.js
import { GenericListComponent } from '../generic-list.component.js';
import { NoteListItemRenderer } from './note-list-item-renderer.js';

export class NoteListComponent {
    constructor(noteView, yNotesList, app) {
        this.noteView = noteView;
        this.yNotesList = yNotesList;
        this.app = app;
        this.renderer = new NoteListItemRenderer(this, this.app);
        this.genericListComponent = new GenericListComponent(this.renderer, this.yNotesList);
    }


    async loadNotes() {
        try {
            const notes = await this.app.db.getAll();
            this.yDoc.transact(() => {
                this.yNotesList.deleteRange(0, this.yNotesList.length);
                notes.forEach(note => {
                    this.yNotesList.push([note.id]);
                });
            });
            this.app.notificationManager.showNotification('Notes loaded', 'success');
        } catch (error) {
            console.error('Error loading notes:', error);
            this.app.notificationManager.showNotification('Failed to load notes', 'error');
        }
    }


    async handleDeleteNote(note) {
        try {
            if (note) {
                await this.app.db.delete(note.id);
                this.yDoc.transact(() => {
                    const index = this.yNotesList.toArray().findIndex(item => item[0] === note.id);
                    if (index !== -1) {
                        this.yNotesList.delete(index);
                    }
                });
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            this.app.notificationManager.showNotification('Failed to delete note', 'error');
        }
    }


    render() {
        return this.genericListComponent.render();
    }
}
