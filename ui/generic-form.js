import {createElement} from "./utils.js";
import {YjsHelper} from '../core/yjs-helper.js';
import {TagInput} from './tag-input.js'; // Import TagInput


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

            if (!tagDef) {
                console.warn(`Tag definition missing for property: ${property} in schema:`, this.schema);
                continue; // Skip to the next property if tagDef is missing
            }

            const label = createElement("label", {
                for: property,
                className: 'generic-form-label'
            }, tagDef.label || property);

            let input;
            const yjsValue = this.yMap.get(property);
            const defaultValue = tagDef.default !== undefined ? tagDef.default : ''; // Use default if defined, otherwise empty string
            const initialValue = yjsValue !== undefined ? yjsValue : defaultValue; // Prioritize Yjs value, then default

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
                        required: ui.required || false, // Apply required from UI overrides or schema
                        value: initialValue // Set initial value
                    });
                    break;
                case "number":
                    input = createElement("input", {
                        type: "number",
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        value: initialValue // Set initial value
                    });
                    break;
                case "boolean":
                    input = createElement("input", {
                        type: "checkbox",
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        checked: initialValue === true // Handle boolean default/Yjs value
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
                            const optionElement = createElement("option", {value: option, selected: option === initialValue}, option); // Set selected option
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
                    }, initialValue); // Set initial value for textarea
                    break;
                case "date":
                    input = createElement("input", {
                        type: "date",
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        value: initialValue // Set initial value
                    });
                    break;
                default:
                    // Use TagInput for other types, passing the app instance
                    input = new TagInput(
                        tagDef,
                        initialValue, // Use initial value for TagInput
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
