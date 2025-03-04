import * as Y from 'yjs';

export async function saveYDoc(db, o) {
    try {
        // Yjs integration - enables collaborative editing and offline support
        // Operational Transformation (OT) for text-based NObjects
        console.log('Using OT for text-based NObject');

        // Get the YDoc for the object, create if it doesn't exist
        let yDoc = await db.getYDoc(o.id) || new Y.Doc();

        // Get the YText object from the YDoc
        const yText = yDoc.getText('content');

        // Apply the changes to the YText object within a transaction
        yDoc.transact(() => {
            yText.delete(0, yText.length);
            yText.insert(0, o.content);
        });

        // Save the YDoc
        await saveYDocToDB(db, o.id, yDoc);
    } catch (error) {
        db.errorHandler.handleError(error, "Failed to integrate with Yjs", error);
        console.error("Failed to integrate with Yjs:", error);
    }
}

async function saveYDocToDB(db, id, yDoc) {
    try {
        const yDocData = Y.encodeStateAsUpdate(yDoc);
        await db.db.put('objects', {id: `${id}-ydoc`, yDocData: yDocData});
    } catch (error) {
        db.errorHandler.handleError(error, `Failed to save YDoc with ID: ${id}`, error);
        console.error(`Failed to save YDoc with ID: ${id}`, error);
    }
}

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
        db.errorHandler.handleError(error, "Failed to get YDoc", error);
        console.error("Failed to get YDoc:", error);
        return null;
    }
}
