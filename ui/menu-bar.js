export function createMenuBar(app, notesView, friendsView, settingsView, contentView) {
    const menubar = document.createElement('div');
    menubar.classList.add('menubar-top');
    const notesButton = document.createElement('div');
    notesButton.textContent = 'Notes';
    const friendsButton = document.createElement('div');
    friendsButton.textContent = 'Friends';
    const settingsButton = document.createElement('div');
    settingsButton.textContent = 'Settings';
    const contentButton = document.createElement('div');
    contentButton.textContent = 'Content';
    menubar.appendChild(notesButton);
    menubar.appendChild(friendsButton);
    menubar.appendChild(settingsButton);
    menubar.appendChild(contentButton);

    menubar.addEventListener('click', (e) => {
        if (e.target.tagName === 'DIV') {
            const viewName = e.target.textContent;
            const viewMap = {
                'Notes': notesView,
                'Friends': friendsView,
                'Settings': settingsView,
                'Content': contentView
            };
            const view = viewMap[viewName];
            if (view) {
                app.showView(view);
            }
        }
    });

    return menubar;
}