import {createElement} from "./utils.js";
import {YjsHelper} from '../core/yjs-helper.js';
import {TagInput} from './tag-input.js'; // Import TagInput
import './edit.css'; // Import CSS for styling generic form elements (assuming styles are in edit.css)


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
        const form = createElement("form", {className: 'generic-form-form'});

        // Load tagUIOverrides from Settings
        const tagUIOverrides = await this.loadTagUIOverrides();

        for (const property in this.schema.tags) {
            if (!this.schema.tags.hasOwnProperty(property)) continue;

            const tagDef = this.schema.tags[property];
            const label = createElement("label", {
                for: property,
                className: 'generic-form-label'
            }, tagDef.label || property);

            let input;

            // Apply UI overrides from settings
            const uiOverrides = tagUIOverrides[property] || {}; // Use property as the key
            const ui = {...tagDef.ui, ...uiOverrides};

            switch (tagDef.type) {
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
                    if (tagDef.ui.options && Array.isArray(tagDef.ui.options)) {
                        tagDef.ui.options.forEach(option => {
                            const optionElement = createElement("option", {value: option}, option);
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
                    // Use TagInput for other types, passing the app instance
                    input = new TagInput(
                        tagDef,
                        this.yMap.get(property) || tagDef.default || '',
                        'is', // Default condition, can be adjusted as needed
                        (tagDefinition, condition, value) => {
                            if (value === null) {
                                this.yMap.delete(property); // Remove property if value is null (for tag removal)
                            } else {
                                this.yMap.set(property, value);
                            }
                            if (this.saveCallback) this.saveCallback();
                        },
                        this.app // Pass the app instance here
                    );
            }

            if (tagDef.type !== 'tag') { // Only append label and input for non-tag types
                const formGroup = createElement('div', {className: 'generic-form-group'});
                formGroup.append(label, input);
                form.appendChild(formGroup);
            } else {
                form.appendChild(input); // For 'tag' type, input itself is the form group
            }
        }

        this.el.appendChild(form);

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
