import {createElement} from './utils.js';

class TagRenderer {
    constructor(tag) {
        this.tag = tag;
    }

    append() {
    }
}

class Tag extends HTMLElement {
    constructor(tagData, onUpdate) {
        super();
        this.data = this.normalizeTagData(tagData);
        this.onUpdate = onUpdate;
        this.tagDataMap = new WeakMap();
        this.tagDataMap.set(this, this.data);

        this.renderers = [
            new TagMetadataRenderer(this),
            new TagConditionRenderer(this),
            new TagValueRenderer(this),
            new TagRemoveButtonRenderer(this),
        ];
    }

    connectedCallback() {
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
        this.innerHTML = "";
        this.renderers.forEach(renderer => renderer.append());
        this.updateAppearance();
    }

    updateAppearance() {
        this.classList.toggle("conditional", !(["is", "is at", "is one of"].includes(this.data.condition)));
    }

    remove() {
        this.parentNode.removeChild(this);
    }
}

class TagMetadataRenderer extends TagRenderer {
    append() {
        const {emoji, name} = this.tag.data;
        this.tag.append(emoji ? createElement("span", {class: "tag-emoji"}, `${emoji} `) : "", name + " ");
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
        this.tag.append(select);
    }
}

class NumberInputRenderer extends TagRenderer {
    numberInput(ph, inputValue, onValueChange) {
        const input = createElement("input", {
            type: "number",
            placeholder: ph,
            value: inputValue,
            oninput: (e) => onValueChange(parseFloat(e.target.value) || "")
        });
        this.tag.append(input);
    }

    append() {
        const {unit, value, min, max} = this.tag.data;

        switch (this.tag.data.condition) {
            case "is":
                this.numberInput("Value", value, v => this.tag.data.value = v);
                break;
            case "is between":
                this.numberInput("Min", min, v => this.tag.data.min = v);
                this.tag.append(" and ");
                this.numberInput("Max", max, v => this.tag.data.max = v);
                break;
            case "is below":
                this.numberInput("Max", max, v => this.tag.data.max = v);
                break;
            case "is above":
                this.numberInput("Min", min, v => this.tag.data.min = v);
                break;
        }
        if (unit) {
            this.tag.append(createElement("span", {class: "unit-label"}, ` ${unit}`));
        }
    }
}


class TimeInputRenderer extends TagRenderer {
    append() {
        const {value, min, max} = this.tag.data;
        const timeInput = (ph, val, onValueChange) => {
            const input = createElement("input", {
                type: "text",
                placeholder: ph,
                value: val,
                oninput: (e) => onValueChange(e.target.value)
            });
            this.tag.append(input);
        };

        switch (this.tag.data.condition) {
            case "is at":
                timeInput("Time", value, v => this.tag.data.value = v);
                break;
            case "is between":
                timeInput("Start Time", min, v => this.tag.data.min = v);
                this.tag.append(" and ");
                timeInput("End Time", max, v => this.tag.data.max = v);
                break;
            case "is before":
                timeInput("Before", max, v => this.tag.data.max = v);
                break;
            case "is after":
                timeInput("After", min, v => this.tag.data.min = v);
                break;
        }
    }
}

class TagValueRenderer extends TagRenderer {
    append() {
        const {type, condition, options, value} = this.tag.data;

        switch (type) {
            case "number":
            case "range":
                new NumberInputRenderer(this.tag, this.tag.data, condition).append();
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
                this.tag.append(select);
                break;

            case "color":
                const colorInput = createElement("input", {
                    type: "color", value: value, oninput: (e) => {
                        this.tag.data.value = e.target.value;
                        //preview.style.backgroundColor = e.target.value;
                        this.tag.onUpdate?.();
                    }
                });
                const preview = createElement("span", {class: "color-preview"});
                preview.style.backgroundColor = value;
                this.tag.append(colorInput, preview);
                break;

            case "location":
                this.tag.append(createElement("input", {
                    type: "text",
                    placeholder: "Lat, Lng",
                    value: this.tag.data.value ? `${this.tag.data.value.lat}, ${this.tag.data.value.lng}` : "",
                    oninput: (e) => {
                        const [latStr, lngStr] = e.target.value.split(",").map(s => s.trim());
                        const lat = parseFloat(latStr);
                        const lng = parseFloat(lngStr);
                        this.tag.data.value = (!isNaN(lat) && !isNaN(lng)) ? {lat, lng} : null;
                        this.tag.onUpdate?.();
                    }
                }));
                break;

            case "time":
                new TimeInputRenderer(this.tag, this.tag.data, condition).append();
                break;

            default:
                this.tag.append(createElement("span", {}, value));
        }
    }
}

class TagRemoveButtonRenderer extends TagRenderer {
    append() {
        const removeButton = createElement("span", {
            class: "tag-remove", onclick: e => {
                e.stopPropagation();
                this.tag.remove();
                this.tag.onUpdate?.();
            }
        }, "x");
        this.tag.append(removeButton);
    }
}

if (!customElements.get('gra-tag')) {
    customElements.define('gra-tag', Tag);
}

export {Tag};