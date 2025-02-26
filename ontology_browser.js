import {UIComponent} from "./view.js";
import {TagOntology} from './ontology.js';

class OntologyBrowser extends UIComponent {
    constructor(onTagSelect) {
        super(`<div id="ontology-browser"></div>`);
        this.onTagSelect = onTagSelect;
        this.build();
        this.hide();
    }

    build() {
        Object.keys(TagOntology).forEach(cat => {
            const catDiv = document.createElement("div");
            catDiv.className = "category";
            catDiv.textContent = cat;
            TagOntology[cat].forEach(tagData => {
                const label = (tagData.emoji ? tagData.emoji + " " : "") + tagData.name;
                const tagItem = document.createElement("div");
                tagItem.className = "tag-item";
                tagItem.textContent = label;
                tagItem.onclick = () => {
                    this.onTagSelect(tagData);
                    this.hide();
                };
                catDiv.appendChild(tagItem);
            });
            this.$el[0].appendChild(catDiv);
        });
    }

    show() {
        this.$el.show();
    }

    hide() {
        this.$el.hide();
    }
}

export {OntologyBrowser};