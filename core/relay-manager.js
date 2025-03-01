export class RelayManager {
    constructor(app, relays, relayStatuses, relayObjects) {
        this.app = app;
        this.relays = relays;
        this.relayStatuses = relayStatuses;
        this.relayObjects = relayObjects;
    }

    setRelays(relays) {
        this.disconnectFromAllRelays();
        this.relays = relays;
        this.connect();
    }

    connect() {
        this.disconnectFromAllRelays();
        this.connectToRelays();
    }

    connectToRelays() {
        if (this.relays.length === 0) {
            this.app.showNotification("No relays configured.", "warning");
            return;
        }

        for (const relayUrl of this.relays) {
            this.connectToRelay(relayUrl);
        }
    }

    async connectToRelay(relayUrl) {
        if (this.relayStatuses[relayUrl]?.status === "connecting" || this.relayStatuses[relayUrl]?.status === "connected") {
            return;
        }

        this.relayStatuses[relayUrl] = { status: "connecting" };

        try {
            const relay = await Relay.connect(relayUrl);
            this.relayObjects[relayUrl] = relay;

            await this.onOpen(relay);

        } catch (error) {
            console.error("WebSocket connection error:", error);
            this.relayStatuses[relayUrl] = { status: "error" };
        }
    }

    async onOpen(relay) {
        try {
            console.log("Connected to relay:", relay.url);
            this.relayStatuses[relay.url] = { status: "connected" };
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
            this.relayStatuses[relay.url].status = "disconnected";
        } catch (error) {
            console.error("Error handling close:", error);
        }
    }

    async disconnectFromAllRelays() {
        try {
            for (const relayUrl in this.relayObjects) {
                await this.relayObjects[relayUrl].close();
            }
            this.relayStatuses = {};
            this.relayObjects = {};
        } catch (error) {
            console.error("Error disconnecting from relays:", error);
        }
    }
}