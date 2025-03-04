import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Edit } from '../../ui/edit/edit.js';
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
        appMock.getTagDefinition = (tagName) => ({
            name: tagName,
            label: tagName,
            ui: { type: "text" },
            validate: () => true,
            conditions: ["is", "contains"]
        });
        appMock.schema = {};

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

    it('should preserve cursor position after re-rendering - cursor at the beginning', async () => {
        const initialContent = 'This is some text content.';
        yDoc.getText('content').insert(0, initialContent);
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        editorArea.focus();
        editorArea.setSelectionRange(0, 0);
        const initialCursorPosition = editorArea.selectionStart;

        editInstance.renderContent();
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should preserve cursor position after re-rendering - cursor in the middle', async () => {
        const initialContent = 'This is some text content.';
        yDoc.getText('content').insert(0, initialContent);
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        editorArea.focus();
        const cursorPosition = 10;
        editorArea.setSelectionRange(cursorPosition, cursorPosition);
        const initialCursorPosition = editorArea.selectionStart;

        editInstance.renderContent();
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should preserve cursor position after re-rendering - cursor at the end', async () => {
        const initialContent = 'This is some text content.';
        yDoc.getText('content').insert(0, initialContent);
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        editorArea.focus();
        const cursorPosition = initialContent.length;
        editorArea.setSelectionRange(cursorPosition, cursorPosition);
        const initialCursorPosition = editorArea.selectionStart;

        editInstance.renderContent();
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should preserve cursor position after re-rendering - with tags', async () => {
        const initialContent = 'Text before [TAG:{"name": "LocationTag"}] tag and text after.';
        yDoc.getText('content').insert(0, initialContent);
        await vi.waitUntil(() => editorArea.textContent.includes('Text before'));

        editorArea.focus();
        const cursorPosition = 15;
        editorArea.setSelectionRange(cursorPosition, cursorPosition);
        const initialCursorPosition = editorArea.selectionStart;

        editInstance.renderContent();
        await vi.waitUntil(() => editorArea.textContent.includes('Text before'));

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should preserve cursor position after content is changed programmatically', async () => {
        const initialContent = 'Initial content.';
        yDoc.getText('content').insert(0, initialContent);
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        editorArea.focus();
        const cursorPosition = 5;
        editorArea.setSelectionRange(cursorPosition, cursorPosition);
        const initialCursorPosition = editorArea.selectionStart;

        const newContent = 'New content, replacing initial.';
        yDoc.getText('content').delete(0, initialContent.length);
        yDoc.getText('content').insert(0, newContent);
        await vi.waitUntil(() => editorArea.textContent === newContent);

        expect(editorArea.selectionStart).toBe(initialCursorPosition);
    });

    it('should place cursor at the end if initial cursor position is out of bounds after re-render', async () => {
        const initialContent = 'Short content.';
        yDoc.getText('content').insert(0, initialContent);
        await vi.waitUntil(() => editorArea.textContent === initialContent);

        editorArea.focus();
        const cursorPosition = initialContent.length;
        editorArea.setSelectionRange(cursorPosition, cursorPosition);

        const shorterContent = 'Shorter.';
        yDoc.getText('content').delete(0, initialContent.length);
        yDoc.getText('content').insert(0, shorterContent);
        await vi.waitUntil(() => editorArea.textContent === shorterContent);

        expect(editorArea.selectionStart).toBe(shorterContent.length);
    });
});
