class SuggestionDropdown {
    constructor() {
        this.el = createElement("div", {id: "suggestion-dropdown", class: "suggestion-dropdown"});
        document.body.append(this.el);
        this.selectedIndex = -1;
        this.onSelectCallback = null;
        this.hide();
    }

    show(suggestions, x, y, onSelect) {
        this.el.innerHTML = "";
        this.onSelectCallback = onSelect;

        if (!suggestions.length) {
            this.hide();
            return;
        }

        suggestions.forEach(suggestion =>
            this.el.append(
                createElement("div", {
                    class: "suggestion-item",
                    onclick: () => {
                        this.onSelectCallback?.(suggestion);
                        this.hide();
                    },
                }, `${suggestion.tagData.emoji || ""} ${suggestion.displayText}`)
            )
        );

        Object.assign(this.el.style, {left: `${x}px`, top: `${y}px`, display: "block"});
        this.selectedIndex = -1;
        this.updateSelection();
    }

    hide() {
        this.el.style.display = 'none';
        this.selectedIndex = -1;
        this.onSelectCallback = null;
    }

    moveSelection(direction) {
        const count = this.el.children.length;
        this.selectedIndex = count > 0 ? (this.selectedIndex + direction + count) % count : -1;
        this.updateSelection();
    }

    updateSelection() {
        Array.from(this.el.children).forEach((child, i) =>
            child.classList.toggle("selected", i === this.selectedIndex)
        );
    }

    getSelectedSuggestion() {
        return this.el.children[this.selectedIndex]?.textContent ?? null;
    }
}

import {createElement} from './utils.js';

export {SuggestionDropdown};