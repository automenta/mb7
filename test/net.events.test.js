import {beforeEach, describe, expect, it, vi} from 'vitest';
import {EventHandler} from '@/core/net/net.events.js';
import {createAppMock} from './test-utils.js';
import {FriendsView} from '@/ui/view.friends.js'; // Import FriendsView for instanceof check

describe('EventHandler', () => {
    let eventHandler;
    let app;
    const testObjectId = '123';
    const testObjectName = 'Test';
    const testObjectContent = 'Test Content';
    const validEventContent = `{ "id": "${testObjectId}", "name": "${testObjectName}" }`;
    const invalidEventContent = 'invalid json';
    const baseEvent = { created_at: 1678886400, tags: [] , pubkey: 'testPubkey'};
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
            await eventHandler.createOrUpdateNObject(event, parsedData);

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
            await eventHandler.createOrUpdateNObject(event, parsedData);

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

    describe('handleKind0', () => {
        it('should handle kind 0 event for self profile', async () => {
            const profileData = { name: 'Test User', about: 'About me' };
            const event = { ...baseEvent, kind: 0, content: JSON.stringify(profileData), pubkey: window.keys.pub };

            await eventHandler.handleKind0(event);

            expect(app.settingsView?.displayProfile).toHaveBeenCalledWith(profileData);
            expect(app.db.updateFriendProfile).not.toHaveBeenCalled();
        });

        it('should handle kind 0 event for friend profile and update friends view if FriendsView is current view', async () => {
            const profileData = { name: 'Friend User', picture: 'avatar.png' };
            const event = { ...baseEvent, kind: 0, content: JSON.stringify(profileData), pubkey: 'friendPubkey' };
            app.mainContent.currentView = new FriendsView();
            app.friendsView = { loadFriends: vi.fn() };

            await eventHandler.handleKind0(event);

            expect(app.db.updateFriendProfile).toHaveBeenCalledWith('friendPubkey', profileData.name, profileData.picture);
            expect(app.friendsView.loadFriends).toHaveBeenCalled();
        });

        it('should handle kind 0 event for friend profile but not update friends view if FriendsView is not current view', async () => {
            const profileData = { name: 'Friend User', picture: 'avatar.png' };
            const event = { ...baseEvent, kind: 0, content: JSON.stringify(profileData), pubkey: 'friendPubkey' };
            app.mainContent.currentView = {}; // Not FriendsView

            await eventHandler.handleKind0(event);

            expect(app.db.updateFriendProfile).toHaveBeenCalledWith('friendPubkey', profileData.name, profileData.picture);
            expect(app.friendsView?.loadFriends).not.toHaveBeenCalled();
        });
    });

    describe('handleKind3', () => {
        it('should handle kind 3 event with array content', async () => {
            const contacts = ['pubkey1', 'pubkey2'];
            const event = { ...baseEvent, kind: 3, content: JSON.stringify(contacts) };
            const parsedContacts = contacts; // Already parsed

            await eventHandler.handleKind3(event);

            expect(app.db.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'friends',
                    friends: parsedContacts
                }),
                true
            );
        });

        it('should handle kind 3 event with object content', async () => {
            const contactsObject = { pubkey1: 'true', pubkey2: 'true' };
            const event = { ...baseEvent, kind: 3, content: JSON.stringify(contactsObject) };
            const parsedContacts = Object.keys(contactsObject);

            await eventHandler.handleKind3(event);

            expect(app.db.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'friends',
                    friends: parsedContacts
                }),
                true
            );
        });

        it('should handle kind 3 event with empty content', async () => {
            const event = { ...baseEvent, kind: 3, content: '' };
            const parsedContacts = [];

            await eventHandler.handleKind3(event);

            expect(app.db.save).toHaveBeenCalledWith(
                expect.objectContaining({
                    id: 'friends',
                    friends: parsedContacts
                }),
                true
            );
        });
    });

    describe('handleKind5', () => {
        it('should handle kind 5 event and delete specified events', async () => {
            const eventIdsToDelete = ['event1', 'event2'];
            const event = { ...baseEvent, kind: 5, tags: eventIdsToDelete.map(id => ['e', id]) };

            await eventHandler.handleKind5(event);

            expect(app.db.delete).toHaveBeenCalledTimes(eventIdsToDelete.length);
            eventIdsToDelete.forEach(eventId => {
                expect(app.db.delete).toHaveBeenCalledWith(eventId);
            });
        });

        it('should handle errors during deletion in kind 5 event', async () => {
            const eventIdsToDelete = ['event1', 'event2'];
            const event = { ...baseEvent, kind: 5, tags: eventIdsToDelete.map(id => ['e', id]) };
            const error = new Error('Deletion failed');
            app.db.delete.mockRejectedValue(error);

            await eventHandler.handleKind5(event);

            expect(app.db.delete).toHaveBeenCalledTimes(eventIdsToDelete.length);
            eventIdsToDelete.forEach(eventId => {
                expect(app.db.delete).toHaveBeenCalledWith(eventId);
            });
            expect(console.error).toHaveBeenCalledTimes(eventIdsToDelete.length); // Errors are logged
        });
    });
});
