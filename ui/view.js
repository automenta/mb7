ui/view.js
export class View {
    constructor(app, el) {
        this.app = app;
        this.el = el;
    }

    render() {
        return this.el;
    }

    remove() {
        this.el.remove();
    }
}
