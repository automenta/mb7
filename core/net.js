import DOMPurify from 'dompurify';
import {getEventHash, nip19, validateEvent, verifyEvent} from 'nostr-tools';
import {getTagDefinition} from './ontology';
import {WebRTCService} from './net.webrtc';
import {NostrSignalingProvider} from './net/net.signaling';
import {RelayManager} from './net/net.relays';
import {EventHandler} from './net/net.events';

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

        this.relayManager = new RelayManager(this, this.relays, this.relayStatuses, this.relayObjects, this.relayConnected.bind(this), this.app.showNotification);
        this.eventHandler = new EventHandler(this.app);
        this.webRTCService = new WebRTCService(this.app, this.signalingStrategy, this.nostrRelays, this.nostrPrivateKey);
    }

    getSubscriptions() {
        return this.subscriptions;
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
                break;
            case 3:
                await this.eventHandler.handleKind3(event);
                break;
            case 5:
                await this.eventHandler.handleKind5(event);
                break;
            case 30000:
                await this.eventHandler.handleObjectEvent(event);
                break;
            default:
                console.log("Unhandled event kind:", event.kind);
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
            this.app.showNotification(`Error publishing object: ${error.message}`, "error");
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
            const nostr = this;
            await this.subscribeToFriends(relay);
            await relay.subscribe([{kinds: [30000], authors: [window.keys.pub]}], {
                relay,
                id: `object-${relay.url}`,
                onEvent: this.eventHandler.handleObjectEvent.bind(this.eventHandler)
            });
            await relay.subscribe([{kinds: [1]}], {
                relay, id: `feed-${relay.url}`, onevent: (event) => {
                    nostr.onevent(event);
                }
            });
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


    async subscribeToFriends(relay) {
        try {
            const friendsObjectId = await this.app.db.getFriendsObjectId();
            if (!friendsObjectId) {
                console.warn("No friends object id found.");
                return;
            }
            await relay.subscribe([{kinds: [30000], ids: [friendsObjectId]}], {
                relay,
                id: `friends-object-${relay.url}`,
                onEvent: this.eventHandler.handleObjectEvent.bind(this.eventHandler)
            });
        } catch (error) {
            console.error("Error subscribing to friends:", error);
        }
    }

    async subscribeToPubkey(relay, pubkey) {
        try {
            const subId = `friend_${pubkey}`;
            await relay.unsubscribe({id: subId});

            await relay.subscribe([{kinds: [1, 30000], authors: [pubkey]}, {kinds: [1, 30000], '#p': [pubkey]}], {
                relay,
                id: subId
            });
        } catch (error) {
            console.error("Error subscribing to pubkey:", error);
        }
    }
}