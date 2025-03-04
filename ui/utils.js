export const createElement = (tag, attrs = {}, text = "") => {
    const element = document.createElement(tag);
    for (const key in attrs) {
        element.setAttribute(key, attrs[key]);
    }
    element.textContent = text;
    return element;
};
