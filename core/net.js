import DOMPurify from 'dompurify';
import { getEventHash, nip19, Relay, validateEvent, verifyEvent } from 'nostr-tools';
import { nanoid } from 'nanoid';
import { getTagDefinition } from './ontology';
import { NostrSignalingProvider } from './signaling';
import { RelayManager } from './relay-manager';
import { EventHandler } from './event-handler';

const pubkeyRegex = /^[0-9a-fA-F]{64}$/;

export class Nostr {
    constructor(app, signalingStrategy, nostrRelays, nostrPrivateKey) {
        this.app = app;
        this.signalingStrategy = signalingStrategy;
        this.nostrRelays = nostrRelays;
        this.nostrPrivateKey = nostrPrivateKey;
        this.relays = ["wss://relay.damus.io", "wss://relay.snort.social"]; // Default relays, can be overridden
        this.subscriptions = {};
        this.relayStatuses = {};
        this.relayObjects = {};

        this.relayManager = new RelayManager(this.app, this.relays, this.relayStatuses, this.relayObjects);
        this.eventHandler = new EventHandler(this.app);
    }

    setRelays(relays) {
        this.relayManager.setRelays(relays);
    }

    connect() {
        this.relayManager.connect();
    }

    async onEvent(event) {
        if (!validateEvent(event) || !verifyEvent(event)) {
            console.warn("Invalid event received:", event);
            return;
        }

        switch (event.kind) {
            case 1:
                await this.app.matcher.matchEvent(event);
                const timeStr = new Date(event.created_at * 1000).toLocaleTimeString();
                const nostrFeed = document.getElementById("nostr-feed");
                if (nostrFeed) {
                    nostrFeed.prepend(DOMPurify.sanitize("<div>[" + timeStr + "] " + nip19.npubEncode(event.pubkey) + ": " + event.content + "</div>"));
                    Array.from(nostrFeed.children).slice(20).forEach(child => nostrFeed.removeChild(child));
                }
                break;
            case 0:
                await this.eventHandler.handleKind0(event);
            case 3:
                await this.eventHandler.handleKind3(event);
            case 5:
                await this.eventHandler.handleKind5(event);
            case 30000:
                await this.eventHandler.handleObjectEvent(event);
                break;
        }
    }

