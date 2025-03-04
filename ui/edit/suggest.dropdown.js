import {createElement} from '../ui/utils.js';

export class SuggestionDropdown {
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

        suggestions.forEach(suggestion => {
            const suggestionElement = createElement("div", {class: "suggestion-item"}, suggestion.displayText);
            suggestionElement.addEventListener("click", () => {
                onSelect(suggestion);
                this.hide();
            });
            suggestionElement.suggestion = suggestion;
            this.el.appendChild(suggestionElement);
        });

        this.el.style.position = 'fixed';
        this.el.style.left = `${x}px`;
        this.el.style.top = `${y}px`;
        this.el.style.display = 'block';
        this.updateSelection();
    }

    hide() {
        this.el.style.display = 'none';
        this.selectedIndex = -1;
        this.onSelectCallback = null;
    }

    isVisible() {
        return this.el.style.display === 'block';
    }

    getSuggestionCount() {
        return this.el.children.length;
    }

    getSelectedSuggestion(selectedIndex) {
        if (selectedIndex >= 0 && selectedIndex < this.getSuggestionCount()) {
            return this.el.children[selectedIndex];
        }
        return null;
    }

    updateSelection(selectedIndex = this.selectedIndex) {
        this.selectedIndex = selectedIndex;
        Array.from(this.el.children).forEach((child, i) =>
            child.classList.toggle("selected", i === this.selectedIndex)
        );
    }
}
