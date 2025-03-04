import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NoteView} from '../ui/view.note.js';
import {createAppMock} from './test-utils.js';

describe('NoteView', () => {
    let noteView;
    let app;

    beforeEach(async () => {
        app = createAppMock();
        app.db.save = vi.fn().mockResolvedValue({});
        app.noteManager = {
            createNote: vi.fn().mockResolvedValue({id: 'test-id', name: 'Test Note', content: 'Test Content'}) // Mock createNote
        };
        noteView = new NoteView(app, app.db, app.nostr);
        document.body.innerHTML = ''; // Clear the body
        document.body.appendChild(noteView.el);
    });

    it('should create a new note', async () => {
        await noteView.createNote();
        expect(app.noteManager.createNote).toHaveBeenCalled();
    });
});
