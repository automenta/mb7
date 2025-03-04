import {createElement} from '../ui/utils.js';

class Autosuggest {
    constructor(editor) {
        this.editor = editor;
        this.debouncedApply = this.apply.bind(this);
    }

    apply() {
        const editorContent = this.editor.editorArea;

        // Get the current cursor position
        const selection = window.getSelection();
        if (!selection.rangeCount) {
            this.editor.suggestionDropdown.hide();
            return;
        }
        const range = selection.getRangeAt(0);
        const cursorPosition = range.getBoundingClientRect();

        // Get the text around the cursor
        const text = editorContent.textContent;
        const cursorIndex = selection.anchorOffset;
        let tagStart = -1;

        // Find the start of the tag
        for (let i = cursorIndex - 1; i >= 0; i--) {
            if (text[i] === '[') {
                tagStart = i;
                break;
            }
        }

        // If no tag start is found, hide the suggestion dropdown
        if (tagStart === -1) {
            this.editor.suggestionDropdown.hide();
            return;
        }

        // Extract the tag name
        const tagName = text.substring(tagStart + 1, cursorIndex);

        // If the tag name is empty, hide the suggestion dropdown
        if (tagName.length === 0) {
            this.editor.suggestionDropdown.hide();
            return;
        }

        // Get the suggestions
        const suggestions = this.getSuggestions(tagName);

        // If there are no suggestions, hide the suggestion dropdown
        if (suggestions.length === 0) {
            this.editor.suggestionDropdown.hide();
            return;
        }

        // Show the suggestion dropdown
        this.editor.suggestionDropdown.show(
            suggestions,
            cursorPosition.x,
            cursorPosition.bottom,
            (selectedSuggestion) => {
                // Replace the tag name with the selected suggestion
                const newText = text.substring(0, tagStart + 1) + selectedSuggestion.displayText + text.substring(cursorIndex);
                this.editor.editorArea.textContent = newText;
                this.editor.autosuggest.apply();
            }
        );
    }

    getSuggestions(tagName) {
        const suggestions = [];
        for (const key in this.editor.schema) {
            if (key.toLowerCase().startsWith(tagName.toLowerCase())) {
                suggestions.push({displayText: key, tagData: this.editor.schema[key]});
            }
        }
        return suggestions;
    }
}

export { Autosuggest };
