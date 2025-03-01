import { createElement } from './utils.js';
import { InlineTag } from "./edit.content";

class OntologyBrowser {
    constructor(ontology, onTagSelect) {
        this.ontology = ontology;
        this.onTagSelect = onTagSelect;
        this.el = createElement("div", { class: "ontology-browser" });
        this.build();
    }

    build() {
        this.el.innerHTML = "";
        Object.entries(this.ontology).forEach(([key, value]) => {
            const categoryDiv = createElement("div", { class: "category" }, key);
            if (value.instances) {
                value.instances.forEach(tagData =>
                    categoryDiv.append(
                        createElement("div", {
                            class: "tag-item",
                            onclick: () => this.onTagSelect(new InlineTag(tagData, this.onTagSelect)),
                        }, `${tagData.emoji || ""} ${tagData.name}`)
                    )
                );
            } else {
                // Handle cases where there are no instances, e.g., string, number
                // You might want to display a default tag or a message indicating no specific instances
                categoryDiv.append(
                    createElement("div", { class: "tag-item" }, '')
                );
            }
            this.el.append(categoryDiv);
        });
    }

    show() {
        this.el.style.display = "block";
    }

    hide() {
        this.el.style.display = "none";
    }

    getElement() {
        return this.el;
    }
}


export { OntologyBrowser };