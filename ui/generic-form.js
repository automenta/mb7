import {createElement} from "./utils.js";
import * as Y from 'yjs';
import {YjsHelper} from '../../core/yjs-helper'; // Import YjsHelper

export class GenericForm {
    constructor(schema, yDoc, objectId, saveCallback) {
        this.schema = schema;
        this.objectId = objectId;
        this.el = createElement("div", {class: "generic-form"});
        this.yDoc = yDoc;
        this.yMap = YjsHelper.createYMap(this.yDoc, 'data'); // Use YjsHelper to create YMap
        this.saveCallback = saveCallback;
    }

    async build() {
        this.el.innerHTML = "";
        const form = createElement("form");

        for (const property in this.schema.tags) {
            const propertySchema = this.schema.tags[property];
            const label = createElement("label", {for: property}, property);
            let input;

            switch (propertySchema.type) {
                case "string":
                    input = createElement("input", {
                        type: "text",
                        id: property,
                        name: property,
                    });
                    break;
                case "number":
                    input = createElement("input", {
                        type: "number",
                        id: property,
                        name: property,
                    });
                    break;
                case "boolean":
                    input = createElement("input", {
                        type: "checkbox",
                        id: property,
                        name: property,
                    });
                    break;
                default:
                    input = createElement("input", {
                        type: "text",
                        id: property,
                        name: property,
                    });
            }

            //Yjs binding
            input.addEventListener('change', () => {
                const value = input.value;

                // Validate the input using the Ontology
                if (this.schema.tags[property] && this.schema.validate) {
                    const isValid = this.schema.validate({[property]: value}, 'is');
                    if (!isValid) {
                        //alert(`Invalid input for ${property}`);
                        this.el.dispatchEvent(new CustomEvent('notify', {
                            detail: {
                                message: `Invalid input for ${property}`,
                                type: 'error'
                            }
                        }));
                        return;
                    }
                }
                YjsHelper.updateYMapValue(this.yDoc, this.yMap, property, value); // Use YjsHelper to update YMap
                if (this.saveCallback) {
                    this.saveCallback();
                }
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
