import {View} from "./view.js";
import {GenericForm} from "./generic-form.js";
import {Ontology} from "../core/ontology.js";
import { createElement } from '../utils.js';

export class SettingsView extends View {
    constructor(app, db, nostr) {
        super(app, `<div id="settings-view" class="view"><h2>Settings</h2></div>`);
        this.app = app;
        this.db = db;
        this.nostr = nostr;
    }

    async build() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }

        const settingsObjectId = 'settings';
        let settingsObject = await this.db.get(settingsObjectId);
        let yDoc = await this.db.getYDoc(settingsObjectId);

        if (!yDoc) {
            settingsObject = {
                id: settingsObjectId,
                name: "Settings",
            };
            await this.db.saveObject(settingsObject);
            yDoc = new Y.Doc()
        }

        // Use the Settings ontology to build the form
        const settingsOntology = Ontology.Settings;
        if (settingsOntology && settingsOntology.tags) {
            for (const property in settingsOntology.tags) {
                const settingDefinition = settingsOntology.tags[property];
                const label = createElement("label", {for: property}, settingDefinition.label || property);
                let input;

                switch (settingDefinition.type) {
                    case "string":
                        input = createElement("input", {
                            type: "text",
                            id: property,
                            name: property,
                            value: this.app.settings[property] || settingDefinition.default || ''
                        });
                        break;
                    case "number":
                        input = createElement("input", {
                            type: "number",
                            id: property,
                            name: property,
                            value: this.app.settings[property] || settingDefinition.default || ''
                        });
                        break;
                    case "boolean":
                        input = createElement("input", {
                            type: "checkbox",
                            id: property,
                            name: property,
                            checked: this.app.settings[property] || settingDefinition.default || false
                        });
                        break;
                    case "select":
                        input = createElement("select", {
                            id: property,
                            name: property,
                        });
                        if (settingDefinition.options && Array.isArray(settingDefinition.options)) {
                            settingDefinition.options.forEach(option => {
                                const optionElement = createElement("option", {value: option}, option);
                                input.appendChild(optionElement);
                            });
                            input.value = this.app.settings[property] || settingDefinition.default || settingDefinition.options[0];
                        }
                        break;
                    default:
                        input = createElement("input", {
                            type: "text",
                            id: property,
                            name: property,
                            value: this.app.settings[property] || settingDefinition.default || ''
                        });
                }

                // Add description if available
                if (settingDefinition.description) {
                    const description = createElement("p", {class: "setting-description"}, settingDefinition.description);
                    this.el.appendChild(description);
                }

                this.el.appendChild(label);
                this.el.appendChild(input);
            }
        }

        const saveButton = createElement("button", {id: "save-settings-btn"}, "Save Settings");
        this.el.appendChild(saveButton);
        saveButton.addEventListener("click", () => this.saveSettings());
    }

    async bindEvents() {
        // No need to bind events for GenericForm, as it's not used anymore
    }

    async saveSettings() {
        const settings = {};
        const settingsOntology = Ontology.Settings;

        if (settingsOntology && settingsOntology.tags) {
            for (const property in settingsOntology.tags) {
                const settingDefinition = settingsOntology.tags[property];
                const inputElement = this.el.querySelector(`#${property}`);

                if (inputElement) {
                    switch (settingDefinition.type) {
                        case "string":
                            settings[property] = inputElement.value;
                            break;
                        case "number":
                            settings[property] = parseFloat(inputElement.value);
                            break;
                        case "boolean":
                            settings[property] = inputElement.checked;
                            break;
                        case "select":
                            settings[property] = inputElement.value;
                            break;
                        default:
                            settings[property] = inputElement.value;
                    }
                }
            }
        }

        await this.app.settingsManager.saveSettings(settings);
        this.app.settings = settings;
        this.app.nostr.nostrRelays = settings.nostrRelays;
        this.app.nostr.nostrPrivateKey = settings.nostrPrivateKey;
        await this.app.nostr.connectToRelays();
        this.app.showNotification('Settings saved');
    }
}
