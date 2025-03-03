import {beforeEach, describe, expect, it, vi} from 'vitest';
import {EventHandler} from '../core/net/net.events.js';
import {createAppMock} from './test-utils.js';

describe('EventHandler', () => {
    let eventHandler;
    let app;

    beforeEach(() => {
        app = createAppMock();
        eventHandler = new EventHandler(app);
    });

    describe('validateEventContent', () => {
        it('should return true if event content is valid', () => {
            const event = {content: '{ "id": "123" }'};
            expect(eventHandler.validateEventContent(event)).toBe(true);
        });

        it('should return false if event content is empty', () => {
            const event = {content: ''};
            expect(eventHandler.validateEventContent(event)).toBeFalsy(); // Use toBeFalsy for boolean coercion
        });

        it('should return false if event content is invalid JSON', () => {
            const event = {content: 'invalid json'};
            expect(eventHandler.validateEventContent(event)).toBe(false);
        });

        it('should return false if event content does not start with "{"', () => {
            const event = {content: 'invalid json'};
            expect(eventHandler.validateEventContent(event)).toBe(false);
        });

    });

    describe('parseEventContent', () => {
        it('should parse valid JSON event content', async () => {
            const event = {content: '{ "id": "123", "name": "Test" }'};
            const parsedContent = await eventHandler.parseEventContent(event);
            expect(parsedContent).toEqual({id: "123", name: "Test"});
        });

        it('should return null if event content is invalid JSON', async () => {
            const event = {content: 'invalid json'};
            await expect(eventHandler.parseEventContent(event)).rejects.toThrow(SyntaxError);
        });
    });

    describe('createOrUpdateNObject', () => {
        it('should not create or update NObject if data.id is missing', async () => {
            const event = {content: '{ "name": "Test" }', tags: []};
            const data = {name: 'Test'};
            await eventHandler.createOrUpdateNObject(event, data);
            expect(app.db.save).not.toHaveBeenCalled();
        });

        it('should create a new NObject if it does not exist', async () => {
            app.db.get.mockResolvedValue(null);
            const event = {created_at: 1678886400, tags: []};
            const data = {id: '123', name: 'Test', content: 'Test Content'};
            await eventHandler.createOrUpdateNObject(event, data);
            expect(app.db.save).toHaveBeenCalled();
        });

        it('should update an existing NObject if it exists', async () => {
            app.db.get.mockResolvedValue({id: '123', name: 'Old Name', content: 'Old Content'});
            const event = {created_at: 1678886400, tags: []};
            const data = {id: '123', name: 'New Name', content: 'New Content'};
            await eventHandler.createOrUpdateNObject(event, data);
            expect(app.db.save).toHaveBeenCalled();
        });
    });

    describe('extractTagsFromEvent', () => {
        it('should extract tags from event', () => {
            const event = {
                tags: [
                    ['t', 'test'],
                    ['p', 'pubkey1'],
                    ['e', 'event1'],
                    ['unknown', 'value'],
                ],
            };
            const tags = eventHandler.extractTagsFromEvent(event);
            expect(tags).toEqual([
                {name: 'test', condition: 'is', value: ''},
                {name: 'p', condition: 'references', value: 'pubkey1'},
                {name: 'e', condition: 'references', value: 'event1'},
                {name: 'unknown', condition: 'is', value: 'value'},
            ]);
        });
    });

    describe('handleObjectEvent', () => {
        it('should not handle object event if event content is invalid', async () => {
            const event = {content: 'invalid json'};
            eventHandler.validateEventContent = vi.fn().mockReturnValue(false);
            await eventHandler.handleObjectEvent(event);
            expect(eventHandler.validateEventContent).toHaveBeenCalledWith(event);
        });

        it('should not handle object event if parseEventContent returns null', async () => {
            const event = {content: '{ "id": "123" }'};
            eventHandler.validateEventContent = vi.fn().mockReturnValue(true);
            eventHandler.parseEventContent = vi.fn().mockResolvedValue(null);
            await eventHandler.handleObjectEvent(event);
            expect(eventHandler.validateEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.parseEventContent).toHaveBeenCalledWith(event);
        });

        it('should handle object event if event content is valid and parseEventContent returns data', async () => {
            const event = {
                content: '{ "id": "123", "name": "Test", "content": "Test Content" }',
                created_at: 1678886400,
                tags: []
            };
            eventHandler.validateEventContent = vi.fn().mockReturnValue(true);
            eventHandler.parseEventContent = vi.fn().mockResolvedValue({
                id: '123',
                name: 'Test',
                content: 'Test Content'
            });
            eventHandler.extractNObjectData = vi.fn().mockReturnValue({
                id: '123',
                name: 'Test',
                content: 'Test Content'
            });
            eventHandler.createOrUpdateNObject = vi.fn();
            await eventHandler.handleObjectEvent(event);
            expect(eventHandler.validateEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.parseEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.extractNObjectData).toHaveBeenCalled();
            expect(eventHandler.createOrUpdateNObject).toHaveBeenCalledWith(event, {
                id: '123',
                name: 'Test',
                content: 'Test Content'
            });
        });
    });
});

