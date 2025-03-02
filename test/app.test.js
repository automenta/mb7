import {beforeEach, describe, expect, it, vi} from 'vitest';
import {App} from '../ui/app.js';
import {createAppMock} from './test-utils.js';

// Mock the animate function
global.Element.prototype.animate = vi.fn();

describe('App', () => {
    let app;

    beforeEach(async () => {
        app = new App();
        app = createAppMock();
    });

    describe('createNewObject', () => {
        it('should create a new object and save it to the database', async () => {
            const newNote = {name: 'Test Note', content: 'Test Content'};
            console.log('Test: Calling app.createNewObject with:', newNote);
            const newObject = await app.createNewObject(newNote);
            console.log('Test: app.createNewObject returned:', newObject);
            expect(newObject).toBeDefined();
            expect(newObject.name).toBe('Test Note');
            expect(newObject.content).toBe('Test Content');
        });
    });

    describe('publishNoteToNostr', () => {
        it('should publish the note content to Nostr', async () => {
            app.nostr = {
                publish: vi.fn(),
            };
            const note = {content: 'Test Note Content'};
            console.log('Test: Calling app.publishNoteToNostr with:', note);
            await app.publishNoteToNostr(note);
            console.log('Test: app.publishNoteToNostr called');
            expect(app.nostr.publish).toHaveBeenCalledWith('Test Note Content');
        });

    });
});