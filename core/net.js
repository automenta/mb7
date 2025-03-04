import {finalizeEvent, getPublicKey} from 'nostr-tools'; //TODO use generateSecretKey in crypto.js?
import {Relay} from 'nostr-tools/relay'

export class Nostr {
    /**
     * Constructor for the Nostr class.
     * @param {object} app - The application object.
     * @param {string} signalingStrategy - The signaling strategy.
     * @param {string} nostrRelays - The Nostr relays.
     * @param {string} nostrPrivateKey - The Nostr private key.
     */
    constructor(app, signalingStrategy, nostrRelays, nostrPrivateKey) {
        this.app = app;
        this.signalingStrategy = signalingStrategy;
        this.nostrRelays = nostrRelays;
        this.nostrPrivateKey = nostrPrivateKey;
        this.relays = ["wss://relay.damus.io", "wss://relay.snort.social"]; // Default relays, can be configured in settings
        this.subscriptions = {};
        this.relayStatuses = {};
        this.relayObjects = {};
    }

    /**
     * Initializes the Nostr connection.
     */
    async init() {
        await this.connectToRelays();
    }

    /**
     * Connects to the configured Nostr relays.
     */
    async connectToRelays() {
        const relaysToConnect = this.nostrRelays ? this.nostrRelays.split(',').map(url => url.trim()) : this.relays;

        for (const relayUrl of relaysToConnect) {
            try {
                const relay = await Relay.connect(relayUrl)

                if (relay) {
                    // relay.on('connect', () => this.handleRelayConnect(relayUrl, relay));
                    // relay.on('disconnect', () => this.handleRelayDisconnect(relayUrl));
                    // relay.on('error', () => this.handleRelayError(relayUrl));
                    await relay.connect();
                }

            } catch (error) {
                console.error(`Failed to connect to relay ${relayUrl}:`, error);
                this.app.notificationManager.showNotification(`Failed to connect to relay ${relayUrl}: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Handles the relay connect event.
     * @param {string} relayUrl - The URL of the relay.
     * @param {object} relay - The relay object.
     */
    handleRelayConnect(relayUrl, relay) {
        console.log(`Connected to relay: ${relayUrl}`);
        this.relayStatuses[relayUrl] = 'connected';
        this.app.notificationManager.showNotification(`Connected to relay: ${relayUrl}`, 'success');
        this.relayObjects[relayUrl] = relay;
    }

    /**
     * Handles the relay disconnect event.
     * @param {string} relayUrl - The URL of the relay.
     */
    handleRelayDisconnect(relayUrl) {
        console.log(`Disconnected from relay: ${relayUrl}`);
        this.relayStatuses[relayUrl] = 'disconnected';
        this.app.notificationManager.showNotification(`Disconnected from relay: ${relayUrl}`, 'warning');
        delete this.relayObjects[relayUrl];
    }

    /**
     * Handles the relay error event.
     * @param {string} relayUrl - The URL of the relay.
     */
    handleRelayError(relayUrl) {
        console.error(`Error connecting to relay: ${relayUrl}`);
        this.relayStatuses[relayUrl] = 'error';
        this.app.notificationManager.showNotification(`Error connecting to relay: ${relayUrl}`, 'error');
        delete this.relayObjects[relayUrl];
    }

    /**
     * Publishes an object to the Nostr network.
     * @param {object} object - The object to publish.
     */
    async publish(object) {
        // Rate limiting
        if (this.lastPublishTime && Date.now() - this.lastPublishTime < 1000) {
            throw new Error('Rate limit exceeded. Please wait before publishing again.');
        }

        // Validate object
        if (!object) {
            throw new Error('Object cannot be null or undefined');
        }

        // Sign event
        let event = {
            kind: 1,
            created_at: Math.floor(Date.now() / 1000),
            tags: object.tags,
            content: object.content,
            pubkey: getPublicKey(this.nostrPrivateKey),
        };

        event = finalizeEvent(event, this.nostrPrivateKey);

        // Publish to relays
        const relaysToPublish = this.nostrRelays ? this.nostrRelays.split(',').map(url => url.trim()) : this.relays;

        for (const relayUrl of relaysToPublish) {
            try {
                const relay = this.relayObjects[relayUrl];
                if (relay?.status === 1) {
                    let pub = relay.publish(event);

                    pub.on('ack', () => {
                        console.log(`Event published to ${relayUrl}`);
                        this.app.notificationManager.showNotification(`Event published to ${relayUrl}`, 'success');
                    });

                    pub.on('seen', () => {
                        console.log(`Event seen by ${relayUrl}`);
                    });

                    pub.on('failed', reason => {
                        console.log(`Failed to publish to ${relayUrl}: ${reason}`);
                        this.app.notificationManager.showNotification(`Failed to publish to ${relayUrl}: ${reason}`, 'error');
                    });
                } else {
                    console.warn(`Relay ${relayUrl} not connected, skipping publish`);
                    this.app.notificationManager.showNotification(`Relay ${relayUrl} not connected, skipping publish`, 'warning');
                }
            } catch (error) {
                console.error(`Failed to publish to relay ${relayUrl}:`, error);
                this.app.notificationManager.showNotification(`Failed to publish to relay ${relayUrl}: ${error.message}`, 'error');
            }
        }

        this.lastPublishTime = Date.now();
    }

    /**
     * Subscribes to events from a specific pubkey.
     * @param {string} pubkey - The pubkey to subscribe to.
     * @param {function} callback - The callback function to call when an event is received.
     */
    async subscribeToPubkey(pubkey, callback) {
        if (!pubkey) {
            console.warn('subscribeToPubkey called with empty pubkey');
            return;
        }

        const subscriptionId = `friend-profile-${pubkey}`;

        if (this.subscriptions[subscriptionId]) {
            console.log(`Already subscribed to pubkey ${pubkey}`);
            return;
        }

        this.subscriptions[subscriptionId] = {
            filter: {
                authors: [pubkey]
            },
            callback: callback
        };

        const relaysToSubscribe = this.nostrRelays ? this.nostrRelays.split(',').map(url => url.trim()) : this.relays;

        for (const relayUrl of relaysToSubscribe) {
            try {
                const relay = this.relayObjects[relayUrl];
                if (relay?.status === 1) {
                    const subscription = relay.sub([
                        {
                            authors: [pubkey]
                        }
                    ]);

                    subscription.on('event', event => {
                        console.log(`Event received from ${relayUrl} for pubkey ${pubkey}`);
                        callback(event);
                    });

                    subscription.on('eose', () => {
                        console.log(`End of stored events for pubkey ${pubkey} from ${relayUrl}`);
                    });
                } else {
                    console.warn(`Relay ${relayUrl} not connected, skipping subscription`);
                    this.app.notificationManager.showNotification(`Relay ${relayUrl} not connected, skipping subscription`, 'warning');
                }
            } catch (error) {
                console.error(`Failed to subscribe to pubkey ${pubkey} on relay ${relayUrl}:`, error);
                this.app.notificationManager.showNotification(`Failed to subscribe to pubkey ${pubkey} on relay ${relayUrl}: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Unsubscribes from events from a specific pubkey.
     * @param {string} subscriptionId - The ID of the subscription to unsubscribe from.
     */
    async unsubscribeToPubkey(subscriptionId) {
        if (!subscriptionId) {
            console.warn('unsubscribeToPubkey called with empty subscriptionId');
            return;
        }

        if (!this.subscriptions[subscriptionId]) {
            console.log(`Not subscribed to subscriptionId ${subscriptionId}`);
            return;
        }

        const relaysToUnsubscribe = this.nostrRelays ? this.nostrRelays.split(',').map(url => url.trim()) : this.relays;

        for (const relayUrl of relaysToUnsubscribe) {
            try {
                const relay = this.relayObjects[relayUrl];
                if (relay?.status === 1) {
                    relay.unsub([
                        {
                            id: subscriptionId
                        }
                    ]);
                    console.log(`Unsubscribed from pubkey ${subscriptionId} on relay ${relayUrl}`);
                } else {
                    console.warn(`Relay ${relayUrl} not connected, skipping unsubscription`);
                    this.app.notificationManager.showNotification(`Relay ${relayUrl} not connected, skipping unsubscription`, 'warning');
                }
            } catch (error) {
                console.error(`Failed to unsubscribe from pubkey ${subscriptionId} on relay ${relayUrl}:`, error);
                this.app.notificationManager.showNotification(`Failed to unsubscribe from pubkey ${subscriptionId} on relay ${relayUrl}: ${error.message}`, 'error');
            }
        }

        delete this.subscriptions[subscriptionId];
    }

    /**
     * Subscribes to events that match a specific NObject ID.
     * @param {string} objectId - The ID of the NObject to subscribe to.
     * @param {function} callback - The callback function to call when a match is received.
     */
    async subscribeToMatches(objectId, callback) {
        if (!objectId) {
            console.warn('subscribeToMatches called with empty objectId');
            return;
        }

        const subscriptionId = `match-for-${objectId}`;

        if (this.subscriptions[subscriptionId]) {
            console.log(`Already subscribed to matches for objectId ${objectId}`);
            return;
        }

        this.subscriptions[subscriptionId] = {
            filter: {
                '#e': [objectId] // Assuming 'e' tag is used to reference the original object
            },
            callback: callback
        };

        const relaysToSubscribe = this.nostrRelays ? this.nostrRelays.split(',').map(url => url.trim()) : this.relays;

        for (const relayUrl of relaysToSubscribe) {
            try {
                const relay = this.relayObjects[relayUrl];
                if (relay?.status === 1) {
                    const subscription = relay.sub([
                        {
                            '#e': [objectId]
                        }
                    ]);

                    subscription.on('event', event => {
                        console.log(`Match received from ${relayUrl} for objectId ${objectId}`);
                        callback(event);
                    });

                    subscription.on('eose', () => {
                        console.log(`End of stored events for matches for objectId ${objectId} from ${relayUrl}`);
                    });
                } else {
                    console.warn(`Relay ${relayUrl} not connected, skipping subscription`);
                    this.app.notificationManager.showNotification(`Relay ${relayUrl} not connected, skipping subscription`, 'warning');
                }
            } catch (error) {
                console.error(`Failed to subscribe to matches for objectId ${objectId} on relay ${relayUrl}:`, error);
                this.app.notificationManager.showNotification(`Failed to subscribe to matches for objectId ${objectId} on relay ${relayUrl}: ${error.message}`, 'error');
            }
        }
    }

    /**
     * Unsubscribes from events that match a specific NObject ID.
     * @param {string} subscriptionId - The ID of the subscription to unsubscribe from.
     */
    async unsubscribeToMatches(subscriptionId) {
        if (!subscriptionId) {
            console.warn('unsubscribeToMatches called with empty subscriptionId');
            return;
        }

        if (!this.subscriptions[subscriptionId]) {
            console.log(`Not subscribed to subscriptionId ${subscriptionId}`);
            return;
        }

        const relaysToUnsubscribe = this.nostrRelays ? this.nostrRelays.split(',').map(url => url.trim()) : this.relays;

        for (const relayUrl of relaysToUnsubscribe) {
            try {
                const relay = this.relayObjects[relayUrl];
                if (relay?.status === 1) {
                    relay.unsub([
                        {
                            id: subscriptionId
                        }
                    ]);
                    console.log(`Unsubscribed from matches ${subscriptionId} on relay ${relayUrl}`);
                } else {
                    console.warn(`Relay ${relayUrl} not connected, skipping unsubscription`);
                    this.app.notificationManager.showNotification(`Relay ${relayUrl} not connected, skipping unsubscription`, 'warning');
                }
            } catch (error) {
                console.error(`Failed to unsubscribe from matches ${subscriptionId} on relay ${relayUrl}:`, error);
                this.app.notificationManager.showNotification(`Failed to unsubscribe from matches ${subscriptionId} on relay ${relayUrl}: ${error.message}`, 'error');
            }
        }

        delete this.subscriptions[subscriptionId];
    }
}
