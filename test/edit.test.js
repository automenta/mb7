import { describe, it, expect } from 'vitest';
import { Edit } from '../ui/edit/edit';
import { Ontology, getTagDefinition } from '../core/ontology';

describe('Edit Autosuggest', () => {
    it('should suggest tag names from ontology', () => {
        const yDoc = {
            getText: () => ({}) // Mock Y.Text
        }; // Mock Y.Doc
        
        const getTagDefinition = (name) => Ontology[name]; // Mock getTagDefinition
        
        class MockAutosuggest {
            constructor(edit) {
                this.edit = edit;
            }
            apply() {}
        }
        const autosuggest = new MockAutosuggest(); // Mock Autosuggest

        class MockContentHandler {
            constructor(edit) {
                this.edit = edit;
            }
        }
        const contentHandler = new MockContentHandler(); // Mock ContentHandler
        const ontologyBrowser = {getElement: () => ({})}; // Mock OntologyBrowser
        const toolbar = {getElement: () => ({})}; // Mock Toolbar
        const schema = {}; // Mock Schema

        const edit = new Edit(yDoc, autosuggest, contentHandler, ontologyBrowser, toolbar, getTagDefinition, schema);
        edit.getTagDefinition = getTagDefinition;

        edit.matchesOntology = (word) => {
            return Object.keys(Ontology).some(tagName => tagName.toLowerCase() === word.toLowerCase());
        }

        // Get tag names from ontology that have instances
        const tagNames = Object.keys(Ontology).filter(tagName => Ontology[tagName].instances);

        // Call findSuggestion for each tag name and check if it returns a suggestion
        tagNames.forEach(tagName => {
            Ontology[tagName].instances.forEach(instance => {
                const suggestion = edit.findSuggestion(instance.name);
                console.log("Suggestion:", suggestion, "Instance Name:", instance.name);
                expect(suggestion).toBeDefined();
                if (suggestion) {
                    expect(suggestion.displayText).toBe(instance.name);
                }
            });
        });
    });
});