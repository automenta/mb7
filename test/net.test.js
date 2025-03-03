import {beforeEach, describe, expect, it} from 'vitest';
import {Nostr} from '../core/net.js';
import {RelayManager} from '../core/net/net.relays.js';
import {createAppMock} from './test-utils.js';

describe('Nostr and RelayManager', () => {
    let nostr;
    let app;
    let relayConnectedMock;
    let relay;
    let relayConnectMock;
    let relayManager;
    let onOpenMock;
    let onCloseMock;

    beforeEach(() => {
        app = createAppMock();
        const relays = ["wss://relay.example.com"];
        nostr = new Nostr(app, null, relays, null, null);
        relayManager = new RelayManager(nostr, relays, {}, {}, nostr.relayConnected, app.showNotification);
        nostr.relayManager = relayManager;
    });


    it('connectToRelay should update relayStatuses', async () => {
        expect(relayManager.relayStatuses["wss://relay.example.com"]).toBeUndefined();
        await relayManager.connectToRelay("wss://relay.example.com");
        expect(relayManager.relayStatuses["wss://relay.example.com"].status).toBe("connecting");
        await onOpenMock.mock.results[0].value;
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow event loop to process
        expect(relayManager.relayStatuses["wss://relay.example.com"].status).toBe("connected");
    });

    it('onClose should update relayStatuses', async () => {
        await relayManager.connectToRelay("wss://relay.example.com");
        expect(relayManager.relayStatuses["wss://relay.example.com"].status).toBe("connecting");
        await onOpenMock.mock.results[0].value;
        relayManager.onClose(relay);
        await new Promise(resolve => setTimeout(resolve, 0)); // Allow event loop to process
        expect(relayManager.relayStatuses["wss://relay.example.com"].status).toBe("disconnected");
    });

    it('disconnectFromAllRelays should close all relays and clear relayObjects and relayStatuses', async () => {
        await relayManager.connectToRelay("wss://relay.example.com");
        await onOpenMock.mock.results[0].value;
        await relayManager.disconnectFromAllRelays();
        expect(relay.close).toHaveBeenCalled();
        expect(relayManager.relayObjects).toEqual({});
        expect(relayManager.relayStatuses).toEqual({});
    });

});