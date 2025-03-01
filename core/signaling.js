import { Relay, nip19, getEventHash, signEvent } from 'nostr-tools';
import { nanoid } from 'nanoid';

class NostrSignalingProvider {
    constructor(relays, nostrPrivateKey, app) {
        this.relays = relays;
        this.nostrPrivateKey = nostrPrivateKey;
        this.nostrPublicKey = nip19.decode(nostrPrivateKey).data;
        this.eventKind = 30001; // Custom event kind for WebRTC signaling
        this.subscriptions = {};
        this.relayObjects = {};
        this.connectedRelays = [];
        this.iceCandidateQueue = {};
        this.app = app;
        this.connectToRelays();
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
                        console.error(`Error connecting to relay ${relayUrl}:`, error);
                        this.app.showNotification(`Error connecting to relay ${relayUrl}: ${error.message}`, 'error');
                    });
                    await relay.connect();
                } catch (error) {
                    console.error(`Error connecting to relay ${relayUrl}:`, error);
                    this.app.showNotification(`Error connecting to relay ${relayUrl}: ${error.message}`, 'error');
                }
            }
        } catch (error) {
            console.error("Error in connectToRelays:", error);
            this.app.showNotification(`Error in connectToRelays: ${error.message}`, 'error');
        }
    }

    async publishToRelays(event) {
        try {
            event.id = getEventHash(event);
            event.sig = await signEvent(event, this.nostrPrivateKey);

            for (const relayUrl of this.connectedRelays) {
                const relay = this.relayObjects[relayUrl];
                if (relay) {
                    relay.publish(event);
                } else {
                    console.warn(`Relay ${relayUrl} not connected.`);
                    this.app.showNotification(`Relay ${relayUrl} not connected.`, 'warning');
                }
            }
        } catch (error) {
            console.error("Error in publishToRelays:", error);
            this.app.showNotification(`Error in publishToRelays: ${error.message}`, 'error');
        }
    }

    async subscribeToEvents(peerId) {
        try {
            for (const relayUrl of this.connectedRelays) {
                const relay = this.relayObjects[relayUrl];
                if (relay) {
                    const sub = relay.subscribe([{
                        kinds: [this.eventKind],
                        authors: [peerId, this.nostrPublicKey], // Listen for events from peer or self
                        '#p': [this.nostrPublicKey, peerId] // Listen for events tagged to peer or self
                    }]);

                    sub.on('event', event => {
                        try {
                            const messageType = event.content.split(':')[0];
                            const messageData = event.content.substring(event.content.indexOf(':') + 1);

                            switch (messageType) {
                                case 'offer':
                                    this.onOfferReceivedCallback(event.pubkey, messageData);
                                    break;
                                case 'answer':
                                    this.onAnswerReceivedCallback(event.pubkey, messageData);
                                    break;
                                case 'icecandidate':
                                    try {
                                        const candidate = JSON.parse(messageData);
                                        this.onIceCandidateReceivedCallback(event.pubkey, candidate);
                                    } catch (e) {
                                        console.error("Failed to parse ice candidate", e);
                                        this.app.showNotification(`Failed to parse ice candidate: ${e.message}`, 'error');
                                    }
                                    break;
                            }
                        } catch (error) {
                            console.error("Error handling event:", error);
                            this.app.showNotification(`Error handling event: ${error.message}`, 'error');
                        }
                    });
                    this.subscriptions[relayUrl] = sub;
                } else {
                    console.warn(`Relay ${relayUrl} not connected.`);
                    this.app.showNotification(`Relay ${relayUrl} not connected.`, 'warning');
                }
            }
        } catch (error) {
            console.error("Error in subscribeToEvents:", error);
            this.app.showNotification(`Error in subscribeToEvents: ${error.message}`, 'error');
        }
    }

    initiateConnection(peerId, onOffer) {
        try {
            this.onOfferReceivedCallback = onOffer;
            this.subscribeToEvents(peerId); // Subscribe before sending offer

            //Process any ice candidates that arrived before the offer
            if (this.iceCandidateQueue[peerId]) {
                this.iceCandidateQueue[peerId].forEach(candidate => {
                    this.sendIceCandidate(peerId, candidate);
                });
                delete this.iceCandidateQueue[peerId];
            }
        } catch (error) {
            console.error("Error in initiateConnection:", error);
            this.app.showNotification(`Error in initiateConnection: ${error.message}`, 'error');
        }
    }

    acceptConnection(peerId, onAnswer) {
        try {
            this.onAnswerReceivedCallback = onAnswer;
            this.subscribeToEvents(peerId); // Subscribe before sending answer
        } catch (error) {
            console.error("Error in acceptConnection:", error);
            this.app.showNotification(`Error in acceptConnection: ${error.message}`, 'error');
        }
    }

    async sendIceCandidate(peerId, candidate) {
        try {
            if (!this.onOfferReceivedCallback) {
                if (!this.iceCandidateQueue[peerId]) {
                    this.iceCandidateQueue[peerId] = [];
                }
                this.iceCandidateQueue[peerId].push(candidate);
                return;
            }

            const event = {
                kind: this.eventKind,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', peerId]],
                content: `icecandidate:${JSON.stringify(candidate)}`,
                pubkey: this.nostrPublicKey,
            };
            await this.publishToRelays(event);
        } catch (error) {
            console.error("Error in sendIceCandidate:", error);
            this.app.showNotification(`Error in sendIceCandidate: ${error.message}`, 'error');
        }
    }

    sendOffer(peerId, offer) {
        try {
            const event = {
                kind: this.eventKind,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', peerId]],
                content: `offer:${offer}`,
                pubkey: this.nostrPublicKey,
            };
            this.publishToRelays(event);
        } catch (error) {
            console.error("Error in sendOffer:", error);
            this.app.showNotification(`Error in sendOffer: ${error.message}`, 'error');
        }
    }

    sendAnswer(peerId, answer) {
        try {
            const event = {
                kind: this.eventKind,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', peerId]],
                content: `answer:${answer}`,
                pubkey: this.nostrPublicKey,
            };
            this.publishToRelays(event);
        } catch (error) {
            console.error("Error in sendAnswer:", error);
            this.app.showNotification(`Error in sendAnswer: ${error.message}`, 'error');
        }
    }

    closeConnection(peerId) {
        // Implement closing logic if needed (e.g., unsubscribe from events)
    }

    onOfferReceived(callback) {
        this.onOfferReceivedCallback = callback;
    }

    onAnswerReceived(callback) {
        this.onAnswerReceivedCallback = callback;
    }

    onIceCandidateReceived(callback) {
        this.onIceCandidateReceivedCallback = callback;
    }

    setOnOfferReceivedCallback(callback) {
        this.onOfferReceivedCallback = callback;
    }

    setOnAnswerReceivedCallback(callback) {
        this.onAnswerReceivedCallback = callback;
    }

    setOnIceCandidateReceivedCallback(callback) {
        this.onIceCandidateReceivedCallback = callback;
    }
}

export { NostrSignalingProvider };