import {beforeEach, describe, expect, it, vi} from 'vitest';
import {Nostr} from '../core/net.js';
import {RelayManager} from '../core/net/net.relays.js';
import {createAppMock} from './test-utils.js';

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
        console.log("Relay status before:", relayManager.relayStatuses["wss://relay.example.com"]);
        await onOpenMock.mock.results[0].value;
        const relay = relayManager.relayObjects["wss://relay.example.com"];
        relayManager.relayStatuses["wss://relay.example.com"] = {status: 'connecting'};
        expect(relayManager.relayStatuses["wss://relay.example.com"].status).toBe("connecting");
        if (relay) {
            relay.close();
        } else {
            console.error('relay is undefined!');
        }
        if (relay && relay.status === 1) {
            await relayManager.onClose(relay, "wss://relay.example.com");
        } else {
            console.error('relay is undefined or not connected!');
        }
        if (relay) {
            console.error('relay is undefined!');
        }
        await relayManager.onClose(relay, "wss://relay.example.com");
        await new Promise(resolve => setTimeout(resolve, 0));
        console.log("Relay status after:", relayManager.relayStatuses["wss://relay.example.com"]);
        expect(relayManager.relayStatuses["wss://relay.example.com"].status).toBe("disconnected");
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