import {createElement} from '../../ui/utils.js';
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
            if (category.tags && Array.isArray(category.tags)) {
                for (const tagName in category.tags) {
                    const tag = category.tags[tagName];
                    const instanceButton = createElement("button", {
                        title: `Add tag ${tag.label}`,
                        onclick: () => {
                            this.onTagSelect(tag);
                        }
                    }, tag.label);
                    instancesDiv.append(instanceButton);
                }
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
