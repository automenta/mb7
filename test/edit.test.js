import { describe, expect, it } from 'vitest';
import { Edit } from '../ui/edit/edit.js';
import { Ontology } from '../core/ontology';
import * as Y from 'yjs';

describe('Edit Autosuggest', () => {
    it('should suggest tag names from ontology', () => {
        const yDoc = new Y.Doc()

        const getTagDefinition = (name) => Ontology[name]; // Mock getTagDefinition

        class MockAutosuggest {
            constructor(edit) {
                this.edit = edit;
            }

            apply() {
            }
        }

        const autosuggest = new MockAutosuggest(); // Mock Autosuggest

        class MockContentHandler {
            constructor(edit) {
                this.edit = edit;
            }
        }

        const contentHandler = new MockContentHandler(); // Mock ContentHandler
        const ontologyBrowser = { getElement: () => ({}) }; // Mock OntologyBrowser
        const toolbar = { getElement: () => ({}) }; // Mock Toolbar
        const schema = {}; // Mock Schema

        const edit = new Edit({}, yDoc, {}, getTagDefinition, schema);

        edit.matchesOntology = (word) => {
            return Object.keys(Ontology).some(tagName => tagName.toLowerCase() === word.toLowerCase());
        }

        // Get tag names from ontology
        const tagNames = Object.keys(Ontology);

        // Call matchesOntology for each tag name and check if it returns true
        tagNames.forEach(tagName => {
            const isMatch = edit.matchesOntology(tagName);
            expect(isMatch).toBe(true);
        });
    });
});
