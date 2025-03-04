ui/note/note-yjs-handler.js

export class NoteYjsHandler {
    constructor(store) {
        this.store = store;
        this.yMap = this.store.ydoc.getMap('notes');
    }

    getYNoteMap(noteId) {
        return this.yMap.get(noteId);
    }
}
