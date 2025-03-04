import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NoteView} from '../ui/view.note.js';
import {createAppMock} from './test-utils.js';

describe('NoteView', () => {
    let noteView;
    let app;

    beforeEach(async () => {
        vi.resetModules();
        app = createAppMock();
        app.db.save = vi.fn().mockResolvedValue({});
        noteView = new NoteView(app, app.db, app.nostr);
        document.body.innerHTML = ''; // Clear the body
        document.body.appendChild(noteView.el);
    });

    it('should create a new note', async () => {
        const newNote = {name: 'Test Note', content: 'Test Content'};
        app.noteManager = {
            createNote: vi.fn().mockResolvedValue({id: 'test-id'})
        };
        await noteView.createNote();
        expect(app.db.save).toHaveBeenCalled();
    });
});
