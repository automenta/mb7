import $ from 'jquery';
export class UIComponent {
    constructor(selectorOrTemplate = "<div></div>") {
        this.el = document.createElement('div');
        this.el.innerHTML = selectorOrTemplate;
    }

    remove() {
        this.el.remove();
    }
}

/** Abstract View class for common view functionality */
export class View extends UIComponent {
    constructor(app, selectorOrTemplate) {
        super(selectorOrTemplate)
        this.app = app;
        this.build();
        this.bindEvents();
    }

    build() {
    }

    bindEvents() {
    }
}
