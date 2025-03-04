import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Tag} from '/ui/tag.js';

describe('Tag Component', () => {
    beforeEach(() => {
        if (!customElements.get('data-tag')) {
            customElements.define('data-tag', Tag); // Explicitly register Tag
        }
    });

    it('should render the tag correctly with the given data', async () => {
        const tagDef = {
            name: 'testTag',
            label: 'Test Tag',
            ui: {icon: '🧪'},
            conditions: ['is', 'not'],
            validate: () => true,
        };
        let tag;
        let onUpdate = vi.fn();

        tag = new Tag();
        tag.app = {showNotification: vi.fn()};
        tag.shadow = tag.attachShadow({mode: 'open'});

        tag.setAttribute('tag-definition', JSON.stringify(tagDef));
        tag.setAttribute('value', 'testValue');
        tag.setAttribute('condition', 'is');
        tag.connectedCallback(); // Manually call connectedCallback to trigger rendering

        await vi.waitUntil(() => tag.shadowRoot.querySelector('.tag')); // Wait for shadowRoot to render

        const tagElement = tag.shadowRoot.querySelector('.tag');
        expect(tagElement.dataset.tagName).toBe('testTag');
        expect(tagElement.textContent).toContain('🧪 Test Tag:');
        expect(tagElement.textContent).toContain('is');
        expect(tagElement.textContent).toContain('testValue');
    });

    it('should update its appearance when the condition changes', async () => {
        const tagDef = {
            name: 'testTag',
            label: 'Test Tag',
            ui: {icon: '🧪'},
            conditions: ['is', 'not'],
            validate: () => true,
        };
        let tag;
        let onUpdate = vi.fn();

        tag = new Tag();
        tag.app = {showNotification: vi.fn()};
        tag.shadow = tag.attachShadow({mode: 'open'});
        tag.setAttribute('tag-definition', JSON.stringify(tagDef));
        tag.setAttribute('value', 'testValue');
        tag.setAttribute('condition', 'is');
        tag.connectedCallback();

        await vi.waitUntil(() => tag.shadowRoot.querySelector('.tag'));

        tag.setAttribute('condition', 'not');
        await vi.waitUntil(() => tag.shadowRoot.querySelector('.tag-condition')?.textContent === 'not'); // Wait for condition to update

        expect(tag.shadowRoot.querySelector('.tag-condition').textContent).toBe('not');
    });

    it('should remove itself from the DOM when the remove button is clicked', async () => {
        const tagDef = {
            name: 'testTag',
            label: 'Test Tag',
            ui: {icon: '🧪'},
            conditions: ['is', 'not'],
            validate: () => true,
        };
        let tag;
        let onUpdate = vi.fn();

        tag = new Tag();
        tag.app = {showNotification: vi.fn()};
        tag.shadow = tag.attachShadow({mode: 'open'});
        tag.setAttribute('tag-definition', JSON.stringify(tagDef));
        tag.connectedCallback();
        document.body.appendChild(tag); // Append to body so remove() works correctly in jsdom

        await vi.waitUntil(() => tag.shadowRoot.querySelector('.tag'));

        const removeButton = tag.shadowRoot.querySelector('.remove-tag-button');
        removeButton.click();

        expect(document.body.contains(tag)).toBe(false);
    });
});
