import {createElement} from "./utils.js";
import * as Y from 'yjs'

export class GenericForm {
    constructor(schema, yDoc, objectId) {
        this.schema = schema;
        this.objectId = objectId;
        this.el = createElement("div", {class: "generic-form"});
        this.yDoc = yDoc
        this.yMap = this.yDoc.getMap('data')
    }

    async build() {
        this.el.innerHTML = "";
        //const object = await this.db.get(this.objectId) || {};
        const form = createElement("form");

        for (const property in this.schema.properties) {
            const propertySchema = this.schema.properties[property];
            const label = createElement("label", {for: property}, property);
            let input;

            switch (propertySchema.type) {
                case "string":
                    input = createElement("input", {
                        type: "text",
                        id: property,
                        name: property,
                        //value: object[property] || ""
                    });
                    break;
                case "number":
                    input = createElement("input", {
                        type: "number",
                        id: property,
                        name: property,
                        //value: object[property] || ""
                    });
                    break;
                case "boolean":
                    input = createElement("input", {
                        type: "checkbox",
                        id: property,
                        name: property,
                        //checked: object[property] || false
                    });
                    break;
                default:
                    input = createElement("input", {
                        type: "text",
                        id: property,
                        name: property,
                        //value: object[property] || ""
                    });
            }

            //Yjs binding
            input.addEventListener('change', () => {
                const value = input.value;

                 // Validate the input using the Ontology
                if (this.schema.properties[property] && this.schema.validate) {
                    const isValid = this.schema.validate({[property]: value}, 'is');
                    if (!isValid) {
                        alert(`Invalid input for ${property}`);
                        return;
                    }
                }
                this.yMap.set(property, value)
            })

            if (this.yMap.has(property)) {
                input.value = this.yMap.get(property)
            } else {
                this.yMap.set(property, "")
            }

            form.append(label, input);
        }

        this.el.append(form);
        return this.el;
    }

    async bindEvents() {
    }
}