    async publish(object) {
        try {
            const event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: object.tags.map(tag => {
                    const tagDef = getTagDefinition(tag.name);
                    const serializedValue = tagDef.serialize(tag.value);
                    return [tag.name, ...(Array.isArray(serializedValue) ? serializedValue : [String(serializedValue)])];
                }),
                content: object.content,
                pubkey: window.keys.pub,
            };
            return await this.publishEvent(event);
        } catch (error) {
            console.error("Error publishing object:", error);
            throw error;
        }
    }

    async publishEvent(event) {
        try {
            event.id = getEventHash(event);
            event.sig = await signEvent(event, window.keys.priv);
            await this.publishRawEvent(event)
            return event;
        } catch (error) {
            console.error("Failed to publish event", error);
            this.app.showNotification(`Failed to publish event: ${error.message}`, "error");
            throw error;
        }
    }

    async publishRawEvent(event) {
        try {
            if (!this.relays || this.relays.length === 0) {
                this.app.showNotification("No relays configured. Cannot publish.", "error");
                return
            }
            for (const relayUrl of this.relays) {
                const relayStatus = this.relayStatuses[relayUrl]?.status;
                if (relayStatus === 'connected') {
                    const relay = this.relayObjects[relayUrl];
                    const pub = relay.publish(event);
                    pub.on('ok', () => {
                        console.log(`${relay.url} has accepted our event`);
                    });
                    pub.on('failed', reason => {
                        console.log(`failed to publish to ${relay.url}: ${reason}`);
                        this.app.showNotification(`Failed to publish to ${relayUrl}: ${reason}.`, "warning");
                    });
                } else {
                    console.warn(`Trying to publish to a disconnected relay ${relay.url}`);
                }
            }
        } catch (error) {
            console.error("Error publishing raw event:", error);
            throw error;
        }
    }


    async relayConnected(relay) {
        try {
            await this.subscribe([{ kinds: [30000], authors: [window.keys.pub] }], {
                relay,
                onEvent: this.eventHandler.handleObjectEvent.bind(this.eventHandler)
            });
            await this.subscribe([{ kinds: [1] }], { relay, id: `feed-${relay.url}` });
            await this.subscribeToFriends(relay);
        } catch (error) {
            console.error("Error in relayConnected:", error);
        }
    }

    async connectToPeer(pubkey) {
        try {
            for (const relayUrl of this.relays) {
                if (this.relayStatuses[relayUrl]?.status === 'connected') {
                    await this.subscribeToPubkey(this.relayObjects[relayUrl], pubkey);
                }
            }
        } catch (error) {
            console.error("Error connecting to peer:", error);
        }
    }

    async subscribeToPubkey(relay, pubkey) {
        try {
            const subId = `friend_${pubkey}`;
            await this.unsubscribe({ relay: relay.url, id: subId });

            await this.subscribe([{ kinds: [1, 30000], authors: [pubkey] }, { kinds: [1, 30000], '#p': [pubkey] }], {
                relay,
                id: subId
            });
        } catch (error) {
            console.error("Error subscribing to pubkey:", error);
        }
    }

    async subscribeToFriends(relay) {
        try {
            const friendsObjectId = await this.app.db.getFriendsObjectId();
            await this.subscribe([{ kinds: [30000], ids: [friendsObjectId] }], {
                relay,
                id: `friends-object`,
                onEvent: this.eventHandler.handleObjectEvent.bind(this.eventHandler)
            });
        } catch (error) {
            console.error("Error subscribing to friends:", error);
        }
    }
    /**
     * Establishes a direct peer-to-peer connection using WebRTC.
     * @param {string} peerId - The ID of the peer to connect to.
     */
    async connectWebRTC(peerId, isInitiator) {
        let signalingProvider;
        try {
            if (this.signalingStrategy === "nostr") {
                signalingProvider = new NostrSignalingProvider(this.nostrRelays.split("\n").map(l => l.trim()).filter(Boolean), this.nostrPrivateKey, this.app);
            } else {
                console.error("WebRTC signaling server not implemented");
                this.app.showNotification("WebRTC signaling server not implemented", "error");
                return;
            }

            try {
                const peerConnection = new RTCPeerConnection();

                peerConnection.onicecandidate = (event) => {
                    if (event.candidate) {
                        signalingProvider.sendIceCandidate(peerId, event.candidate);
                    }
                };

                signalingProvider.onIceCandidateReceived((remotePeerId, candidate) => {
                    peerConnection.addIceCandidate(candidate);
                });

                if (isInitiator) {
                    // Initiator creates offer
                    const offer = await peerConnection.createOffer();
                    await peerConnection.setLocalDescription(offer);

                    signalingProvider.initiateConnection(peerId, async (remoteAnswer) => {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
                    });

                    signalingProvider.sendOffer(peerId, offer.sdp);

                } else {
                    // Receiver accepts offer
                    signalingProvider.onOfferReceived(async (remotePeerId, remoteOffer) => {
                        await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteOffer));
                        const answer = await peerConnection.createAnswer();
                        await peerConnection.setLocalDescription(answer);

                        signalingProvider.acceptConnection(peerId, async (remoteAnswer) => {
                            await peerConnection.setRemoteDescription(new RTCSessionDescription(remoteAnswer));
                        });

                        signalingProvider.sendAnswer(peerId, answer.sdp);
                    });
                }

                //Data Channel
                const dataChannel = peerConnection.createDataChannel("dataChannel");
                dataChannel.onopen = () => {
                    console.log("Data channel is open");
                }
                dataChannel.onmessage = (event) => {
                    console.log("Received Message", event.data);
                }
            } catch (error) {
                console.error("Error in connectWebRTC:", error);
                this.app.showNotification(`Error in connectWebRTC: ${error.message}`, 'error');
            }
        } catch (error) {
            console.error("Error creating signaling provider:", error);
            this.app.showNotification(`Error creating signaling provider: ${error.message}`, 'error');
        }
    }

    /**
     * Handles incoming WebRTC data channel messages.
     * @param {MessageEvent} event - The message event.
     */
    handleWebRTCMessage(event) {
        // TODO: Process incoming WebRTC message
        console.log(`Received WebRTC message: ${event.data} (not implemented)`);
    }


    async disconnectFromAllRelays() {
        this.relayManager.disconnectFromAllRelays();
    }
    async subscribeToFriends(relay) {
        try {
            const friendsObjectId = await this.app.db.getFriendsObjectId();
            await this.subscribe([{ kinds: [30000], ids: [friendsObjectId] }], {
                relay,
                id: `friends-object`,
                onEvent: this.eventHandler.handleObjectEvent.bind(this.eventHandler)
            });
        } catch (error) {
            console.error("Error subscribing to friends:", error);
        }
    }
    async subscribeToPubkey(relay, pubkey) {
        try {
            const subId = `friend_${pubkey}`;
            await this.unsubscribe({ relay: relay.url, id: subId });

            await this.subscribe([{ kinds: [1, 30000], authors: [pubkey] }, { kinds: [1, 30000], '#p': [pubkey] }], {
                relay,
                id: subId
            });
        } catch (error) {
            console.error("Error subscribing to pubkey:", error);
        }
    }
}