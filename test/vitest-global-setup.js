import { Tag } from '@/ui/tag.js';

if (!customElements.get('data-tag')) {
    customElements.define('data-tag', Tag);
}
