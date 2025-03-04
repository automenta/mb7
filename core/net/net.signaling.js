core/net/net.signaling.js
import { Relay } from 'nostr-tools'
import { nip19 } from 'nostr-tools'

class NostrSignalingProvider {
    constructor(relays, nostrPrivateKey, app) {
        this.relays = relays;
        this.nostrPrivateKey = nostrPrivateKey;
        this.nostrPublicKey = nip19.decode(nostrPrivateKey).data;
        this.eventKind = 30001;
        this.subscriptions = {};
        this.relayObjects = {};
        this.connectedRelays = [];
        this.iceCandidateQueue = {};
    }

    async connectToRelays() {
        try {
            for (const relayUrl of this.relays) {
                try {
                    const relay = new Relay(relayUrl);
                    this.relayObjects[relayUrl] = relay;
                    relay.on('connect', () => {
                        console.log(`Connected to relay: ${relayUrl}`);
                        this.connectedRelays.push(relayUrl);
                        this.app.showNotification(`Connected to relay: ${relayUrl}`);
                    });
                    relay.on('disconnect', () => {
                        console.log(`Disconnected from relay: ${relayUrl}`);
                        this.connectedRelays = this.connectedRelays.filter(url => url !== relayUrl);
                        this.app.showNotification(`Disconnected from relay: ${relayUrl}`);
                    });
                    relay.on('error', (error) => {
                        console.error(`Relay error on ${relayUrl}:`, error);
                        this.app.showNotification(`Relay error on ${relayUrl}: ${error.message}`, 'error');
                    });
                    await relay.connect();
                } catch (error) {
                    console.error(`Error connecting to relay ${relayUrl}:`, error);
                    this.app.showNotification(`Failed to connect to relay ${relayUrl}: ${error.message}`, 'error');
                }
            }
        } catch (error) {
            console.error("Error during relay connection:", error);
        }
    }


    async sendSignal(targetPublicKey, message) {
        const event = {
            kind: this.eventKind,
            pubkey: this.nostrPublicKey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
                ['p', targetPublicKey],
            ],
            content: message,
        };

        try {
            const signedEvent = await window.nostr.signEvent(event);
            if (!signedEvent) {
                throw new Error('Failed to sign event.');
            }
            for (const relayUrl of this.relays) {
                if (this.relayObjects[relayUrl] && this.relayObjects[relayUrl].status === 1) {
                    let pub = this.relayObjects[relayUrl].publish(signedEvent);
                    pub.on('failed', (reason) => {
                        console.error(`Failed to publish to relay ${relayUrl}: ${reason}`);
                        this.app.showNotification(`Failed to publish signal to relay ${relayUrl}: ${reason}`, 'error');
                    });
                }
            }
            return signedEvent;
        } catch (error) {
            console.error("Error sending signal:", error);
            this.app.showNotification(`Failed to send signal: ${error.message}`, 'error');
            throw error;
        }
    }


    async subscribeSignals(onSignalReceived) {
        if (this.relays.length === 0) {
            console.warn("No relays configured, not subscribing to signals.");
            return;
        }

        const sub = {
            filter: {
                kinds: [this.eventKind],
                authors: [this.nostrPublicKey],
                '#p': [this.nostrPublicKey]
            },
            cb: (event) => {
                if (event.pubkey !== this.nostrPublicKey) {
                    onSignalReceived(event.pubkey, event.content);
                }
            }
        };

        for (const relayUrl of this.relays) {
            if (this.relayObjects[relayUrl] && this.relayObjects[relayUrl].status === 1) {
                try {
                    this.relayObjects[relayUrl].subscribe(sub.filter, sub.cb);
                    this.subscriptions[relayUrl] = sub;
                    console.log(`Subscribed to signal events on relay: ${relayUrl}`);
                } catch (error) {
                    console.error(`Error subscribing to relay ${relayUrl}:`, error);
                    this.app.showNotification(`Failed to subscribe to signals on relay ${relayUrl}: ${error.message}`, 'error');
                }
            }
        }
    }


    async unsubscribeSignals() {
        for (const relayUrl in this.subscriptions) {
            if (this.relayObjects[relayUrl]) {
                try {
                    this.relayObjects[relayUrl].unsubscribe(this.subscriptions[relayUrl].filter, this.subscriptions[relayUrl].cb);
                    delete this.subscriptions[relayUrl];
                    console.log(`Unsubscribed from signal events on relay: ${relayUrl}`);
                } catch (error) {
                    console.error(`Error unsubscribing from relay ${relayUrl}:`, error);
                    this.app.showNotification(`Failed to unsubscribe from signals on relay ${relayUrl}: ${error.message}`, 'error');
                }
            }
        }
    }

    queueIceCandidate(targetPublicKey, candidate) {
        if (!this.iceCandidateQueue[targetPublicKey]) {
            this.iceCandidateQueue[targetPublicKey] = [];
        }
        this.iceCandidateQueue[targetPublicKey].push(candidate);
    }

    async sendIceCandidates(targetPublicKey) {
        const candidates = this.iceCandidateQueue[targetPublicKey] || [];
        for (const candidate of candidates) {
            await this.sendSignal(targetPublicKey, JSON.stringify({ type: 'ice-candidate', candidate }));
        }
        this.iceCandidateQueue[targetPublicKey] = [];
    }

}

export default NostrSignalingProvider;
