export class NoteList {
    constructor(app, noteView, yDoc, yNotesList) {
        this.app = app;
        this.noteView = noteView;
        this.yDoc = yDoc;
        this.yNotesList = yNotesList;
        this.loadNotes(); // Load notes on initialization
    }

    async loadNotes() {
        try {
            const notes = await this.app.db.getAll();
            this.yDoc.transact(() => {
                this.yNotesList.deleteRange(0, this.yNotesList.length); // Clear existing notes
                notes.forEach(note => {
                    this.yNotesList.push([note.id]); // Add note IDs to the Yjs array
                });
            });
            this.app.notificationManager.showNotification('Notes loaded', 'success');
        } catch (error) {
            console.error('Error loading notes:', error);
            this.app.notificationManager.showNotification('Error loading notes', 'error');
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
                this.app.notificationManager.showNotification('Deleted', 'success');
            }
        } catch (error) {
            console.error('Error deleting note:', error);
            this.app.notificationManager.showNotification('Error deleting note', 'error');
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
