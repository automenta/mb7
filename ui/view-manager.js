export class ViewManager {
    constructor(app) {
        this.app = app;
    }

    showView(view) {
        const mainContent = document.querySelector('main');
        mainContent.innerHTML = ''; // Clear existing content
        view.build?.(); // Conditionally call build
        mainContent.appendChild(view.el);
        view.bindEvents?.(); // Conditionally call bindEvents
    }
}
