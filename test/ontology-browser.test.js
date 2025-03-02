import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OntologyBrowser } from '../ui/edit/ontology-browser.js';
import { UnifiedOntology } from '../core/ontology.js';
import {Tag} from "../ui/tag.js";

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
        ontologyBrowser.render(UnifiedOntology);
        const categoryDivs = document.querySelectorAll('.ontology-category');
        expect(categoryDivs.length).toBeGreaterThan(0);

        for (const categoryName in UnifiedOntology) {
            const category = UnifiedOntology[categoryName];
            if (category.instances && Array.isArray(category.instances)) {
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
                expect(instancesDiv.children.length).toBe(category.instances.length);
            }
        }
    });

    it('should call the onTagSelect callback when a tag instance is clicked', () => {
        ontologyBrowser.render(UnifiedOntology);
        const tagInstance = document.querySelector('.ontology-instance');
        const tagData = UnifiedOntology.location.instances[0];
        const tag = new Tag(tagData, onTagSelect);
        document.body.appendChild(tag);
        tag.connectedCallback(); // Manually call connectedCallback

        tag.dispatchEvent(new Event('click'));
        expect(onTagSelect).toHaveBeenCalled();
    });
});