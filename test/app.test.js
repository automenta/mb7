import {beforeEach, describe, expect, it, vi} from 'vitest';
import {App} from '../ui/app.js';

describe('App', () => {
    let app;

    beforeEach(async () => {
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for 500ms
        app = new App();
        app.db = {
            save: vi.fn(),
        };
    });

    describe('prepareObjectForSaving', () => {
        it('should throw an error if tag name is empty', () => {
            const object = {
                name: 'Test object',
                content: 'Test content',
                tags: [{name: ''}],
            };
            expect(() => app.prepareObjectForSaving(object)).toThrowError('Tag name is required.');
        });

        it('should throw an error if tag name is too long', () => {
            const object = {
                name: 'Test object',
                content: 'Test content',
                tags: [{name: 'This is a very long tag name that exceeds the maximum length of 50 characters'}],
            };
            expect(() => app.prepareObjectForSaving(object)).toThrowError('Tag name is too long (max 50 characters).');
        });

        it('should not throw an error if tag names are valid', () => {
            const object = {
                name: 'Test object',
                content: 'Test content',
                tags: [{name: 'Valid tag'}],
            };
            expect(() => app.prepareObjectForSaving(object)).not.toThrow();
        });
    });
});