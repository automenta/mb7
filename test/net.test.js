import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Nostr} from '../core/net.js';
import {RelayManager} from '../core/net/net.relays.js';
import {createAppMock} from './test-utils.js';

// Mock WebSocket
vi.mock('websocket', () => {
    const WebSocket = vi.fn(() => {
        const eventListeners = {};
        return {
            readyState: 1,
            OPEN: 1,
            close: vi.fn(),
            addEventListener: vi.fn((event, listener) => {
                eventListeners[event] = listener;
            }),
            removeEventListener: vi.fn(),
            send: vi.fn(),
            simulateEvent: (event, data) => { // Helper to simulate events
                if (eventListeners[event]) {
                    eventListeners[event](data);
                }
            },
        };
    });
    return {w3cwebsocket: WebSocket};
});

describe('Nostr and RelayManager', () => {
    let nostr;
    let app;
    let relayManager;
    let relay;
    let WebSocketMock;

    beforeEach(async () => {
        app = createAppMock();
        const relays = ["wss://relay.example.com"];
        nostr = new Nostr(app, null, relays, null, null);
        relayManager = new RelayManager(nostr, relays, {}, {}, nostr.relayConnected, app.showNotification);
        nostr.relayManager = relayManager;
        WebSocketMock = vi.mocked(require('websocket').w3cwebsocket); // Get the mocked WebSocket class

        await relayManager.connectToRelay("wss://relay.example.com");
        relay = relayManager.relayObjects["wss://relay.example.com"];
    });

    it('connectToRelay should update relayStatuses', async () => {
        expect(relayManager.relayStatuses["wss://relay.example.com"]).toBe("connecting");
        // Simulate connection
        relay.simulateEvent('connect');
        expect(relayManager.relayStatuses["wss://relay.example.com"]).toBe("connected");
    });

    it('onClose should update relayStatuses', async () => {
        const relayUrl = "wss://relay.example.com";
        relayManager.relayStatuses[relayUrl] = "connecting";
        const relay = {
            close: vi.fn(),
            url: relayUrl,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            simulateEvent: vi.fn(), // Add simulateEvent to the mock
        };
        relayManager.relayObjects[relayUrl] = relay;

        // Simulate the relay closing
        relay.simulateEvent('close');

        expect(relayManager.relayStatuses[relayUrl]).toBe("disconnected");
    });

    it('disconnectFromAllRelays should close all relays and clear relayObjects and relayStatuses', async () => {
        const relay = {close: vi.fn()};
        relayManager.relayObjects["wss://relay.example.com"] = relay;
        await relayManager.disconnectFromAllRelays();
        expect(relay.close).toHaveBeenCalled();
        expect(relayManager.relayObjects).toEqual({});
        expect(relayManager.relayStatuses).toEqual({});
    });

    it('should handle connection errors', async () => {
        const relayUrl = "wss://relay.example.com";
        const errorMessage = 'Connection failed';
        WebSocketMock.mockImplementationOnce(() => {
            return {
                readyState: 3, // CLOSED
                close: vi.fn(),
                addEventListener: vi.fn((event, listener) => {
                    if (event === 'error') {
                        listener({message: errorMessage}); // Simulate error event
                    }
                }),
                removeEventListener: vi.fn(),
                send: vi.fn(),
            };
        });

        app.showNotification = vi.fn();
        relayManager.relayStatuses[relayUrl] = "connecting";
        await relayManager.connectToRelay(relayUrl);
        expect(app.showNotification).toHaveBeenCalledWith(expect.stringContaining(errorMessage), 'error');
        expect(relayManager.relayStatuses[relayUrl]).toBe("error");
    });
});
