import { getTagDefinition } from "./ontology.js";

export function extractTags(html) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tagElements = Array.from(doc.querySelectorAll(".inline-tag"));

    return tagElements.map(el => {
        const name = el.querySelector(".tag-name").textContent.trim();
        const condition = el.querySelector(".tag-condition").value;
        const tagDef = getTagDefinition(name);

        const value = extractTagValue(el, condition, tagDef);

        return { name, condition, value };
    });
}

const extractTagValue = (el, condition, tagDef) => {
    const valueElements = el.querySelectorAll(".tag-value");

    switch (true) {
        case condition === "between" && tagDef.name === "time":
            return {
                start: valueElements[0]?.value ?? undefined,
                end: valueElements[1]?.value ?? undefined
            };
        case condition === "between" && tagDef.name === "number":
            return {
                lower: valueElements[0]?.value ?? undefined,
                upper: valueElements[1]?.value ?? undefined
            };
        default:
            return valueElements[0]?.value ?? undefined;
    }
}