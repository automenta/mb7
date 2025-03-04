import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventHandler } from '@/core/net/net.events.js';
import { createAppMock } from './test-utils.js';

describe('EventHandler', () => {
    let eventHandler;
    let app;
    const testObjectId = '123';
    const testObjectName = 'Test';
    const testObjectContent = 'Test Content';
    const validEventContent = `{ "id": "${testObjectId}", "name": "${testObjectName}" }`;
    const invalidEventContent = 'invalid json';
    const baseEvent = { created_at: 1678886400, tags: [] };
    const parsedData = { id: testObjectId, name: testObjectName, content: testObjectContent };
    const extractedData = { id: testObjectId, name: testObjectName, content: testObjectContent };

    beforeEach(() => {
        app = createAppMock();
        eventHandler = new EventHandler(app);
    });

    describe('validateEventContent', () => {
        it.each([
            [{ content: validEventContent }, true, 'valid JSON'],
            [{ content: '' }, false, 'empty content'],
            [{ content: invalidEventContent }, false, 'invalid JSON'],
        ])('should return %s if event content is %s (%s)', (event, expected, description) => {
            expect(eventHandler.validateEventContent(event)).toBe(expected);
        });
    });

    describe('parseEventContent', () => {
        it('should parse valid JSON event content', async () => {
            const event = { content: validEventContent };
            const parsedContent = await eventHandler.parseEventContent(event);
            expect(parsedContent).toEqual({ id: testObjectId, name: testObjectName });
        });

        it('should throw an error if event content is invalid JSON', async () => {
            const event = { content: invalidEventContent };
            await expect(eventHandler.parseEventContent(event)).rejects.toThrow(SyntaxError);
        });
    });

    describe('createOrUpdateNObject', () => {
        it('should not create or update NObject if data.id is missing', async () => {
            const event = { content: '{ "name": "Test" }', tags: [] };
            const data = { name: testObjectName };
            await eventHandler.createOrUpdateNObject(event, data);
            expect(app.db.save).not.toHaveBeenCalled();
        });

        it('should create a new NObject if it does not exist', async () => {
            app.db.get.mockResolvedValue(null);
            const event = { ...baseEvent, tags: [] };
            const data = parsedData;

            await eventHandler.createOrUpdateNObject(event, data);

            expect(app.db.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: testObjectId,
                    name: testObjectName,
                    content: testObjectContent,
                    tags: []
                }),
                undefined
            );
        });

        it('should update an existing NObject if it exists', async () => {
            app.db.get.mockResolvedValue({ id: testObjectId, name: 'Old Name', content: 'Old Content' });
            const event = { ...baseEvent, tags: [] };
            const data = parsedData;

            await eventHandler.createOrUpdateNObject(event, data);

            expect(app.db.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: testObjectId,
                    name: testObjectName,
                    content: testObjectContent,
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
            const event = { content: invalidEventContent };
            eventHandler.validateEventContent.mockReturnValue(false);
            await eventHandler.handleObjectEvent(event);
            expect(eventHandler.validateEventContent).toHaveBeenCalledWith(event);
            expect(eventHandler.parseEventContent).not.toHaveBeenCalled();
            expect(eventHandler.extractNObjectData).not.toHaveBeenCalled();
            expect(eventHandler.createOrUpdateNObject).not.toHaveBeenCalled();
        });

        it('should not handle object event if parseEventContent returns null', async () => {
            const event = { content: validEventContent };
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
                content: validEventContent,
                created_at: 1678886400,
                tags: []
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
