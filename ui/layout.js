import { createElement } from './utils';

function createAppMainContent() {
    const mainContent = createElement('main', {id: 'main-content'});
    return mainContent;
}

function createLayout(app, appDiv, noteView, friendsView, settingsView, contentView) {
    const menubar = createMenuBar(app, noteView, friendsView, settingsView, contentView);
    const mainContent = createAppMainContent();

    appDiv.appendChild(menubar);
    appDiv.appendChild(mainContent);
    appDiv.appendChild(app.elements.notificationArea);
    return {menubar, mainContent};
}

export { createAppMainContent, createLayout };
