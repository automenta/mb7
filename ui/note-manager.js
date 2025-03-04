ui/note-manager.js
import { v4 as uuidv4 } from 'uuid';

export class NoteManager {
    constructor(app, db, errorHandler, matcher, nostr, notificationManager) {
        this.app = app;
        this.db = db;
        this.errorHandler = errorHandler;
        this.matcher = matcher;
        this.nostr = nostr;
        this.notificationManager = notificationManager;
    }

    async createNote(name = 'New Note') {
        const newNote = {
            id: uuidv4(),
            name: name,
            content: '',
            tags: [],
            isPersistentQuery: false,
            private: false
        };

        try {
            await this.saveObject(newNote);
            this.notificationManager.showNotification(`Note "${name}" created successfully`, 'success');
            return newNote;
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to create note "${name}"`, error);
            return null;
        }
    }


    async updateNote(id, updates) {
        try {
            const existingNote = await this.db.get(id);
            if (!existingNote) {
                throw new Error(`Note with ID ${id} not found`);
            }
            const updatedNote = { ...existingNote, ...updates };
            await this.saveObject(updatedNote);
            this.notificationManager.showNotification(`Note "${updatedNote.name}" updated successfully`, 'success');
            return updatedNote;
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to update note with ID ${id}`, error);
            return null;
        }
    }


    async deleteNote(id) {
        try {
            const existingNote = await this.db.get(id);
            if (!existingNote) {
                throw new Error(`Note with ID ${id} not found`);
            }
            await this.db.delete(id);
            this.notificationManager.showNotification(`Note "${existingNote.name}" deleted successfully`, 'success');
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to delete note with ID ${id}`, error);
        }
    }


    async getNote(id) {
        try {
            return await this.db.get(id);
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to get note with ID ${id}`, error);
            return null;
        }
    }

    async getAllNotes() {
        try {
            return await this.db.getAll();
        } catch (error) {
            this.errorHandler.handleError(error, "Failed to retrieve all notes", error);
            return [];
        }
    }


    async saveObject(object) {
        if (!object || !object.id) {
            this.errorHandler.handleError(new Error('Object must have an id'), 'Validation error saving object');
            return null;
        }

        this.prepareObjectForSaving(object);
        const newObject = {
            id: object.id,
            ...object
        };

        try {
            return await this.db.saveObject(newObject);
        } catch (error) {
            this.errorHandler.handleError(error, `Failed to save object with ID ${object.id}`, error);
            return null;
        }
    }


    prepareObjectForSaving(object) {
        if (object.content) {
            object.content = this.sanitizeContent(object.content);
        }
    }

    sanitizeContent(content) {
        if (typeof content !== 'string') return content;
        return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}
