import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteView } from '../ui/view.note.js';

import { vi } from 'vitest';



vi.mock('../core/db.js', () => {
  const db = {
    get: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
  class MockDB {
    constructor() {
      this.the = vi.fn().mockResolvedValue(db);
      this.getDefaultObject = vi.fn().mockResolvedValue({});
    }
    static the() { return Promise.resolve(db) }
    static getDefaultObject() { return Promise.resolve({}) }
    initializeKeys = vi.fn().mockResolvedValue({});
    generateKeys = vi.fn().mockResolvedValue({});
    getSettings = vi.fn().mockResolvedValue({}); // Mock getSettings
  }
  return {
    DB: MockDB,
    loadKeys: vi.fn().mockResolvedValue({}),
    generateKeys: vi.fn().mockResolvedValue({}),
  };
});

describe('NoteView', () => {
    let noteView;
    let app;

    beforeEach(async () => {
        vi.resetModules();
        // Delete the database before each test
        const {App} = await import('../ui/app.js');
        app = new App();
        
        app.saveOrUpdateObject = vi.fn();
        await app.initialize();
        noteView = new NoteView(app);
        document.body.innerHTML = ''; // Clear the body
        document.body.appendChild(noteView.el);
        console.log('NotesView initialized and appended to body');
    });

    it('should create a new note', async () => {
        const newNote = {name: 'Test Note', content: 'Test Content'};
        await noteView.createNote(newNote);

        console.log('createNote called');
        expect(app.saveOrUpdateObject).toHaveBeenCalled();
    });
});