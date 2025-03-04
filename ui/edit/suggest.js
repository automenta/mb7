export class Autosuggest {
    constructor(editor) {
        this.editor = editor;
        this.suggestionDropdown = editor.suggestionDropdown;
        this.schema = editor.schema;
        this.editorArea = editor.editorArea;
        this.selectedIndex = -1;
        this.apply = this.apply.bind(this);
        this.debouncedApply = this.debounce(this.apply, 200);
    }

    debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        }
    }

    apply() {
        const { editorArea, suggestionDropdown } = this;
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            suggestionDropdown.hide();
            return;
        }
        const range = selection.getRangeAt(0);
        const cursorPosition = range.getBoundingClientRect();
        const text = editorArea.textContent;
        const cursorIndex = selection.anchorOffset;
        let tagStart = -1;
        for (let i = cursorIndex - 1; i >= 0; i--) {
            if (text[i] === '[') {
                tagStart = i;
                break;
            }
        }
        if (tagStart === -1) {
            suggestionDropdown.hide();
            return;
        }
        const tagName = text.substring(tagStart + 1, cursorIndex).trim();
        if (!tagName) {
            suggestionDropdown.hide();
            return;
        }
        const suggestions = this.getSuggestions(tagName);
        if (!suggestions.length) {
            suggestionDropdown.hide();
            return;
        }
        this.selectedIndex = -1;
        suggestionDropdown.show(suggestions, cursorPosition.x, cursorPosition.bottom, (selectedSuggestion) => {
            this.selectSuggestion(selectedSuggestion, tagStart, cursorIndex, text);
        });
    }

    getSuggestions(tagName) {
        const suggestions = [];
        for (const key in this.schema) {
            if (key.toLowerCase().startsWith(tagName.toLowerCase())) {
                suggestions.push({ displayText: key, tagData: this.schema[key] });
            }
        }
        return suggestions;
    }

    selectSuggestion(selectedSuggestion, tagStart, cursorIndex, text) {
        const newText = text.substring(0, tagStart + 1) + selectedSuggestion.displayText + text.substring(cursorIndex);
        this.editorArea.textContent = newText;
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
                event.preventDefault();
                this.selectCurrentSuggestion();
                break;
            case 'Escape':
                event.preventDefault();
                this.suggestionDropdown.hide();
                break;
            default:
                return;
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

    selectCurrentSuggestion() {
        const selectedSuggestion = this.suggestionDropdown.getSelectedSuggestion(this.selectedIndex);
        if (selectedSuggestion) {
            this.selectSuggestion(selectedSuggestion.suggestion, this.tagStart, this.cursorIndex, this.editorArea.textContent);
            this.suggestionDropdown.hide();
        }
    }
}
