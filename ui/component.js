export class UIComponent {
    constructor(selectorOrTemplate = "<div></div>") {
        this.el = document.createElement('div');
        this.el.innerHTML = selectorOrTemplate;
    }

    remove() {
        this.el.remove();
    }
}