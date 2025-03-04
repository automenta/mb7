core/net/net.relays.js
export class RelayManager {
    constructor(nostr, relays, relayStatuses, relayObjects, relayConnected, showNotification) {
        this.nostr = nostr;
        this.relays = relays;
        this.relayStatuses = relayStatuses;
        this.relayObjects = relayObjects;
        this.relayConnected = relayConnected;
        this.showNotification = showNotification;
    }

    connect() {
        this.disconnectFromAllRelays();
        this.connectToRelays();
    }

    disconnectFromAllRelays() {
        for (const relayUrl in this.relayObjects) {
            this.disconnectRelay(relayUrl);
        }
        this.relayObjects = {};
        this.relayConnected = false;
    }

    disconnectRelay(relayUrl) {
        if (this.relayObjects[relayUrl]) {
            this.relayObjects[relayUrl].disconnect();
            delete this.relayObjects[relayUrl];
            this.updateRelayStatus(relayUrl, 'disconnected');
        }
    }


    connectToRelays() {
        if (this.relays.length === 0) {
            this.showNotification("No relays configured.", "warning");
            return;
        }

        for (const relayUrl of this.relays) {
            this.connectToRelay(relayUrl);
        }
    }

    async connectToRelay(relayUrl) {
        try {
            await this.nostr.connectToRelays();
            this.updateRelayStatus(relayUrl, 'connecting');
            this.relayConnected = true;
        } catch (error) {
            console.error(`Failed to connect to relay ${relayUrl}:`, error);
            this.showNotification(`Failed to connect to relay ${relayUrl}: ${error.message}`, 'error');
            this.updateRelayStatus(relayUrl, 'error');
        }
    }


    updateRelayStatus(relayUrl, status) {
        this.relayStatuses[relayUrl] = status;
        this.notifyRelayStatusUpdate(relayUrl, status);
    }

    addRelayObject(relayUrl, relay) {
        this.relayObjects[relayUrl] = relay;
    }

    removeRelayObject(relayUrl) {
        delete this.relayObjects[relayUrl];
    }


    notifyRelayStatusUpdate(relayUrl, status) {
        const event = new CustomEvent('relaystatusupdate', {
            detail: { relayUrl, status }
        });
        document.dispatchEvent(event);
    }
}
