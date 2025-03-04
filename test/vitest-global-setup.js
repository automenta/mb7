import { vi } from 'vitest';
import { JSDOM } from 'jsdom';
import { Tag } from '../ui/tag.js'; // Use relative path here

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body></body></html>', {
    url: 'http://localhost',
    // Include 'customElements' in the JSDOM options
    includeNodeLocations: true,
    storageQuota: 10000000,
    runScripts: 'dangerously',
    resources: 'usable',
    customElement: true, // Add this line
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(), // Deprecated
        removeListener: vi.fn(), // Deprecated
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// Ensure Tag is defined only once
if (!customElements.get('data-tag')) {
    try {
        customElements.define('data-tag', Tag);
        console.log('Custom element "data-tag" defined.');
    } catch (e) {
        console.error('Error defining custom element "data-tag":', e);
    }
} else {
    console.log('Custom element "data-tag" already defined.');
}
