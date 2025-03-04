import {vi} from 'vitest';

export function createAppMock() {
    const app = {
        notificationManager: {
            showNotification: vi.fn(),
        },
        db: {
            save: vi.fn(),
            get: vi.fn(),
            getAll: vi.fn(),
        },
        showNotification: vi.fn(),
        createNewObject: vi.fn(async (newNote) => {
            await app.db.save({id: "test-id", name: newNote.name, content: newNote.content});
            return {name: 'Test Note', content: 'Test Content'}
        }),
        nostr: {
            publish: vi.fn()
        },
        publishNoteToNostr: vi.fn(async (note) => {
            app.nostr.publish(note.content);
        }),
        getTagDefinition: vi.fn(),
        schema: {},
        monitoring: {
            errorCount: 0,
        },
    };
    return app;
}
