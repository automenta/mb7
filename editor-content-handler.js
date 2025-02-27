import {createElement} from './utils.js';

class EditorContentHandler {
    constructor(editor) {
        this.editor = editor;
        this.lastValidRange = null; // Store the last valid range within the editor for handling tag insertions
    }

    insertLineBreak() {
        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        range.deleteContents();
        range.insertNode(createElement("br"));

        const newRange = document.createRange();
        newRange.setStartAfter(range.endContainer.lastChild);
        newRange.collapse(true);

        selection.removeAllRanges();
        selection.addRange(newRange);
        this.lastValidRange = selection.getRangeAt(0).cloneRange(); // Save range for future tag insertions
    }


    insertTagAtSelection(tag) {
        const editorArea = this.editor.editorArea;

        // 1. Get the current selection, or use the last known valid range
        const selection = window.getSelection();
        let range;

        if (selection.rangeCount > 0 && editorArea.contains(selection.anchorNode)) {
            // If there's a valid selection within the editor, use it
            range = selection.getRangeAt(0);
            this.lastValidRange = range.cloneRange(); // Store this range as the last valid one
        } else if (this.lastValidRange) {
            // If no current selection, but a valid range was previously stored, use that
            range = this.lastValidRange.cloneRange();
        } else {
            // If no selection and no stored range, default to the end of the editor content
            range = document.createRange();
            range.selectNodeContents(editorArea);
            range.collapse(false); // Collapse to the end
        }

        // 2. Ensure the editorArea has focus before manipulating selections
        editorArea.focus();

        // 3. Restore the selection based on the determined range - crucial to apply focus
        selection.removeAllRanges();
        selection.addRange(range);

        // 4. Insert the tag at the current selection
        range.deleteContents(); // Remove selected content, if any
        range.insertNode(tag.el); // Insert the tag element

        // 5. Adjust the cursor position after the inserted tag
        range.setStartAfter(tag.el);
        range.collapse(true); // Collapse to the new position

        // 6. Update the selection with the new range
        selection.removeAllRanges();
        selection.addRange(range);
        this.lastValidRange = range.cloneRange();  // Update the last valid range

        // 7. Trigger autosuggest to update suggestions based on changes
        this.editor.autosuggest.apply(); // Refresh suggestions
    }


    insertTagFromSuggestion(suggestion) {
        if (!suggestion?.span) return;
        const newTag = new InlineTag(suggestion.tagData, () => this.editor.autosuggest.apply());
        suggestion.span.replaceWith(newTag.el);
        this.editor.autosuggest.apply(); //apply after insertion
    }

    serialize() {
        const clonedEditor = this.editor.editorArea.cloneNode(true);
        clonedEditor.querySelectorAll(".inline-tag").forEach(tagEl => {
            const tagData = tagDataMap.get(tagEl);
            if (tagData) {
                tagEl.replaceWith(`[TAG:${JSON.stringify(tagData)}]`);
            }
        });
        return clonedEditor.innerHTML.replace(/<br\s*\/?>/g, "\n");
    }

    deserialize(text) {
        this.editor.editorArea.innerHTML = "";
        const tagRegex = /\[TAG:(.*?)\]/g;

        let lastIndex = 0;
        let match;
        while ((match = tagRegex.exec(text)) !== null) {
            if (match.index > lastIndex) {
                this.editor.editorArea.append(text.substring(lastIndex, match.index));
            }
            try {
                const tagData = JSON.parse(match[1]);
                const tag = new InlineTag(tagData, () => this.editor.autosuggest.apply());
                this.editor.editorArea.append(tag.el);
            } catch (error) {
                console.warn("Failed to parse tag data:", error);
                this.editor.editorArea.append(match[0]);
            }
            lastIndex = tagRegex.lastIndex;
        }

        if (lastIndex < text.length) {
            this.editor.editorArea.append(text.substring(lastIndex));
        }
    }
}

const tagDataMap = new WeakMap();

export class InlineTag {
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
        this.el.append(createElement("input", {
            type: "number",
            placeholder: ph,
            value: inputValue,
            oninput: (e) => onValueChange(parseFloat(e.target.value) || "")
        }));
        this.numberInput("Value", this.tag.data.value, v => this.tag.data.value = v);
    }
}

class NumberInputRenderer extends TagRenderer {
    append() {
        const {unit, value, min, max} = this.tag.data;
        const numberInput = (ph, val, onValueChange) => this.el.append(createElement("input", {
            type: "number",
            placeholder: ph,
            value: val,
            oninput: (e) => onValueChange(parseFloat(e.target.value) || "")
        }));

        switch (this.tag.data.condition) {
            case "is":
                numberInput("Value", value, v => this.tag.data.value = v);
                break;
            case "is between":
                numberInput("Min", min, v => this.tag.data.min = v);
                this.el.append(" and ");
                numberInput("Max", max, v => this.tag.data.max = v);
                break;
            case "is below":
                numberInput("Max", max, v => this.tag.data.max = v);
                break;
            case "is above":
                numberInput("Min", min, v => this.tag.data.min = v);
                break;
        }
        if (unit) this.el.append(createElement("span", {class: "unit-label"}, ` ${unit}`));
    }
}

class TimeInputRenderer extends TagRenderer {
    append() {
        const {value, min, max} = this.tag.data;
        const timeInput = (ph, val, onValueChange) => this.el.append(createElement("input", {
            type: "text",
            placeholder: ph,
            value: val,
            oninput: (e) => onValueChange(e.target.value)
        }));

        switch (this.tag.data.condition) {
            case "is at":
                timeInput("Time", value, v => this.tag.data.value = v);
                break;
            case "is between":
                timeInput("Start Time", min, v => this.tag.data.min = v);
                this.el.append(" and ");
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
                const colorInput = createElement("input", {
                    type: "color", value: value, oninput: (e) => {
                        this.tag.data.value = e.target.value;
                        preview.style.backgroundColor = e.target.value;
                        this.tag.onUpdate?.();
                    }
                });
                const preview = createElement("span", {class: "color-preview"});
                preview.style.backgroundColor = value;
                this.el.append(colorInput, preview);
                break;

            case "location":
                this.el.append(createElement("input", {
                    type: "text",
                    placeholder: "Lat, Lng",
                    value: this.tag.data.value ? `${this.tag.data.value.lat}, ${this.tag.data.value.lng}` : "",
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

export {EditorContentHandler};