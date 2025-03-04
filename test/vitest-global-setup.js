import { JSDOM } from 'jsdom';
import { Tag } from '@/ui/tag.js';

// Setup JSDOM
const dom = new JSDOM('<!DOCTYPE html><html lang="en"><body></body></html>', {
  url: 'http://localhost',
});

global.window = dom.window;
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;
global.customElements = dom.window.customElements;

if (!customElements.get('data-tag')) {
  customElements.define('data-tag', Tag);
}
