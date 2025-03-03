import {Relay} from 'nostr-tools';

export class RelayManager {
    constructor(nostr, relays, relayStatuses, relayObjects, relayConnected, showNotification) {
        this.nostr = nostr;
        this.relays = relays;
        this.relayStatuses = relayStatuses;
        this.relayObjects = relayObjects;
        this.relayConnected = relayConnected;
        this.showNotification = showNotification;
    }

    setRelays(relays) {
        this.disconnectFromAllRelays();
        this.relays = relays.map(relay => typeof relay === 'string' ? relay : relay.url);
        this.connect();
    }

    connect() {
        this.disconnectFromAllRelays();
        this.connectToRelays();
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
        console.log("RelayManager.connectToRelay() called");

        console.log('RelayManager.connectToRelay() called', relayUrl);
        if (this.relayStatuses[relayUrl]?.status === "connecting" || this.relayStatuses[relayUrl]?.status === "connected") {
            return;
        }

        this.relayStatuses[relayUrl] = {status: "connecting"};

        try {
            const relay = await Relay.connect(relayUrl);
            this.relayObjects[relayUrl] = relay;
            console.log("Relay object:", relay);

            await this.onOpen(relay);

        } catch (error) {
            console.error("WebSocket connection error:", error);
            this.relayStatuses[relayUrl] = {status: "error"};
        }
    }

    async onOpen(relay) {
        console.log('RelayManager.onOpen() called', relay.url);
        try {
            console.log("Connected to relay:", relay.url);
            this.relayStatuses[relay.url] = {status: "connected"};
            await this.relayConnected(relay);
        } catch (error) {
            console.error("Error handling onOpen:", error);
        }
    }

    async onNotice(relay, notice) {
        try {
            console.log(`NOTICE from ${relay.url}: ${notice}`);
            this.app.showNotification(`NOTICE from ${relay.url}: ${notice}`, "warning");
        } catch (error) {
            console.error("Error handling notice:", error);
        }
    }

    async onClose(relay) {
        try {
            console.log("Disconnected from relay:", relay.url);
            console.log("Relay status before update:", this.relayStatuses[relay.url]);
            if (this.relayStatuses[relay.url]) {
                this.relayStatuses[relay.url].status = "disconnected";
            }
            console.log("Relay status after update:", this.relayStatuses[relay.url]);
        } catch (error) {
            console.error("Error handling close:", error);
        }
    }

    async disconnectFromAllRelays() {
        try {
            for (const relayUrl in this.relayObjects) {
                console.log('disconnectFromAllRelays - relayUrl:', relayUrl);
                console.log('disconnectFromAllRelays - relay:', this.relayObjects[relayUrl]);
                await this.relayObjects[relayUrl].close();
            }
            this.relayStatuses = {};
            this.relayObjects = {};

            // Unsubscribe from all subscriptions
            for (const relayUrl in this.relayObjects) {
                const relay = this.relayObjects[relayUrl];
                const subscriptions = this.nostr.getSubscriptions();
                for (const subId in subscriptions) {
                    try {
                        await relay.unsubscribe({id: subId});
                    } catch (error) {
                        console.error("Error unsubscribing:", error);
                    }
                }
                await relay.close();
            }
        } catch (error) {
            console.error("Error disconnecting from relays:", error);
        }
    }
}