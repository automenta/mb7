import * as Y from 'yjs'
import {Edit} from "@/ui/edit/edit.js";
import {Ontology} from "@/core/ontology.js";
import {describe, expect, it} from "vitest";

describe('Edit Autosuggest', () => {
    it('should suggest tag names from ontology', () => {
        const yDoc = new Y.Doc()

        const getTagDefinition = (name) => Ontology[name]; // Mock getTagDefinition

        class MockAutosuggest {
            constructor(edit) {
                this.edit = edit;
            }

            apply() {
                // Mock apply method
            }
        }

        class MockSuggestionDropdown {
            constructor() {
                // Mock constructor
            }

            show(suggestions, onSelect) {
                // Mock show method
            }

            hide() {
                // Mock hide method
            }
        }

        class MockOntologyBrowser {
            constructor(editor, onTagSelect) {
                this.editor = editor;
                this.onTagSelect = onTagSelect;
            }

            render(ontology) {
                // Mock render method
            }

            getElement() {
                return document.createElement('div'); // Mock getElement
            }
        }


        const app = {showNotification: vi.fn()}

        const edit = new Edit({}, yDoc, app, getTagDefinition, Ontology);
        edit.autosuggest = new MockAutosuggest(edit); // Mock autosuggest
        edit.suggestionDropdown = new MockSuggestionDropdown(); // Mock suggestionDropdown
        edit.ontologyBrowser = new MockOntologyBrowser(edit, () => {
        }); // Mock ontologyBrowser

        edit.matchesOntology = (word) => {
            const suggestions = [];
            for (const tagCategory in Ontology) {
                const category = Ontology[tagCategory];
                if (category.tags) {
                    for (const tagName in category.tags) {
                        if (tagName.startsWith(word)) {
                            suggestions.push(tagName);
                        }
                    }
                } else if (tagCategory.startsWith(word)) {
                    suggestions.push(tagCategory);
                }
            }
            return suggestions;
        }


        const suggestions = edit.getSuggestionsForWord("l");
        expect(suggestions).toContain("location");
    })
})
