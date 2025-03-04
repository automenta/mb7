export class NoteDetails {
    constructor(noteView, app) {
        this.noteView = noteView;
        this.app = app;
    }

    populateNoteDetails(note) {
        const titleInput = this.noteView.el.querySelector('.note-title-input');
        const privacyCheckbox = this.noteView.el.querySelector('#privacyCheckbox');
        const prioritySelect = this.noteView.el.querySelector('.note-priority-select');

        if (titleInput) {
            titleInput.value = note.name;
        }

        if (privacyCheckbox) {
            privacyCheckbox.checked = note.private;
        }

        if (prioritySelect) {
            prioritySelect.value = note.priority;
        }
    }

    async updateNotePrivacy(noteId, isPrivate) {
        try {
            const note = await this.app.db.get(noteId);
            if (note) {
                note.private = isPrivate;
                await this.app.db.saveObject(note, false);
                console.log(`Note ${noteId} privacy updated to ${isPrivate}`);
            } else {
                console.error(`Note ${noteId} not found`);
            }
        } catch (error) {
            console.error('Error updating note privacy:', error);
        }
    }

    async updateNotePriority(noteId, priority) {
        try {
            const note = await this.app.db.get(noteId);
            if (note) {
                note.priority = priority;
                await this.app.db.saveObject(note, false);
                console.log(`Note ${noteId} priority updated to ${priority}`);
            } else {
                console.error(`Note ${noteId} not found`);
            }
        } catch (error) {
            console.error('Error updating note priority:', error);
        }
    }
}
