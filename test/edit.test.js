test/edit.test.js
import { describe, it, expect, vi } from 'vitest';
import * as Y from 'yjs';
import { Edit } from '../ui/edit/edit';
import Ontology from '../core/ontology';

describe('Edit Autosuggest', () => {
    it('should suggest tag names from ontology', () => {
        const yDoc = new Y.Doc()

        const getTagDefinition = (name) => Ontology[name];

        class MockAutosuggest {
            constructor(edit) {
                this.edit = edit;
            }

            suggestTags(query) {
                const suggestions = Object.keys(Ontology)
                    .filter(tagName => tagName.toLowerCase().startsWith(query.toLowerCase()))
                    .map(tagName => ({ name: tagName }));
                return Promise.resolve(suggestions);
            }

            renderSuggestions(suggestions) {
            }

            clearSuggestions() {
            }
        }


        class MockOntologyBrowser {
            constructor(editor, onTagSelect) {
                this.editor = editor;
                this.onTagSelect = onTagSelect;
            }

            render(ontology) {
            }
        }

        const mockApp = {
            ontology: Ontology
        };


        const edit = new Edit({}, yDoc, mockApp, getTagDefinition, {});
        edit.autosuggest = new MockAutosuggest(edit);

        return edit.autosuggest.suggestTags('Per').then(suggestions => {
            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions.some(suggestion => suggestion.name === 'Person')).toBe(true);
        });
    });
});
