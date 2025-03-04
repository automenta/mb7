import {createElement} from './utils';
import {createMenuBar} from './menu-bar.js';

function createAppMainContent() {
    return createElement('main', {id: 'main-content'});
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
