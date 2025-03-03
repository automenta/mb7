import {beforeEach, describe, expect, it, vi} from 'vitest';
import {NoteView} from '../ui/view.note.js';
import {createAppMock} from './test-utils.js';


describe('NoteView', () => {
    let noteView;
    let app;

    beforeEach(async () => {
        vi.resetModules();
        // Delete the database before each test
        const {App} = await import('../ui/app.js');
        app = createAppMock();
        app.db.saveOrUpdateObject = vi.fn().mockResolvedValue({});
        noteView = new NoteView(app, app.db, app.nostr);
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