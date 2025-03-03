/**
 * Creates the menu bar for the application.
 * @param {App} app The application instance.
 * @param {NotesView} notesView The notes view.
 * @param {FriendsView} friendsView The friends view.
 * @param {SettingsView} settingsView The settings view.
 * @param {ContentView} contentView The content view.
 * @returns {HTMLDivElement} The menu bar element.
 */
export function createMenuBar(app, notesView, friendsView, settingsView, contentView) {
    const m = document.createElement('div');
    m.classList.add('menubar-top');
    const viewMap = {
        'Notes': notesView,
        'Friends': friendsView,
        'Settings': settingsView,
        'Content': contentView
    };

    Object.entries(viewMap).forEach(([viewName, view]) => {
        const button = document.createElement('div');
        button.textContent = viewName;
        m.appendChild(button);
    });

    // Add click event listener to the menu bar
    m.addEventListener('click', (e) => {
        if (e.target instanceof HTMLDivElement) {
            const viewName = e.target.textContent;
            const view = viewMap[viewName];
            if (view) {
                app.showView(view);
            }
        }
    });
    return m;
}