/**
 * Ingests NObjects from Nostr, validates, sanitizes, and deduplicates them.
 * @param {object} event - The Nostr event.
 */
async function ingestNObject(event) {
    // TODO: Implement Nostr ingestion logic here.
}

export {ingestNObject};
import DOMPurify from 'dompurify';
import {getEventHash, nip19, validateEvent, verifyEvent} from 'nostr-tools';
import {getTagDefinition} from './ontology';
import {RelayManager} from './net/net.relays';
import {EventHandler} from './net/net.events';

//const pubkeyRegex = /^[0-9a-fA-F]{64}$/;

export class Nostr {
    constructor(app, signalingStrategy, nostrRelays, nostrPrivateKey, yDoc) {
        this.app = app;
        this.signalingStrategy = signalingStrategy;
        this.nostrRelays = nostrRelays;
        this.nostrPrivateKey = nostrPrivateKey;
        this.relays = ["wss://relay.damus.io", "wss://relay.snort.social"]; // Default relays, can be overridden
        this.subscriptions = {};
        this.relayStatuses = {};
        this.relayObjects = {};
        this.lastPublishTime = null;
        this.yDoc = yDoc;

        this.relayManager = new RelayManager(this, this.relays, this.relayStatuses, this.relayObjects, this.relayConnected.bind(this), this.app.showNotification);
        this.eventHandler = new EventHandler(this.app);
    }

    async sendDM(pubkey, content) {
        try {
            const event = {
                kind: 4,
                created_at: Math.floor(Date.now() / 1000),
                tags: [['p', pubkey]],
                content: content,
                pubkey: window.keys.pub,
            };
            await this.publishEvent(event);
        } catch (error) {
            this.app.errorHandler.handleError(error, 'Error sending DM');
        }
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
        try {
            if (!validateEvent(event) || !verifyEvent(event)) {
                return;
            }

            // Implement rate limiting
            const now = Date.now();
            if (this.lastEventTime && now - this.lastEventTime < 100) {
                return;
            }
            this.lastEventTime = now;

            const eventHandlers = {
                1: this.handleKind1Event.bind(this),
                0: this.handleKind0Event.bind(this),
                3: this.handleKind3Event.bind(this),
                5: this.handleKind5Event.bind(this),
                30000: this.handleKind30000Event.bind(this),
            };

            const handler = eventHandlers[event.kind];
            if (handler) {
                await handler(event);
            } else {
                console.log("Unhandled event kind:", event.kind);
            }
        } catch (error) {
            console.error("Error handling event:", event, error);
            this.app.showNotification(`Error handling event: ${error.message}`, "error");
        }
    }

    async handleKind1Event(event) {
        await this.app.matcher.matchEvent(event);
        const timeStr = new Date(event.created_at * 1000).toLocaleTimeString();
        const nostrFeed = document.getElementById("nostr-feed");
        if (nostrFeed) {
            nostrFeed.prepend(DOMPurify.sanitize("<div>[" + timeStr + "] " + nip19.npubEncode(event.pubkey) + ": " + event.content + "</div>"));
            Array.from(nostrFeed.children).slice(20).forEach(child => nostrFeed.removeChild(child));
        }
    }

    async handleKind0Event(event) {
        await this.eventHandler.handleKind0(event);
    }

    async handleKind3Event(event) {
        await this.eventHandler.handleKind3(event);
    }

    async handleKind5Event(event) {
        await this.eventHandler.handleKind5(event);
    }

    async handleKind30000Event(event) {
        await this.eventHandler.handleObjectEvent(event);
    }

