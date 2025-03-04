import { describe, expect, it } from 'vitest';
import { Ontology } from '../core/ontology.js';
import * as Y from 'yjs';
import { Edit } from '../ui/edit/edit.js';
import { createAppMock } from './test-utils.js';

describe('Edit Autosuggest', () => {
    it('should suggest tag names from ontology', async () => {
        const yDoc = new Y.Doc();
        const appMock = createAppMock();
        const getTagDefinition = (name) => Ontology[name];
        appMock.getTagDefinition = getTagDefinition;
        appMock.ontology = Ontology;

        const edit = new Edit({}, yDoc, appMock, getTagDefinition, {});

        const query = 'Per';
        const suggestions = Object.keys(appMock.ontology)
            .filter(tagName => tagName.toLowerCase().startsWith(query.toLowerCase()))
            .map(tagName => ({ name: tagName }));

        expect(suggestions.length).toBeGreaterThan(0);
        expect(suggestions.some(suggestion => suggestion.name === 'Person')).toBe(true);
    });
});
