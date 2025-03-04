core/db.ydoc.js
import * as Y from 'yjs';
import { applyUpdate } from 'yjs';

export async function getYDoc(db, id) {
    await db.constructor.the();
    try {
        const yDocObject = await db.db.get('objects', `${id}-ydoc`);
        if (yDocObject) {
            const yDoc = new Y.Doc();
            Y.applyUpdate(yDoc, yDocObject.yDocData);
            return yDoc;
        } else {
            return null;
        }
    } catch (error) {
        db.errorHandler.handleError(error, `Failed to load YDoc for ID: ${id}`, error);
        console.error(`Failed to load YDoc for ID: ${id}`, error);
        return null;
    }
}
