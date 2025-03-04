/** @typedef {import('../core/types').NObject} NObject */

/**
 * The `NotePublisher` class is responsible for publishing notes to Nostr.
 */
export class NotePublisher {
    /**
     * Constructor for the `NotePublisher` class.
     * @param {object} nostr - The Nostr object.
     * @param {object} notificationManager - The notification manager object.
     * @param {object} errorHandler - The error handler object.
     */
    constructor(nostr, notificationManager, errorHandler) {
        this.nostr = nostr;
        this.notificationManager = notificationManager;
        this.errorHandler = errorHandler;
    }

    /**
     * Publishes an object to Nostr, if it's not private.
     * @param {NObject} object - The object to publish.
     */
    async publishObject(object) {
        console.log('publishObject called with object:', object);
        const visibilityTag = object.tags.find(tag => tag.name === 'visibility');
        const isPrivate = visibilityTag && visibilityTag.value === 'private';

        if (isPrivate) {
            console.log('Object is private, not publishing to Nostr.');
            return;
        }

        try {
            // Add 'e' tag to reference the original object
            object.tags.push(['e', object.id]);
            await this.nostr.publish(object);
            this.notificationManager.showNotification('Published to Nostr!', 'success');
        } catch (error) {
            this.errorHandler.handleError(error, 'Error publishing to Nostr');
        }
    }

    /**
     * Publishes matches to Nostr.
     * @param {NObject[]} matches - The matches to publish.
     */
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
