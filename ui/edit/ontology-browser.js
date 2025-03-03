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
                category.instances.forEach(instance => {
                    const instanceButton = createElement("button", {
                       title: `Add tag ${instance.name}`,
                        onclick: () => {
                            this.onTagSelect(instance.name);
                        }
                    }, instance.name);
                    instancesDiv.append(instanceButton);
                });
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
