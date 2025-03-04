export class NoteList {
    constructor(app, noteView, yDoc, yNotesList) {
        this.app = app;
        this.noteView = noteView;
        this.yDoc = yDoc;
        this.yNotesList = yNotesList;
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
                await this.notesListComponent.fetchDataAndRender();
                this.app.notificationManager.showNotification('Deleted', 'success');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
        }
    }

    async addNoteToList(noteId) {
        console.log('yDoc in addNoteToList:', this.yDoc);
        console.log('yNotesList in addNoteToList:', this.yNotesList);
        try {
            this.yDoc.transact(() => {
                this.yNotesList.push([noteId]);
            });
        } catch (error) {
            console.error("Yjs error:", error);
        }
    }
}
