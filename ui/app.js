import { FriendsView } from "./view.friends.js";
import { SettingsView } from "./view.settings.js";
import { NotesView } from './view.notes.js';
import { ContentView } from "./ui-manager.js";

document.addEventListener("DOMContentLoaded", () => {
    const appDiv = document.getElementById('app');

    const menubar = document.createElement('div');
    menubar.classList.add('menubar-top');
    menubar.innerHTML = `
        <div>Notes</div>
        <div>Friends</div>
        <div>Settings</div>
        <div>Content</div>
    `;

    const mainContent = document.createElement('main');
    mainContent.class = 'main-content';

    appDiv.appendChild(menubar);
    appDiv.appendChild(mainContent);

    const notesView = new NotesView();
    const friendsView = new FriendsView();
    const settingsView = new SettingsView();
    const contentView = new ContentView();

    function showView(view) {
        mainContent.innerHTML = '';
        if (view.build) {
            view.build();
        }
        mainContent.appendChild(view.el);
        if (view.bindEvents) {
            view.bindEvents();
        }
    }

    menubar.addEventListener('click', (e) => {
        
        if (e.target.tagName === 'DIV') {
            const viewName = e.target.innerHTML;
            if (viewName === 'Notes') {
                showView(notesView);
            } else if (viewName === 'Friends') {
                showView(friendsView);
            } else if (viewName === 'Settings') {
                showView(settingsView);
            } else if (viewName === 'Content') {
                showView(contentView);
            }
        }
    });

    showView(contentView); // Show content view by default
    contentView.render();
});

