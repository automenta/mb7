import {createElement} from "./utils.js";
import {YjsHelper} from '../core/yjs-helper.js';
import {TagInput} from './tag-input.js';

export class GenericForm {
    constructor(schema, yDoc, objectId, saveCallback, app) {
        this.schema = schema;
        this.objectId = objectId;
        this.el = createElement("div", {class: "generic-form"});
        this.yDoc = yDoc;
        this.yMap = YjsHelper.createYMap(this.yDoc, 'data');
        this.saveCallback = saveCallback;
        this.app = app;
    }

    async build() {
        this.el.innerHTML = "";
        const form = createElement("form", {className: 'generic-form-form'});

        const tagUIOverrides = await this.loadTagUIOverrides();

        for (const property in this.schema.tags) {
            if (!this.schema.tags.hasOwnProperty(property)) continue;

            const tagDef = this.schema.tags[property];

            if (!tagDef) {
                console.warn(`Tag definition missing for property: ${property} in schema:`, this.schema);
                continue;
            }

            const label = createElement("label", {
                for: property,
                className: 'generic-form-label'
            }, tagDef.label || property);

            let input;
            const yjsValue = this.yMap.get(property);
            const defaultValue = tagDef.default !== undefined ? tagDef.default : '';
            const initialValue = yjsValue !== undefined ? yjsValue : defaultValue;

            const uiOverrides = tagUIOverrides[property] || {};
            const ui = {...tagDef.ui, ...uiOverrides};

            switch (tagDef.type) {
                case "string":
                    input = createElement("input", {
                        type: "text",
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        placeholder: ui.placeholder || '',
                        required: ui.required || false,
                        value: initialValue
                    });
                    break;
                case "number":
                    input = createElement("input", {
                        type: "number",
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        value: initialValue
                    });
                    break;
                case "boolean":
                    input = createElement("input", {
                        type: "checkbox",
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        checked: initialValue === true
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
                            const optionElement = createElement("option", {value: option, selected: option === initialValue}, option);
                            input.appendChild(optionElement);
                        });
                    }
                    break;
                case "textarea":
                    input = createElement("textarea", {
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        rows: 4
                    }, initialValue);
                    break;
                case "date":
                    input = createElement("input", {
                        type: "date",
                        id: property,
                        name: property,
                        className: 'generic-form-input',
                        value: initialValue
                    });
                    break;
                default:
                    input = new TagInput(
                        tagDef,
                        initialValue,
                        'is',
                        (tagDefinition, condition, value) => {
                            if (value === null) {
                                this.yMap.delete(property);
                            } else {
                                this.yMap.set(property, value);
                            }
                            if (this.saveCallback) this.saveCallback();
                        },
                        this.app
                    );
            }

            if (tagDef.type !== 'tag') {
                const formGroup = createElement('div', {className: 'generic-form-group'});
                formGroup.append(label, input);
                form.appendChild(formGroup);
            } else {
                form.appendChild(input);
            }
        }

        this.el.appendChild(form);

        return this.el;
    }

    async loadTagUIOverrides() {
        if (!this.app || !this.app.settings) {
            console.warn("App or app settings not available.  Returning empty overrides.");
            return {};
        }
        let settings = await this.app.db.getSettings();
        return settings.tagUIOverrides || {};
    }
}
