import {createElement} from '../utils.js';

export class SuggestionDropdown {
    constructor() {
        this.el = createElement('div', {className: 'suggestion-dropdown'});
        this.list = createElement('ul');
        this.el.appendChild(this.list);
        this.visible = false;
    }

    show(suggestions, onSelect) {
        this.list.innerHTML = '';
        suggestions.forEach(suggestion => {
            const item = createElement('li', {}, suggestion);
            item.addEventListener('click', () => {
                onSelect(suggestion);
                this.hide();
            });
            this.list.appendChild(item);
        });
        this.visible = true;
        return this.el;
    }

    hide() {
        this.visible = false;
        this.el.innerHTML = '';
    }

    isVisible() {
        return this.visible;
    }

    getElement() {
        return this.el;
    }
}
