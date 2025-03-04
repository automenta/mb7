import {beforeEach, describe, expect, it, vi} from 'vitest';
import {App} from '../ui/app.js';
import {createAppMock} from './test-utils.js';
import * as sha256Module from 'js-sha256';

// Mock the animate function
global.Element.prototype.animate = vi.fn();

vi.mock('js-sha256', () => sha256Module);

describe('App', () => {
    let app;

    beforeEach(async () => {
        vi.resetModules();
        app = createAppMock();
    });

    describe('createNewObject', () => {
        it('should create a new object and save it to the database', async () => {
            const newNote = {name: 'Test Note', content: 'Test Content'};
            const newObject = await app.createNewObject(newNote);
            expect(newObject).toBeDefined();
            expect(app.db.save).toHaveBeenCalledWith(newObject); // Verify save was called with the new object
            expect(newObject.content).toBe('Test Content');
        });
    });

    describe('publishNoteToNostr', () => {
        it('should publish the note content to Nostr', async () => {
            app.nostr = {
                publish: vi.fn().mockResolvedValue({}), // Mock publish to return a promise
            };
            const note = {content: 'Test Note Content'};
            await app.publishNoteToNostr(note);
            expect(app.nostr.publish).toHaveBeenCalledWith(note.content);
        });

        it('should handle publish errors', async () => {
            app.nostr = {
                publish: vi.fn().mockRejectedValue(new Error('Publish failed')), // Mock publish to reject
            };
            app.errorHandler.handleError = vi.fn(); // Spy on handleError
            const note = {content: 'Test Note Content'};
            await app.publishNoteToNostr(note);
            expect(app.errorHandler.handleError).toHaveBeenCalled(); // Verify error handler was called
        });
    });
});
