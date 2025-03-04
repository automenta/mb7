ui/edit/suggest.js
import { SuggestionDropdown } from './suggestion-dropdown.js';

export class Suggest {
    constructor(editorArea, app) {
        this.editorArea = editorArea;
        this.app = app;
        this.suggestionDropdown = new SuggestionDropdown();
        this.editorArea.parentNode.appendChild(this.suggestionDropdown.el);
        this.selectedIndex = -1;
        this.suggestions = [];
    }

    apply() {
        const {editorArea, suggestionDropdown} = this;
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            suggestionDropdown.hide();
            return;
        }
        const range = selection.getRangeAt(0);
        const cursorPosition = range.getBoundingClientRect();
        const text = editorArea.textContent;
    }

    selectSuggestion(selectedSuggestion, tagStart, cursorIndex, text) {
        this.editorArea.textContent = text.substring(0, tagStart + 1) + selectedSuggestion.displayText + text.substring(cursorIndex);
        this.apply();
    }

    handleKeyDown(event) {
        if (!this.suggestionDropdown.isVisible()) return;
        switch (event.key) {
            case 'ArrowUp':
                event.preventDefault();
                this.moveSelection(-1);
                break;
            case 'ArrowDown':
                event.preventDefault();
                this.moveSelection(1);
                break;
            case 'Enter':
            case 'Tab':
                event.preventDefault();
                const selectedSuggestion = this.suggestionDropdown.getSelectedSuggestion();
                if (selectedSuggestion) {
                    this.applySuggestion(selectedSuggestion);
                }
                this.suggestionDropdown.hide();
                break;
            case 'Escape':
                this.suggestionDropdown.hide();
                break;
        }
    }

    moveSelection(direction) {
        const suggestionCount = this.suggestionDropdown.getSuggestionCount();
        if (suggestionCount === 0) return;
        this.selectedIndex += direction;
        if (this.selectedIndex < 0) {
            this.selectedIndex = suggestionCount - 1;
        } else if (this.selectedIndex >= suggestionCount) {
            this.selectedIndex = 0;
        }
        this.suggestionDropdown.updateSelection(this.selectedIndex);
    }
}
