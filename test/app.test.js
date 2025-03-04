import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../ui/app.js';
import { createAppMock } from './test-utils.js';
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
            const newNote = { name: 'Test Note', content: 'Test Content' };
            const newObject = await app.createNewObject(newNote);
            expect(newObject).toBeDefined();

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
