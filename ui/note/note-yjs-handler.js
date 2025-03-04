import * as Y from 'yjs';

export class NoteYjsHandler {
    constructor(yDoc) {
        this.yDoc = yDoc;
        this.yMap = this.yDoc.getMap('notes');
        this.yName = this.yDoc.getText('name');
        this.yNotesList = this.yDoc.getArray('notesList');
        this.yMyObjectsList = this.yDoc.getArray('myObjectsList');
    }

    getYNoteMap(noteId) {
        return this.yMap.get(noteId);
    }

    updateNoteTitle(title) {
        this.yDoc.transact(() => {
            this.yName.delete(0, this.yName.length);
            this.yName.insert(0, title);
        });
    }
}
