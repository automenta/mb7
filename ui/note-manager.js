import { v4 as uuidv4 } from 'uuid';

class TagProcessor {
    processTags(object, isPrivate) {
        const { tags = [] } = object;

        const publicTag = tags.find(tag => tag.name === 'Public');
        const isPublic = publicTag && publicTag.value === 'true';

        object.tags = tags.filter(tag => tag.name !== 'visibility');

        if (!isPublic) {
            object.tags.push({ name: 'visibility', value: isPrivate ? 'private' : 'public' });
        }
    }
}

class NotePublisher {
    constructor(nostr, notificationManager, errorHandler) {
        this.nostr = nostr;
        this.notificationManager = notificationManager;
        this.errorHandler = errorHandler;
    }

    async publishObject(object) {
        console.log('publishObject called with object:', object);
        const visibilityTag = object.tags.find(tag => tag.name === 'visibility');
        const isPrivate = visibilityTag && visibilityTag.value === 'private';

        if (isPrivate) {
            console.log('Object is private, not publishing to Nostr.');
            return;
        }

        try {
            await this.nostr.publish(object);
            this.notificationManager.showNotification('Published to Nostr!', 'success');
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
        }
    }

    async publishMatches(matches) {
        console.log('publishMatches called with matches:', matches);
        if (!matches || matches.length === 0) {
            console.log('No matches to publish.');
            return;
        }
        try {
            for (const match of matches) {
                await this.nostr.publish(match);
                this.notificationManager.showNotification('Published match to Nostr!', 'success');
            }
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
        }
    }
}

class ObjectPreparer {
    prepareObjectForSaving(object) {
        if (!object.tags || !Array.isArray(object.tags)) return;
        const invalidTag = object.tags.find(tag => !tag.name);
        if (invalidTag) {
            throw new Error(`Tag name is required. Invalid tag: ${JSON.stringify(invalidTag)}`);
        }
    }
}

export class NoteManager {
    constructor(app, db, errorHandler, matcher, nostr, notificationManager) {
        this.app = app;
        this.db = db;
        this.errorHandler = errorHandler;
        this.matcher = matcher;
        this.nostr = nostr;
        this.notificationManager = notificationManager;
        this.tagProcessor = new TagProcessor();
        this.notePublisher = new NotePublisher(nostr, notificationManager, errorHandler);
        this.objectPreparer = new ObjectPreparer();
    }

    async createNote(name = 'New Note') {
        const newNote = {
            id: uuidv4(),
            name: name,
            content: '',
            tags: [],
            isPersistentQuery: false,
            private: false
        };
        await this.saveObject(newNote);
        this.notificationManager.showNotification('Note created', 'success');
        return newNote;
    }

    async createDefaultNote() {
        const defaultNote = {
            id: 'default',
            name: 'Welcome to Netention!',
            content: 'This is your first note. Edit it to get started.',
            private: true,
            tags: [],
            priority: 'Medium',
            isPersistentQuery: false
        };
        await this.db.save(defaultNote);
        return defaultNote;
    }

    async saveObject(object) {
        if (!object || !object.id) {
            this.errorHandler.handleError(new Error('Object must have an id'), 'Validation error saving object');
            return null;
        }

        this.objectPreparer.prepareObjectForSaving(object);
        const newObject = {id: object.id, name: object.name, content: object.content, tags: object.tags || []};
        this.tagProcessor.processTags(newObject, object.private);
        try {
            await this.db.save(newObject, object.isPersistentQuery);
            const matches = await this.matcher.findMatches(newObject);
            await this.notePublisher.publishObject(newObject);
            await this.notePublisher.publishMatches(matches);
            return newObject;
        } catch (error) {
            this.errorHandler.handleError(error, 'Error saving or publishing object');
            return null;
        }
    }
}
