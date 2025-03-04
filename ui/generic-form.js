import {createElement} from "./utils.js";
import * as Y from 'yjs';
import {YjsHelper} from '../../core/yjs-helper';

export class GenericForm {
    constructor(schema, yDoc, objectId, saveCallback) {
        this.schema = schema;
        this.objectId = objectId;
        this.el = createElement("div", {class: "generic-form"});
        this.yDoc = yDoc;
        this.yMap = YjsHelper.createYMap(this.yDoc, 'data');
        this.saveCallback = saveCallback;
    }

    async build() {
        this.el.innerHTML = "";
        const form = createElement("form");
        for (const property in this.schema.tags) {
            const propertySchema = this.schema.tags[property];
            const label = createElement("label", {for: property}, propertySchema.label || property);
            let input;
            switch (propertySchema.type) {
                case "string":
                    input = createElement("input", { type: "text", id: property, name: property });
                    break;
                case "number":
                    input = createElement("input", { type: "number", id: property, name: property });
                    break;
                case "boolean":
                    input = createElement("input", { type: "checkbox", id: property, name: property });
                    break;
                case "select":
                    input = createElement("select", { id: property, name: property });
                    if (propertySchema.options && Array.isArray(propertySchema.options)) {
                        propertySchema.options.forEach(option => {
                            const optionElement = createElement("option", {value: option}, option);
                            input.appendChild(optionElement);
                        });
                    }
                    break;
                default:
                    input = createElement("input", { type: "text", id: property, name: property });
            }
            input.addEventListener('change', () => {
                let value = input.type === 'checkbox' ? input.checked : input.value;
                if (propertySchema && propertySchema.validate) {
                    const isValid = propertySchema.validate(value, 'is');
                    if (!isValid) {
                        this.el.dispatchEvent(new CustomEvent('notify', { detail: { message: `Invalid input for ${propertySchema.label || property}`, type: 'error' } }));
                        return;
                    }
                }
                YjsHelper.updateYMapValue(this.yDoc, this.yMap, property, value);
                if (this.saveCallback) this.saveCallback();
            });
            let initialValue = this.yMap.has(property) ? this.yMap.get(property) : propertySchema.default;
            if (initialValue !== undefined) {
                if (input.type === 'checkbox') {
                    input.checked = initialValue;
                } else {
                    input.value = initialValue;
                }
            } else {
                if (propertySchema.type === 'boolean') this.yMap.set(property, false);
                else this.yMap.set(property, "");
            }
            form.append(label, input);
        }
        this.el.append(form);
        return this.el;
    }
}
