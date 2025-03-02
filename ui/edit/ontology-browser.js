import {createElement} from '../utils';
import {Tag} from '../tag.js';

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

            if (category.instances && Array.isArray(category.instances)) {
                category.instances.forEach(tagData => {
                    const tagElement = document.createElement('span');
                    tagElement.classList.add('ontology-instance');
                    tagElement.textContent = `${tagData.emoji || ""} ${tagData.name}`;
                    tagElement.onclick = () => this.onTagSelect(new Tag(tagData, this.onTagSelect));
                    instancesDiv.append(tagElement);
                });
            } else {
                // Render the category itself as a tag
                const tagElement = document.createElement('span');
                tagElement.classList.add('ontology-instance');
                tagElement.textContent = `${category.emoji || ""} ${categoryName}`;
                tagElement.onclick = () => this.onTagSelect(new Tag(category, this.onTagSelect));
                instancesDiv.append(tagElement);
            }

            categoryDiv.append(instancesDiv);
            this.container.append(categoryDiv);
        }
        return this.container;
    }

    getElement() {
        return this.container;
    }
}