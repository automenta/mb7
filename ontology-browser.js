import { createElement } from './utils.js';

class InputCreator {
    static create(type, placeholder, value, onChange, extraAttrs = {}) {
        return createElement("input", {
            type, placeholder, value, ...extraAttrs,
            oninput: (e) => onChange(type === "number" ? (parseFloat(e.target.value) || "") : e.target.value)
        });
    }
}


class OntologyBrowser {
    constructor(ontology, onTagSelect) {
        this.ontology = ontology;
        this.onTagSelect = onTagSelect;
        this.el = createElement("div", {id: "ontology-browser", class: "ontology-browser"});
        this.build();
    }

    build() {
        this.el.innerHTML = "";
        Object.entries(this.ontology).forEach(([key, value]) => {
            const categoryDiv = createElement("div", {class: "category"}, key);
            if (value.instances) {
                value.instances.forEach(tagData =>
                    categoryDiv.append(
                        createElement("div", {
                            class: "tag-item",
                            onclick: () => this.onTagSelect(new InlineTag(tagData, this.onTagSelect)),
                        }, `${tagData.emoji || ""} ${tagData.name}`)
                    )
                );
            } else {
                // Handle cases where there are no instances, e.g., string, number
                // You might want to display a default tag or a message indicating no specific instances
                categoryDiv.append(
                    createElement("div", {class: "tag-item"}, '')
                );
            }
            this.el.append(categoryDiv);
        });
    }

    show() {
        this.el.style.display = "block";
    }

    hide() {
        this.el.style.display = "none";
    }

    getElement() {
        return this.el;
    }
}

class InlineTag {
    constructor(tagData, onUpdate) {
        this.data = this.normalizeTagData(tagData);
        this.onUpdate = onUpdate;
        this.el = createElement("span", {class: "inline-tag", contenteditable: "false"});
        tagDataMap.set(this.el, this.data);
        this.renderers = [
            new TagMetadataRenderer(this),
            new TagConditionRenderer(this),
            new TagValueRenderer(this),
            new TagRemoveButtonRenderer(this),
        ];
        this.render();
    }

    normalizeTagData(tagData) {
        const data = {
            ...tagData,
            condition: tagData.condition || Object.keys(tagData.conditions)[0],
        };
        const {type, condition} = data;
        data.value ??= (type === "list") ? (data.options?.[0] || "") : (type === "color" ? "#000000" : "");
        if (condition === "is between") {
            data.min ??= 0;
            data.max ??= 0;
        }
        return data;
    }

    render() {
        this.el.innerHTML = "";
        this.renderers.forEach(renderer => renderer.append());
        this.updateAppearance();
    }

    updateAppearance() {
        this.el.classList.toggle("conditional", !(["is", "is at", "is one of"].includes(this.data.condition)));
    }

    remove() {
        this.el.remove();
    }
}

const tagDataMap = new WeakMap();

class TagRenderer {
    constructor(tag) {
        this.tag = tag;
        this.el = tag.el;
    }

    append() {
    }
}

class TagMetadataRenderer extends TagRenderer {
    append() {
        const {emoji, name} = this.tag.data;
        this.el.append(emoji ? createElement("span", {class: "tag-emoji"}, `${emoji} `) : "", name + " ");
    }
}

class TagConditionRenderer extends TagRenderer {
    append() {
        const {conditions, condition} = this.tag.data;
        const select = createElement("select", {
            class: "tag-condition",
            onchange: () => {
                this.tag.data.condition = select.value;
                this.tag.render();
                this.tag.onUpdate?.();
            },
        });
        for (const [value, label] of Object.entries(conditions)) {
            select.add(new Option(label, value));
        }
        select.value = condition;
        this.el.append(select);
    }

    numberInput(ph, inputValue, onValueChange) {
         this.el.append(createElement("input", {type: "number", placeholder: ph, value: inputValue, oninput: (e) => onValueChange(parseFloat(e.target.value) || "")}));
         this.numberInput("Value", this.tag.data.value, v => this.tag.data.value = v);
    }
}




class NumberInputRenderer extends TagRenderer {
    numberInput(ph, inputValue, onValueChange) {
        this.el.append(createElement("input", {type: "number", placeholder: ph, value: inputValue, oninput: (e) => onValueChange(parseFloat(e.target.value) || "")}));
    }
    append() {
        const {condition} = this.tag.data;
        switch (condition) {
            case "is":
                this.numberInput("Value", this.tag.data.value, v => this.tag.data.value = v);
                break;
            case "is between":
                this.numberInput("Min", this.tag.data.min, v => this.tag.data.min = v);
                this.el.append(" and ");
                this.numberInput("Max", this.tag.data.max, v => this.tag.data.max = v);
                break;
            case "is below":
                this.numberInput("Max", this.tag.data.max, v => this.tag.data.max = v);
                break;
            case "is above":
                this.numberInput("Min", this.tag.data.min, v => this.tag.data.min = v);
                break;
        }
        if (this.tag.data.unit) {
            this.el.append(createElement("span", {class: "unit-label"}, ` ${this.tag.data.unit}`));
        }
    }
}




class TimeInputRenderer extends TagRenderer {
    append() {        
        const timeInput = (ph, val, onValueChange) => this.el.append(createElement("input", {type: "text", placeholder: ph, value: val, oninput: (e) => onValueChange(e.target.value)}));
    }
}


class TagValueRenderer extends TagRenderer {
    append() {
        const {type, condition, options, value} = this.tag.data;

        switch (type) {
            case "number":
            case "range":
                new NumberInputRenderer(this, this.tag.data, condition).append();
                break;

            case "list":
                const select = createElement("select", {
                    onchange: () => {
                        this.tag.data.value = select.value;
                        this.tag.onUpdate?.();
                    }
                });
                (options || []).forEach(opt => select.add(new Option(opt, opt)));
                select.value = value;
                this.el.append(select);
                break;

            case "color":
                const colorInput = createElement("input", {type: "color", value: value, oninput: (e) => {
                    this.tag.data.value = e.target.value;
                    preview.style.backgroundColor = e.target.value;
                    this.tag.onUpdate?.();
                }});
                const preview = createElement("span", {class: "color-preview"});
                preview.style.backgroundColor = value;
                this.el.append(colorInput, preview);
                break;

            case "location":
                this.el.append(createElement("input", {type: "text", placeholder: "Lat, Lng", value: this.tag.data.value ? `${this.tag.data.value.lat}, ${this.tag.data.value.lng}` : "",
                    oninput: (e) => {
                        const [latStr, lngStr] = e.target.value.split(",").map(s => s.trim());
                        const [lat, lng] = [parseFloat(latStr), parseFloat(lngStr)];
                        this.tag.data.value = (!isNaN(lat) && !isNaN(lng)) ? {lat, lng} : null;
                        this.tag.onUpdate?.();
                    }
                }));
                break;

            case "time":
                new TimeInputRenderer(this, this.tag.data, condition).append();
                break;

            default:
                this.el.append(createElement("span", {}, value));
        }
    }
}

class TagRemoveButtonRenderer extends TagRenderer {
    append() {
        this.el.append(
            createElement("span", {
                class: "tag-remove", onclick: e => {
                    e.stopPropagation();
                    this.tag.remove();
                    this.tag.onUpdate?.();
                }
            }, "x")
        );
    }
}


export {OntologyBrowser};