import {createElement} from './utils';
import {createMenuBar} from './menu-bar.js';

function createAppMainContent() {
    const mainContent = createElement('main', {id: 'main-content'});
    return mainContent;
}

function createLayout(appDiv, noteView, friendsView, settingsView, contentView, store) {
    const menubar = createMenuBar(noteView, friendsView, settingsView, contentView, store);
    const mainContent = createAppMainContent();

    appDiv.appendChild(menubar);
    appDiv.appendChild(mainContent);
    //appDiv.appendChild(app.elements.notificationArea); // Access to app removed
    return {menubar, mainContent};
}

export {createAppMainContent, createLayout};
