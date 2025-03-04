/** @typedef {import('../core/types').NObject} NObject */

export class ObjectPreparer {
    /**
     * Prepares an object for saving, validating its tags.
     * @param {NObject} object - The object to prepare.
     */
    prepareObjectForSaving(object) {
        if (!object.tags || !Array.isArray(object.tags)) return;
        const invalidTag = object.tags.find(tag => !tag.name);
        if (invalidTag) {
            throw new Error(`Tag name is required. Invalid tag: ${JSON.stringify(invalidTag)}`);
        }
    }
}
