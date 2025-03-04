import { vi } from 'vitest';

export function createAppMock() {
    const app = {
        notificationManager: {
            showNotification: vi.fn(),
        },
        db: {
            save: vi.fn(),
            get: vi.fn(),
            getAll: vi.fn(),
            delete: vi.fn(), // Added delete mock
            updateFriendProfile: vi.fn(), // Added updateFriendProfile mock
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
        getTagDefinition: vi.fn().mockReturnValue({ // Mock getTagDefinition
            name: 'MockTag',
            label: 'Mock Tag',
            ui: { type: "text" },
            validate: () => true,
            conditions: ["is", "contains"]
        }),
        schema: {}, // Mock schema
        friendsView: { // Mock friendsView for handleKind0 test
            loadFriends: vi.fn()
        },
        mainContent: { // Mock mainContent for handleKind0 test
            currentView: null
        },
        SettingsView: class MockSettingsView { // Mock SettingsView for handleKind0 test
            displayProfile: vi.fn()
        },
        FriendsView: class MockFriendsView {} // Mock FriendsView for handleKind0 test
    };
    return app;
}
