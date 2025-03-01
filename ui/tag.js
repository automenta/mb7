import {createElement} from './utils.js';

const tagDataMap = new WeakMap();

class Tag {
    constructor(tagData) {
        this.data = {...tagData, mode: tagData.mode || Object.keys(tagData.modes)[0]};
        if (["number", "range"].includes(this.data.type)) {
            if (this.data.value == null) this.data.value = 0;
            if (this.data.mode === "is between") {
                if (this.data.min == null) this.data.min = 0;
                if (this.data.max == null) this.data.max = 0;
            }
        } else if (this.data.type === "list") {
            if (this.data.value == null) this.data.value = (this.data.options && this.data.options.length) ? this.data.options[0] : "";
        } else if (this.data.type === "color") {
            if (!this.data.value) this.data.value = "#000000";
        }
        this.el = createElement("span", {class: "tag", contenteditable: "false"});
        tagDataMap.set(this.el, this.data);
        this.buildTag();
        this.updateAppearance();
    }

    buildTag() {
        this.el.innerHTML = "";
        if (this.data.emoji) {
            this.el.appendChild(createElement("span", {class: "tag-emoji"}, this.data.emoji + " "));
        }
        this.el.appendChild(document.createTextNode(this.data.name + " "));
        const modeSelect = createElement("select");
        Object.entries(this.data.modes).forEach(([value, label]) => {
            modeSelect.appendChild(new Option(label, value));
        });
        modeSelect.value = this.data.mode;
        modeSelect.addEventListener("change", () => {
            this.data.mode = modeSelect.value;
            this.buildTag();
            this.updateAppearance();
        });
        this.el.appendChild(modeSelect);
        this.buildEditingControls();
        const rmBtn = createElement("span", {class: "remove-tag"}, "x");
        rmBtn.addEventListener("click", e => {
            e.stopPropagation();
            this.el.remove();
        });
        this.el.appendChild(rmBtn);
    }

    buildEditingControls() {
        const {type, mode, unit, value, min, max, options} = this.data;
        if (["number", "range"].includes(type)) {
            if (mode === "is") {
                const inp = createElement("input", {type: "number", value: value ?? "", placeholder: "Value"});
                inp.addEventListener("input", e => {
                    const p = parseFloat(e.target.value);
                    if (!isNaN(p)) this.data.value = p;
                });
                this.el.appendChild(inp);
                if (unit) this.el.appendChild(createElement("span", {class: "unit-label"}, " " + unit));
            } else if (mode === "is between") {
                const inpMin = createElement("input", {type: "number", value: min ?? "", placeholder: "Min"});
                inpMin.addEventListener("input", e => {
                    const p = parseFloat(e.target.value);
                    this.data.min = isNaN(p) ? 0 : p;
                });
                const inpMax = createElement("input", {type: "number", value: max ?? "", placeholder: "Max"});
                inpMax.addEventListener("input", e => {
                    const p = parseFloat(e.target.value);
                    this.data.max = isNaN(p) ? 0 : p;
                });
                this.el.appendChild(inpMin);
                this.el.appendChild(document.createTextNode(" and "));
                this.el.appendChild(inpMax);
                if (unit) this.el.appendChild(createElement("span", {class: "unit-label"}, " " + unit));
            } else if (mode === "is below") {
                const inp = createElement("input", {type: "number", value: max ?? "", placeholder: "Max"});
                inp.addEventListener("input", e => {
                    const p = parseFloat(e.target.value);
                    this.data.max = isNaN(p) ? 0 : p;
                });
                this.el.appendChild(inp);
                if (unit) this.el.appendChild(createElement("span", {class: "unit-label"}, " " + unit));
            } else if (mode === "is above") {
                const inp = createElement("input", {type: "number", value: min ?? "", placeholder: "Min"});
                inp.addEventListener("input", e => {
                    const p = parseFloat(e.target.value);
                    this.data.min = isNaN(p) ? 0 : p;
                });
                this.el.appendChild(inp);
                if (unit) this.el.appendChild(createElement("span", {class: "unit-label"}, " " + unit));
            }
        } else if (type === "time") {
            if (mode === "is at") {
                const inp = createElement("input", {type: "text", value: this.data.value ?? "", placeholder: "Time"});
                inp.addEventListener("input", e => {
                    this.data.value = e.target.value;
                });
                this.el.appendChild(inp);
            } else if (mode === "is between") {
                const inpMin = createElement("input", {
                    type: "text",
                    value: this.data.min ?? "",
                    placeholder: "Start Time"
                });
                inpMin.addEventListener("input", e => {
                    this.data.min = e.target.value;
                });
                const inpMax = createElement("input", {
                    type: "text",
                    value: this.data.max ?? "",
                    placeholder: "End Time"
                });
                inpMax.addEventListener("input", e => {
                    this.data.max = e.target.value;
                });
                this.el.appendChild(inpMin);
                this.el.appendChild(document.createTextNode(" and "));
                this.el.appendChild(inpMax);
            } else if (mode === "is before") {
                const inp = createElement("input", {type: "text", value: this.data.max ?? "", placeholder: "Before"});
                inp.addEventListener("input", e => {
                    this.data.max = e.target.value;
                });
                this.el.appendChild(inp);
            } else if (mode === "is after") {
                const inp = createElement("input", {type: "text", value: this.data.min ?? "", placeholder: "After"});
                inp.addEventListener("input", e => {
                    this.data.min = e.target.value;
                });
                this.el.appendChild(inp);
            }
        } else if (type === "color") {
            const colorInput = createElement("input", {type: "color", value: this.data.value});
            const preview = createElement("span", {class: "color-preview"});
            preview.style.backgroundColor = this.data.value;
            colorInput.addEventListener("input", e => {
                this.data.value = e.target.value;
                preview.style.backgroundColor = e.target.value;
            });
            this.el.appendChild(colorInput);
            this.el.appendChild(preview);
        } else if (type === "list") {
            const sel = createElement("select");
            (options || []).forEach(opt => sel.appendChild(new Option(opt, opt)));
            sel.value = this.data.value;
            sel.addEventListener("change", () => {
                this.data.value = sel.value;
            });
            this.el.appendChild(sel);
        } else if (type === "location") {
            const locInp = createElement("input", {
                type: "text",
                value: this.data.value ? `${this.data.value.lat}, ${this.data.value.lng}` : "",
                placeholder: "Lat, Lng"
            });
            locInp.addEventListener("input", e => {
                const [latStr, lngStr] = e.target.value.split(",").map(s => s.trim());
                const lat = parseFloat(latStr), lng = parseFloat(lngStr);
                if (!isNaN(lat) && !isNaN(lng)) this.data.value = {lat, lng};
            });
            this.el.appendChild(locInp);
        }
    }

    updateAppearance() {
        const nonConditional = ["is", "is at", "is one of"];
        this.el.classList.toggle("conditional", !nonConditional.includes(this.data.mode));
    }

    getElement() {
        return this.el;
    }
}

export {Tag};