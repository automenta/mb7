function createListItem(item, updateNote, yMap) {
    const listItem = document.createElement('div');
    listItem.className = 'note-list-item';
    listItem.textContent = item.name;
    return listItem;
}


export class NoteListItemRenderer {
    constructor(noteList, app) {
        this.noteList = noteList;
        this.app = app;
    }

    renderListItem(item) {
        return createListItem(item);
    }
}
