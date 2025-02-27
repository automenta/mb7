class Autosuggest {
    constructor(editor) {
        this.editor = editor;
        this.debouncedApply = debounce(this.apply.bind(this), 300);
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
                if (this.editor.matchesOntology(match[0])) {
                    hasMatch = true;
                    break;  // Only need one match per word
                }
            }
            if (hasMatch) this.wrapMatches(node);
        }
    }

    wrapMatches(textNode) {
        const text = textNode.nodeValue;
        const fragment = document.createDocumentFragment();
        let lastIndex = 0;
        const regex = /\b[a-zA-Z]{3,}\b/g; // Create regex here to reset lastIndex

        let match;
        while ((match = regex.exec(text)) !== null) {
            const [start, end] = [match.index, regex.lastIndex];

            if (start > lastIndex) {
                fragment.append(text.substring(lastIndex, start));
            }
            fragment.append(createElement("span", {class: "autosuggest"}, match[0]));
            lastIndex = end;
        }

        if (lastIndex < text.length) {
            fragment.append(text.substring(lastIndex));
        }

        textNode.replaceWith(fragment);
    }
}

import {createElement} from './utils.js';

const debounce = (fn, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn(...args), delay);
    };
};

export {Autosuggest};