    async publish(object) {
        try {
            // Rate limiting
            if (this.lastPublishTime && Date.now() - this.lastPublishTime < 1000) {
                throw new Error('Rate limit exceeded. Please wait before publishing again.');
            }

            // Validate object
            if (!object) {
                throw new Error('Object cannot be null or undefined');
            }

            const event = {
                kind: 1,
                created_at: Math.floor(Date.now() / 1000),
                tags: object.tags.map(tag => {
                    const tagDef = getTagDefinition(tag[0]);
                    const serializedValue = tagDef.serialize(tag[1]);
                    return [tag[0], ...(Array.isArray(serializedValue) ? serializedValue : [String(serializedValue)])];
                }),
                content: DOMPurify.sanitize(object.content, {
                    ALLOWED_TAGS: ["br", "b", "i", "span", "p", "strong", "em", "ul", "ol", "li", "a"],
                    ALLOWED_ATTR: ["class", "contenteditable", "tabindex", "id", "aria-label"]
                }), // Sanitize content
                pubkey: window.keys.pub,
            };
            this.lastPublishTime = Date.now();
            return await this.publishEvent(event);
        } catch (error) {
            console.error("Error publishing object:", error);
            this.app.showNotification(`Error in publish: ${error.message}`, "error");
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
            this.app.showNotification(`Failed to publish event in publishEvent: ${error.message}`, "error");
            throw error;
        }
    }

    async publishRawEvent(event) {
        try {
            try {
                if (!this.relays || this.relays.length === 0) {
                    this.app.showNotification("No relays configured. Cannot publish.", "error");
                    return
                }
                // Implement retry mechanism with exponential backoff
                const maxRetries = 3;
                for (let i = 0; i < maxRetries; i++) {
                    const delay = Math.pow(2, i) * 1000; // Exponential backoff: 1s, 2s, 4s
                    await new Promise(resolve => setTimeout(resolve, delay));
                    try {
                        // Retry publishing
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
                            }
                        }
                        // If publishing is successful, exit the retry loop
                        return;
                    } catch (retryError) {
                        console.error(`Retry ${i + 1} failed:`, retryError);
                        this.app.showNotification(`Retry ${i + 1} failed: ${retryError.message}`, "warning");
                    }
                }
                // If all retries fail, notify the user
                this.app.showNotification("Failed to publish event after multiple retries.", "error");
                throw error;
            } catch (error) {
                console.error("Error publishing raw event:", error);
                this.app.errorHandler.handleError(error, 'Error publishing raw event in publishRawEvent');
                throw error;
            }
        } catch (error) {
            console.error("Error publishing raw event:", error);
            throw error;
        }
    }


    async relayConnected(relay) {
        try {
            console.log(`Relay status before update: ${this.relayStatuses[relay.url]}`);

            const nostr = this;
            console.log("relayConnected: relay.url =", relay.url);
            const relayObject = this.relayObjects[relay.url];
            console.log("relayConnected: relayObject =", relayObject);
            console.log("relayConnected: window.keys =", window.keys);
            await this.subscribeToFriends(relay);
            await relayObject.subscribe([{kinds: [30000], authors: [window.keys.pub]}], {
                relay: relayObject,
                id: `object-${relay.url}`,
                onEvent: this.eventHandler.handleObjectEvent.bind(this.eventHandler)
            });
            await relay.subscribe([{kinds: [1]}], {
                relay: relayObject, id: `feed-${relay.url}`, onevent: (event) => {
                    nostr.onevent(event);
                }
            });
        } catch (error) {
            console.error("Error in relayConnected:", error);
            this.app.showNotification(`Error in relayConnected: ${error.message}`, "error");
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
            this.app.showNotification(`Error in connectToPeer: ${error.message}`, "error");
        }
    }


    async subscribeToFriends(relay) {
        try {
            const friendsObjectId = await this.app.db.getFriendsObjectId();
            if (!friendsObjectId) {
                return;
            }
            await relay.subscribe([{kinds: [30000], ids: [friendsObjectId]}], {
                relay,
                id: `friends-object-${relay.url}`,
                onEvent: this.eventHandler.handleObjectEvent.bind(this.eventHandler)
            });
        } catch (error) {
            console.error("Error subscribing to friends:", error);
            this.app.showNotification(`Error in subscribeToFriends: ${error.message}`, "error");
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
            this.app.showNotification(`Error in subscribeToPubkey: ${error.message}`, "error");
        }
    }
}
