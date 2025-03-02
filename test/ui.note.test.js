import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NoteView } from '../ui/view.note.js';
import { createAppMock } from './test-utils.js';




vi.mock('../core/db.js', () => {
  return {
    DB: class {
      constructor() {
        this.get = vi.fn().mockResolvedValue({});
        this.save = vi.fn().mockResolvedValue({});
        this.delete = vi.fn().mockResolvedValue({});
        this.getAll = vi.fn().mockResolvedValue([]);
        this.initializeKeys = vi.fn().mockResolvedValue({});
        this.generateKeys = vi.fn().mockResolvedValue({});
        this.getSettings = vi.fn().mockResolvedValue({});
        this.the = vi.fn().mockResolvedValue(this);
        this.getDefaultObject = vi.fn().mockResolvedValue({});
        this.initializeKeys = vi.fn().mockResolvedValue({});
        this.generateKeys = vi.fn().mockResolvedValue({});
        this.getSettings = vi.fn().mockResolvedValue({});
        this.save = vi.fn().mockResolvedValue({});
      }
      static the() {
        return Promise.resolve(this);
      }
    },
  };
});

describe('NoteView', () => {
    let noteView;
    let app;

    beforeEach(async () => {
        vi.resetModules();
        // Delete the database before each test
        const {App} = await import('../ui/app.js');
        app = createAppMock();
        app.saveOrUpdateObject = vi.fn().mockResolvedValue({});
        noteView = new NoteView(app);
        document.body.innerHTML = ''; // Clear the body
        document.body.appendChild(noteView.el);
    });

    it('should create a new note', async () => {
        const newNote = {name: 'Test Note', content: 'Test Content'};
        await noteView.createNote();

        console.log('createNote called');
        expect(app.db.save).toHaveBeenCalled();
    });
});