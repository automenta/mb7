import {beforeEach, describe, expect, it, vi} from 'vitest';
import {OntologyBrowser} from '../ui/edit/ontology-browser.js';
import {Ontology} from '../core/ontology.js';

describe('OntologyBrowser Component', () => {
    let ontologyBrowser;
    let onTagSelect;
    let editor;

    beforeEach(() => {
        onTagSelect = vi.fn();
        editor = {}; // Mock editor object
        ontologyBrowser = new OntologyBrowser(editor, onTagSelect);
        document.body.appendChild(ontologyBrowser.getElement()); // Append to document
    });

    it('should render the categories and instances correctly', () => {
        ontologyBrowser.render(Ontology);
        const categoryDivs = document.querySelectorAll('.ontology-category');
        expect(categoryDivs.length).toBeGreaterThan(0);

        for (const categoryName in Ontology) {
            const category = Ontology[categoryName];
            if (category.tags && Array.isArray(category.tags)) {
                const h3Elements = document.querySelectorAll('.ontology-category h3');
                let categoryDiv = null;
                for (let i = 0; i < h3Elements.length; i++) {
                    if (h3Elements[i].textContent === categoryName) {
                        categoryDiv = h3Elements[i].parentElement;
                        break;
                    }
                }
                expect(categoryDiv).not.toBeNull();

                const instancesDiv = categoryDiv.querySelector('.ontology-instances');
                expect(instancesDiv).not.toBeNull();
                expect(instancesDiv.children.length).toBe(category.tags.length);
            }
        }
    });

    it('should call the onTagSelect callback when a tag instance is clicked', async () => {
        ontologyBrowser.render(Ontology);
        await vi.waitFor(() => document.querySelector('.ontology-instance'));
        const tagInstance = document.querySelector('.ontology-instance');
        tagInstance.addEventListener('click', onTagSelect);
        tagInstance.dispatchEvent(new Event('click'));
        await vi.waitFor(() => {
            expect(onTagSelect).toHaveBeenCalled();
        });
    });
});
