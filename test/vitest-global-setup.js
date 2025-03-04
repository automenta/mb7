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
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;

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
