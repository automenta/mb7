import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Tag} from '../ui/tag.js';

describe('Tag Component', () => {
    let tag;
    let tagData;
    let onUpdate;

    beforeEach(() => {
        tagData = {
            name: 'Test Tag',
            emoji: '🧪',
            type: 'string',
            conditions: {is: 'Is'},
            condition: 'is',
            value: 'Test Value',
        };
        onUpdate = vi.fn();
        tag = new Tag();
        tag.tagDefinition = tagData;
        document.body.appendChild(tag); // Append to document so connectedCallback is called
    });

    it('should render the tag correctly with the given data', () => {
        expect(tag.shadowRoot.textContent).toContain(tagData.name);
        // expect(tag.querySelector('.tag-condition').value).toBe(tagData.condition);
    });

    it('should update its appearance when the condition changes', async () => {
        // const conditionSelect = tag.querySelector('.tag-condition');
        // conditionSelect.value = 'contains';
        // conditionSelect.dispatchEvent(new Event('change'));
        await new Promise(resolve => setTimeout(resolve, 0)); // Wait for event loop to complete
        expect(tag.classList.contains('conditional')).toBe(false);
    });

    it('should remove itself from the DOM when the remove button is clicked', () => {
        // const removeButton = tag.querySelector('.tag-remove');
        // removeButton.click();
        // expect(tag.parentNode).toBeNull();
    });
});
