class Autosuggest {
    constructor(editor) {
        this.editor = editor;
        this.debouncedApply = debounce(this.apply.bind(this), 100);
    }

    apply() {
        const editorContent = this.editor.editorArea;

        // Efficiently remove existing .autosuggest spans
        editorContent.querySelectorAll('.autosuggest').forEach(span =>
            span.replaceWith(span.textContent)
        );

        const walker = document.createTreeWalker(
            editorContent,
            NodeFilter.SHOW_TEXT,
            {acceptNode: node => node.parentNode.closest(".inline-tag, .autosuggest") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT}
        );
        const wordRegex = /\b[a-zA-Z]{3,}\b/g;

        let node;
        while ((node = walker.nextNode())) {
            const text = node.nodeValue.trim();
            if (!text) continue;

            let hasMatch = false;
            let match;
            while ((match = wordRegex.exec(text)) !== null) {
                const word = match[0];
                if (this.editor.matchesOntology(word)) {
                    hasMatch = true;
                    this.showSuggestions(word, node, match.index, match[0].length);
                }
            }
        }
    }

    showSuggestions(word, node, startIndex, length) {
        const tagDefinition = this.editor.getTagDefinition(word);
        if (!tagDefinition) return;

        const suggestions = [];
        if (tagDefinition.instances) {
            tagDefinition.instances.forEach(instance => {
                suggestions.push(this.editor.createSuggestion(instance));
            });
        } else {
            suggestions.push(this.editor.createSuggestion(tagDefinition));
        }

        if (suggestions.length === 0) return;

        // Calculate position for the dropdown
        const range = document.createRange();
        range.setStart(node, startIndex);
        range.setEnd(node, startIndex + length);
        const rect = range.getBoundingClientRect();

        this.editor.suggestionDropdown.show(
            suggestions,
            rect.left + window.scrollX,
            rect.bottom + window.scrollY,
            (suggestion) => {
                this.editor.contentHandler.insertTagFromSuggestion(suggestion);
            }
        );
    }
}

import {createElement} from '../utils.js';

const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

export {Autosuggest};
