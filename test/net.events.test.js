import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventHandler } from '@/core/net/net.events.js';
import { createAppMock } from './test-utils.js';

describe('EventHandler', () => {
    let eventHandler;
    let app;

    beforeEach(() => {
        app = createAppMock();
        eventHandler = new EventHandler(app);
    });

    describe('validateEventContent', () => {
        it.each([
            [{ content: '{ "id": "123" }' }, true, 'valid JSON'],
            [{ content: '' }, false, 'empty content'],
            [{ content: 'invalid json' }, false, 'invalid JSON'],
        ])('should return %s if event content is %s (%s)', (event, expected, description) => {
            expect(eventHandler.validateEventContent(event)).toBe(expected);
        });
    });

    describe('parseEventContent', () => {
        it('should parse valid JSON event content', async () => {
            const event = { content: '{ "id": "123", "name": "Test" }' };
            const parsedContent = await eventHandler.parseEventContent(event);
            expect(parsedContent).toEqual({ id: "123", name: "Test" });
        });

        it('should throw an error if event content is invalid JSON', async () => {
            const event = { content: 'invalid json' };
            await expect(eventHandler.parseEventContent(event)).rejects.toThrow(SyntaxError);
        });
    });

    describe('createOrUpdateNObject', () => {
        it('should not create or update NObject if data.id is missing', async () => {
            const event = { content: '{ "name": "Test" }', tags: [] };
            const data = { name: 'Test' };
            await eventHandler.createOrUpdateNObject(event, data);
            expect(app.db.save).not.toHaveBeenCalled();
        });

        it('should create a new NObject if it does not exist', async () => {
            app.db.get.mockResolvedValue(null);
            const event = { created_at: 1678886400, tags: [] };
            const data = { id: '123', name: 'Test', content: 'Test Content' };

            await eventHandler.createOrUpdateNObject(event, data);

            expect(app.db.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '123',
                    name: 'Test',
                    content: 'Test Content',
                    tags: []
                }),
                undefined
            );
        });

        it('should update an existing NObject if it exists', async () => {
            app.db.get.mockResolvedValue({ id: '123', name: 'Old Name', content: 'Old Content' });
            const event = { created_at: 1678886400, tags: [] };
            const data = { id: '123', name: 'New Name', content: 'New Content' };

            await eventHandler.createOrUpdateNObject(event, data);

            expect(app.db.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: '123',
                    name: 'New Name',
                    content: 'New Content',
                    tags: []
                }),
                undefined
            );
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
                { name: 'test', condition: 'is', value: '' },
                { name: 'p', condition: 'references', value: 'pubkey1' },
                { name: 'e', condition: 'references', value: 'event1' },
                { name: 'unknown', condition: 'is', value: 'value' },
            ]);
        });
    });

    describe('handleObjectEvent', () => {
        beforeEach(() => {
            eventHandler.validateEventContent = vi.fn();
            eventHandler.parseEventContent = vi.fn();
            eventHandler.extractNObjectData = vi.fn();
            eventHandler.createOrUpdateNObject = vi.fn();
        });

        it('should not handle object event if event content is invalid', async () => {
            const event = { content: 'invalid json' };
            eventHandler.validateEventContent.mockReturnValue(false);
            await eventHandler.handleObjectEvent(event);
            expect(eventHandler.validateEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.parseEventContent).not.toHaveBeenCalled();
            expect(eventHandler.extractNObjectData).not.toHaveBeenCalled();
            expect(eventHandler.createOrUpdateNObject).not.toHaveBeenCalled();
        });

        it('should not handle object event if parseEventContent returns null', async () => {
            const event = { content: '{ "id": "123" }' };
            eventHandler.validateEventContent.mockReturnValue(true);
            eventHandler.parseEventContent.mockResolvedValue(null);
            await eventHandler.handleObjectEvent(event);
            expect(eventHandler.validateEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.parseEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.extractNObjectData).not.toHaveBeenCalled();
            expect(eventHandler.createOrUpdateNObject).not.toHaveBeenCalled();
        });

        it('should handle object event if event content is valid and parseEventContent returns data', async () => {
            const event = {
                content: '{ "id": "123", "name": "Test", "content": "Test Content" }',
                created_at: 1678886400,
                tags: []
            };
            const parsedData = {
                id: '123',
                name: 'Test',
                content: 'Test Content'
            };
            const extractedData = {
                id: '123',
                name: 'Test',
                content: 'Test Content'
            };

            eventHandler.validateEventContent.mockReturnValue(true);
            eventHandler.parseEventContent.mockResolvedValue(parsedData);
            eventHandler.extractNObjectData.mockReturnValue(extractedData);

            await eventHandler.handleObjectEvent(event);

            expect(eventHandler.validateEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.parseEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.extractNObjectData).toHaveBeenCalledWith(parsedData);
            expect(eventHandler.createOrUpdateNObject).toHaveBeenCalledWith(event, extractedData);
        });
    });
});
