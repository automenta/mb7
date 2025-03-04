import {vi} from 'vitest';

export function createAppMock() {
    return {
        notificationManager: {
            showNotification: vi.fn(),
        },
        db: {
            save: vi.fn(),
            get: vi.fn(),
            getAll: vi.fn(),
            delete: vi.fn(),
            updateFriendProfile: vi.fn(),
        },
        errorHandler: {
            handleError: vi.fn(),
        },
        ontology: {},
        noteManager: {
            createNote: vi.fn(),
            saveObject: vi.fn(),
        },
        relayManager: {
            connect: vi.fn(),
            disconnectFromAllRelays: vi.fn(),
            updateRelayStatus: vi.fn(),
            addRelayObject: vi.fn(),
            removeRelayObject: vi.fn(),
        },
        signaling: {
            connectToRelays: vi.fn(),
            sendSignal: vi.fn(),
            subscribeSignals: vi.fn(),
            unsubscribeSignals: vi.fn(),
            queueIceCandidate: vi.fn(),
            sendIceCandidates: vi.fn(),
        },
        monitoring: {
            errorCount: 0,
        },
        showNotification: vi.fn(),
        getTagDefinition: vi.fn().mockReturnValue({
            name: 'MockTag',
            label: 'Mock Tag',
            ui: {type: "text"},
            validate: () => true,
            conditions: ["is", "contains"]
        }),
        schema: {},
        friendsView: {
            loadFriends: vi.fn()
        },
        mainContent: {
            currentView: null
        },
        SettingsView: class MockSettingsView {
            displayProfile: vi.fn
        ()
        },
        FriendsView: class MockFriendsView {
        }
    };
}
