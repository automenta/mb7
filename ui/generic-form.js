import {createElement} from "./utils.js";
import * as Y from 'yjs';
import {YjsHelper} from '../core/yjs-helper.js';

export class GenericForm {
    constructor(schema, yDoc, objectId, saveCallback, app) { // Add app to constructor
        this.schema = schema;
        this.objectId = objectId;
        this.el = createElement("div", {class: "generic-form"});
        this.yDoc = yDoc;
        this.yMap = YjsHelper.createYMap(this.yDoc, 'data');
        this.saveCallback = saveCallback;
        this.app = app; // Store the app instance
    }

    async build() {
        this.el.innerHTML = "";
        const form = createElement("form", { className: 'generic-form-form' });

        // Load tagUIOverrides from Settings
        const tagUIOverrides = await this.loadTagUIOverrides();

        for (const property in this.schema.tags) {
            if (!this.schema.tags.hasOwnProperty(property)) continue;

            const propertySchema = this.schema.tags[property];
            const label = createElement("label", {
                for: property,
                className: 'generic-form-label'
            }, propertySchema.label || property);

            let input;

            // Apply UI overrides from settings
            const uiOverrides = tagUIOverrides[property] || {}; // Use property as the key
            const ui = { ...propertySchema.ui, ...uiOverrides };

            switch (propertySchema.type) {
                case "string":
                    input = createElement("input", {
                        type: "text",
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        placeholder: ui.placeholder || '', // Apply placeholder from UI overrides or schema
                        required: ui.required || false // Apply required from UI overrides or schema
                    });
                    break;
                case "number":
                    input = createElement("input", {
                        type: "number",
                        id: property,
                        name: property,
                        className: 'generic-form-input'
                    });
                    break;
                case "boolean":
                    input = createElement("input", {
                        type: "checkbox",
                        id: property,
                        name: property,
                        className: 'generic-form-input'
                    });
                    break;
                case "select":
                    input = createElement("select", {
                        id: property,
                        name: property,
                        className: 'generic-form-input'
                    });
                    if (propertySchema.options && Array.isArray(propertySchema.options)) {
                        propertySchema.options.forEach(option => {
                            const optionElement = createElement("option", { value: option }, option);
                            input.appendChild(optionElement);
                        });
                    }
                    break;
                case "textarea":
                    input = createElement("textarea", {
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        rows: 4 // Default rows
                    });
                    break;
                case "date":
                    input = createElement("input", {
                        type: "date",
                        id: property,
                        name: property,
                        className: 'generic-form-input'
                    });
                    break;
                default:
                    input = createElement("input", {
                        type: "text",
                        id: property,
                        name: property,
                        className: 'generic-form-input'
                    });
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

            const formGroup = createElement('div', { className: 'generic-form-group' });
            formGroup.append(label, input);
            form.appendChild(formGroup);
        }

        this.el.appendChild(form);

        // Basic Styling
        this.el.style.padding = '10px';
        this.el.style.border = '1px solid #ccc';
        this.el.style.borderRadius = '5px';

        form.style.display = 'flex';
        form.style.flexDirection = 'column';
        form.style.gap = '5px';

        return this.el;
    }

    // Load tagUIOverrides from Settings
    async loadTagUIOverrides() {
        if (!this.app || !this.app.settings) {
            console.warn("App or app settings not available.  Returning empty overrides.");
            return {};
        }
        let settings = await this.app.db.getSettings();
        return settings.tagUIOverrides || {};
    }
}
