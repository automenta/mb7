export function createMenuBar(notesView, friendsView, settingsView, contentView, store) {
    const m = document.createElement('div');
    m.classList.add('menubar-top');
    const viewMap = {
        'Notes': notesView,
        'Friends': friendsView,
        'Settings': settingsView,
        'Content': contentView
    };

    for (const [viewName, view] of Object.entries(viewMap)) {
        const button = document.createElement('div');
        button.textContent = viewName;
        m.appendChild(button);
    }

    m.addEventListener('click', (e) => {
        const viewName = e.target.textContent;
        const view = viewMap[viewName];
        if (view) {
            //app.showView(view); // Access to app removed
        }
    });
    return m;
}
