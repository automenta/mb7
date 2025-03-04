/** @typedef {import('../core/types').NObject} NObject */
/** @typedef {import('../core/types').Tag} Tag */

export class TagProcessor {
    /**
     * Processes the tags of an object, ensuring visibility is correctly set.
     * @param {NObject} object - The object whose tags need processing.
     * @param {boolean} isPrivate - Whether the object is private.
     */
    processTags(object, isPrivate) {
        const {tags = []} = object;

        const publicTag = tags.find(tag => tag.name === 'Public');
        const isPublic = publicTag && publicTag.value === 'true';

        object.tags = tags.filter(tag => tag.name !== 'visibility');

        if (!isPublic) {
            /** @type {Tag} */
            const visibilityTag = {name: 'visibility', value: isPrivate ? 'private' : 'public', condition: 'is'};
            object.tags.push(visibilityTag);
        }
    }
}
