export const createElement = (tag, attrs = {}, text = "") => {
    const el = document.createElement(tag);
    for (const key in attrs) {
        if (key.startsWith("on") && typeof attrs[key] === "function") {
            el.addEventListener(key.substring(2).toLowerCase(), attrs[key]);
        } else {
            el.setAttribute(key, attrs[key]);
        }
    }
    el.textContent = text;
    return el;
};
