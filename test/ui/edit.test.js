import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Edit } from '@/ui/edit/edit.js';
import { createAppMock } from '../test-utils.js';
import * as Y from 'yjs';

describe('Edit Component - Cursor Preservation', () => {
    let editInstance;
    let yDoc;
    let editorArea;
    let appMock;

    beforeEach(() => {
        yDoc = new Y.Doc();
        appMock = createAppMock();

        editInstance = new Edit(
            { id: 'test-note', content: '' },
            yDoc,
            appMock,
            appMock.getTagDefinition,
            appMock.schema
        );
        document.body.appendChild(editInstance.el);
        editorArea = editInstance.editorArea;
    });

    afterEach(() => {
        document.body.innerHTML = '';
        vi.clearAllMocks();
    });

    const setEditorContent = async (content, cursorPosition = null) => {
        yDoc.getText('content').insert(0, content);
        await vi.waitUntil(() => editorArea.textContent === content);
        editorArea.focus();
        if (cursorPosition !== null) {
            editorArea.setSelectionRange(cursorPosition, cursorPosition);
        }
        return cursorPosition === null ? content.length : cursorPosition;
    };

    it('should preserve cursor position after re-rendering - cursor at the beginning', async () => {
        const initialContent = 'This is some text content.';
        const initialCursorPosition = await setEditorContent(initialContent, 0);

        editInstance.renderContent();
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should preserve cursor position after re-rendering - cursor in the middle', async () => {
        const initialContent = 'This is some text content.';
        const cursorPosition = 10;
        const initialCursorPosition = await setEditorContent(initialContent, cursorPosition);

        editInstance.renderContent();
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should preserve cursor position after re-rendering - cursor at the end', async () => {
        const initialContent = 'This is some text content.';
        const initialCursorPosition = await setEditorContent(initialContent);

        editInstance.renderContent();
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should preserve cursor position after re-rendering - with tags', async () => {
        const initialContent = 'Text before [TAG:{"name": "LocationTag"}] tag and text after.';
        const cursorPosition = 15;
        const initialCursorPosition = await setEditorContent(initialContent, cursorPosition);

        editInstance.renderContent();
        await vi.waitUntil(() => editorArea.textContent.includes('Text before'));

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should preserve cursor position after content is changed programmatically', async () => {
        const initialContent = 'Initial content.';
        const cursorPosition = 5;
        const initialCursorPosition = await setEditorContent(initialContent, cursorPosition);

        const newContent = 'New content, replacing initial.';
        yDoc.getText('content').delete(0, initialContent.length);
        yDoc.getText('content').insert(0, newContent);
        await vi.waitUntil(() => editorArea.textContent === newContent);

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should place cursor at the end if initial cursor position is out of bounds after re-render', async () => {
        const initialContent = 'Short content.';
        await setEditorContent(initialContent);

        const shorterContent = 'Shorter.';
        yDoc.getText('content').delete(0, initialContent.length);
        yDoc.getText('content').insert(0, shorterContent);
        await vi.waitUntil(() => editorArea.textContent === shorterContent);

        expect(editorArea.selectionStart).toBe(shorterContent.length);
    });
});
