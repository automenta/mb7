export class NoteDetails {
    constructor(noteView) {
        this.noteView = noteView;
    }

    render() {
        this.el = document.createElement('div');
        this.el.className = 'note-details';
        this.el.innerHTML = `<h2>Note Details</h2>`;
        return this.el;
    }
}
