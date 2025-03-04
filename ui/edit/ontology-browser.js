import { createElement } from '../utils.js';

export class OntologyBrowser {
    constructor(editor, onTagSelect) {
        this.editor = editor;
        this.onTagSelect = onTagSelect;
        this.container = createElement("div", {class: "ontology-browser"});
    }

    render(ontology) {
        this.container.innerHTML = "";
        for (const categoryName in ontology) {
            const category = ontology[categoryName];
            const categoryDiv = createElement("div", {class: "ontology-category"});
            categoryDiv.append(createElement("h3", {}, categoryName));
            const instancesDiv = createElement("div", {class: "ontology-instances"});
            if (category.tags && Array.isArray(category.tags)) {
                for (const tagName in category.tags) {
                    const tag = category.tags[tagName];
                    const tagElement = createElement("div", {class: "ontology-tag"}, tagName);
                    tagElement.addEventListener('click', () => {
                        this.onTagSelect(tagName);
                        this.editor.insertTag(tagName);
                    });
                    instancesDiv.append(tagElement);
                }
            }
            categoryDiv.append(instancesDiv);
            this.container.append(categoryDiv);
        }
        return this.container;
    }
}
