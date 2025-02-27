import {createElement} from '../ui/utils.js';
import {describe, expect, it, vi} from 'vitest';

describe('createElement', () => {
    it('should create an element with the given tag name', () => {
        const el = createElement('div');
        expect(el.tagName).toBe('DIV');
    });

    it('should set the attributes of the element', () => {
        const el = createElement('div', {id: 'test', class: 'test-class'});
        expect(el.id).toBe('test');
        expect(el.className).toBe('test-class');
    });

    it('should add event listeners to the element', () => {
        const onclick = vi.fn();
        const el = createElement('div', {onclick});
        el.click();
        expect(onclick).toHaveBeenCalled();
    });

    it('should set the text content of the element', () => {
        const el = createElement('div', {}, 'test content');
        expect(el.textContent).toBe('test content');
    });
});