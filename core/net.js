core/net.js
import { Relay } from 'nostr-tools'
import { nip19 } from 'nostr-tools'

export class Nostr {
    constructor(app, signalingStrategy, nostrRelays, nostrPrivateKey) {
        this.app = app;
        this.signalingStrategy = signalingStrategy;
        this.nostrRelays = nostrRelays;
        this.nostrPrivateKey = nostrPrivateKey;
        this.nostrPublicKey = nip19.decode(nostrPrivateKey).data;
        this.relayPool = [];
        this.lastPublishTime = null;
    }

    async connectToRelays() {
        const relaysToConnect = this.nostrRelays ? this.nostrRelays.split(',').map(url => url.trim()) : [];

        for (const relayUrl of relaysToConnect) {
            try {
                const relay = await Relay.connect(relayUrl)

                if (relay) {
                    this.relayPool.push(relay);
                    relay.on('connect', () => this.handleRelayConnect(relayUrl, relay));
                    relay.on('disconnect', () => this.handleRelayDisconnect(relayUrl));
                    relay.on('error', (error) => this.handleRelayError(relayUrl, error));
                }
            } catch (error) {
                console.error(`Error connecting to relay ${relayUrl}:`, error);
                this.app.notificationManager.showNotification(`Failed to connect to relay ${relayUrl}: ${error.message}`, 'error');
            }
        }
    }

    handleRelayConnect(relayUrl, relay) {
        console.log(`Connected to relay: ${relayUrl}`);
        this.app.notificationManager.showNotification(`Connected to relay: ${relayUrl}`, 'success');
        this.app.relayManager.updateRelayStatus(relayUrl, 'connected');
        this.app.relayManager.addRelayObject(relayUrl, relay);
    }

    handleRelayDisconnect(relayUrl) {
        console.log(`Disconnected from relay: ${relayUrl}`);
        this.app.notificationManager.showNotification(`Disconnected from relay: ${relayUrl}`, 'warning');
        this.app.relayManager.updateRelayStatus(relayUrl, 'disconnected');
        this.app.relayManager.removeRelayObject(relayUrl);
    }

    handleRelayError(relayUrl, error) {
        console.error(`Relay error on ${relayUrl}:`, error);
        this.app.notificationManager.showNotification(`Relay error on ${relayUrl}: ${error.message}`, 'error');
        this.app.relayManager.updateRelayStatus(relayUrl, 'error');
    }


    async publish(object) {
        if (this.lastPublishTime && Date.now() - this.lastPublishTime < 1000) {
            throw new Error('Rate limit exceeded. Please wait before publishing again.');
        }

        if (!object) {
            throw new Error('Object cannot be null or undefined');
        }

        try {
            const event = {
                kind: 1,
                pubkey: this.nostrPublicKey,
                created_at: Math.floor(Date.now() / 1000),
                tags: [],
                content: JSON.stringify(object),
            };

            const signedEvent = await window.nostr.signEvent(event);

            if (!signedEvent) {
                throw new Error('Failed to sign event.');
            }


            for (const relay of this.relayPool) {
                let pub = relay.publish(signedEvent);
                pub.on('failed', (reason) => {
                    console.error(`Publishing to relay ${relay.url} failed: ${reason}`);
                    this.app.notificationManager.showNotification(`Failed to publish to relay ${relay.url}: ${reason}`, 'error');
                });
            }


            this.lastPublishTime = Date.now();
            return signedEvent;
        } catch (error) {
            this.app.errorHandler.handleError(error, 'Failed to publish object to Nostr', error);
            console.error('Failed to publish object to Nostr', error);
            throw error;
        }
    }
}
