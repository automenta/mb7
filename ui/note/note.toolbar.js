export class NotesToolbar extends HTMLElement {
    constructor() {
        super();

        this.el = document.createElement('div');
        this.el.className = 'notes-toolbar';

        const title = document.createElement('span');
        title.textContent = 'Notes';
        this.el.appendChild(title);

        const actions = document.createElement('div');
        actions.className = 'notes-toolbar-actions';
        this.el.appendChild(actions);

        const searchButton = document.createElement('button');
        searchButton.textContent = 'Search';
        actions.appendChild(searchButton);

        const addNoteButton = document.createElement('button');
        addNoteButton.textContent = 'Add';
        addNoteButton.addEventListener('click', () => {
            // TODO: Implement add note functionality
            console.log('Add note clicked');
        });
        actions.appendChild(addNoteButton);
    }

    render() {
        return this.el;
    }
}

if (!customElements.get('notes-toolbar')) {
    customElements.define('notes-toolbar', NotesToolbar);
}