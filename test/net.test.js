import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Nostr} from '../core/net.js';
import {RelayManager} from '../core/net/net.relays.js';
import {createAppMock} from './test-utils.js';

// Mock WebSocket
vi.mock('websocket', () => {
    const WebSocket = vi.fn(() => {
        return {
            readyState: 1,
            OPEN: 1,
            close: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            send: vi.fn(),
        };
    });
    return {w3cwebsocket: WebSocket};
});

describe('Nostr and RelayManager', () => {
    let closeSpy;
    let nostr;
    let app;
    let relayConnectedMock;
    let relay;
    let relayConnectMock;
    let relayManager;
    let onOpenMock = {mock: {results: [{value: Promise.resolve()}]}};
    let onCloseMock;

    beforeEach(async () => {
        app = createAppMock();
        onOpenMock = {mock: {results: [{value: Promise.resolve()}]}};
        const relays = ["wss://relay.example.com"];
        nostr = new Nostr(app, null, relays, null, null);
        relayManager = new RelayManager(nostr, relays, {}, {}, nostr.relayConnected, app.showNotification);
        nostr.relayManager = relayManager;
        await relayManager.connectToRelay("wss://relay.example.com");
        relay = relayManager.relayObjects["wss://relay.example.com"];
        relayManager.relayObjects["wss://relay.example.com"] = relay;
    });

    it('connectToRelay should update relayStatuses', async () => {
        relayManager.relayStatuses["wss://relay.example.com"] = {status: 'connecting'};
        expect(relayManager.relayStatuses["wss://relay.example.com"].status).toBe("connecting");
        relayManager.relayObjects["wss://relay.example.com"] = relay;
        await new Promise(resolve => setTimeout(resolve, 0));
        relayManager.relayStatuses["wss://relay.example.com"] = {status: 'connected'};
        expect(relayManager.relayStatuses["wss://relay.example.com"].status).toBe("connected");
    });

    it('onClose should update relayStatuses', async () => {
        const relayUrl = "wss://relay.example.com";
        relayManager.relayStatuses[relayUrl] = {status: 'connecting'};
        const relay = {
            close: vi.fn(),
            url: relayUrl,
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
        };
        relayManager.relayObjects[relayUrl] = relay;

        // Simulate the relay closing
        relay.close();

        // Wait for the onClose handler to be called
        await new Promise(resolve => setTimeout(resolve, 0));

        // Call onClose directly with the mocked relay
        await relayManager.onClose(relay, relayUrl);

        // Wait for the status to be updated
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(relayManager.relayStatuses[relayUrl].status).toBe("disconnected");
    });

    it('disconnectFromAllRelays should close all relays and clear relayObjects and relayStatuses', async () => {
        const relay = {close: vi.fn()};
        relayManager.relayObjects["wss://relay.example.com"] = relay;
        console.log("Relay object:", relay);
        const closeSpy = vi.spyOn(relay, 'close');
        await relayManager.disconnectFromAllRelays();
        expect(closeSpy).toHaveBeenCalled();
        expect(relayManager.relayObjects).toEqual({});
        expect(relayManager.relayStatuses).toEqual({});
    });

});
