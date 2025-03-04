ui/generic-form.js
import { createElement } from '../utils.js';
import { YjsHelper } from '../yjs-helper.js';

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
            const tagDef = this.schema.tags[property];

            if (!tagDef) {
                continue;
            }
            const fieldContainer = createElement('div', {class: 'form-field'});
            const label = createElement('label', {for: property}, tagDef.label || property);
            fieldContainer.appendChild(label);

            let input;
            switch (tagDef.ui?.type) {
                case "textarea":
                    input = createElement('textarea', {id: property, name: property});
                    break;
                case "select":
                    input = document.createElement('select');
                    input.id = property;
                    input.name = property;
                    if (tagDef.ui.options) {
                        tagDef.ui.options.forEach(option => {
                            const optionElement = createElement('option', {value: option}, option);
                            input.appendChild(optionElement);
                        });
                    }
                    break;
                default:
                    input = createElement('input', {type: tagDef.type || 'text', id: property, name: property});
            }


            if (tagDef.description) {
                label.title = tagDef.description;
                input.title = tagDef.description;
            }

            fieldContainer.appendChild(input);
            form.appendChild(fieldContainer);
        }


        const saveButton = createElement('button', {type: 'submit'}, 'Save');
        form.appendChild(saveButton);

        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            await this.saveForm();
        });


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


    async saveForm() {
        const formData = {};
        for (const property in this.schema.tags) {
            formData[property] = this.el.querySelector(`#${property}`).value;
        }

        this.yDoc.transact(() => {
            for (const key in formData) {
                this.yMap.set(key, formData[key]);
            }
        });

        if (this.saveCallback) {
            await this.saveCallback(formData);
        }
    }

    render() {
        return this.el;
    }
}
