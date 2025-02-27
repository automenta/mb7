import DOMPurify from 'dompurify';
import {getEventHash, nip19, Relay, validateEvent, verifyEvent} from 'nostr-tools';
import {nanoid} from 'nanoid';
import {getTagDefinition} from './ontology';

const pubkeyRegex = /^[0-9a-fA-F]{64}$/;

export class Nostr {
    constructor(app) {
        this.app = app;
        this.relays = ["wss://relay.damus.io", "wss://relay.snort.social"];
        this.subscriptions = {};
        this.relayStatuses = {};
        this.relayObjects = {};
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

        this.relayStatuses[relayUrl] = {status: "connecting"};

        try {
            const relay = await Relay.connect(relayUrl);
            this.relayObjects[relayUrl] = relay;

            await this.onOpen(relay);

        } catch (error) {
            console.error("WebSocket connection error:", error);
            this.relayStatuses[relayUrl] = {status: "error"};
        }
    }

    async onOpen(relay) {
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
            this.relayStatuses[relay.url].status = "disconnected";
        } catch (error) {
            console.error("Error handling close:", error);
        }
    }


    async subscribe(filters, options) {
        const relay = options.relay;
        const subId = options.id || nanoid();
        try {
            if (relay) {
                const sub = await relay.subscribe(filters, {
                    id: subId, onevent: options.onEvent || this.onEvent.bind(this), eose: () => {
                        console.log(`EOSE from ${relay.url} for subscription ${subId}`);
                    }
                });
                this.subscriptions[relay.url] = {...(this.subscriptions[relay.url] || {}), [subId]: sub};
                return {relay: relay.url, id: subId};
            } else {
                for (const relayUrl of this.relays) {
                    if (this.relayStatuses[relayUrl]?.status === 'connected') {
                        const relay = this.relayObjects[relayUrl];
                        const sub = await relay.subscribe(filters, {
                            id: subId,
                            onevent: options.onEvent || this.onEvent.bind(this),
                            eose: () => {
                                console.log(`EOSE from ${relay.url} for subscription ${subId}`);
                            }
                        });
                        this.subscriptions[relayUrl] = {...(this.subscriptions[relayUrl] || {}), [subId]: sub};
                    }
                }
                return {id: subId};
            }
        } catch (error) {
            console.error("Error subscribing:", error);
            throw error;
        }
    }

    async unsubscribe(subInfo) {
        try {
            if (!subInfo) return;

            if (subInfo.relay) {
                const r = this.subscriptions[subInfo.relay];
                if (r && r[subInfo.id]) {
                    await r[subInfo.id].close();
                    delete r[subInfo.id];
                }
            } else {
                for (let relayUrl in this.subscriptions) {
                    const u = this.subscriptions[relayUrl];
                    if (u[subInfo.id]) {
                        await u[subInfo.id].close();
                        delete u[subInfo.id];
                    }
                }
            }
        } catch (error) {
            console.error("Error unsubscribing:", error);
            throw error;
        }
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
                await this.handleKind0(event);
                break;
            case 3:
                await this.handleKind3(event);
                break;
            case 5:
                await this.handleKind5(event);
                break;
            case 30000:
                await this.handleObjectEvent(event);
                break;
        }
    }

    async handleKind0(event) {
        try {
            const profileData = JSON.parse(event.content);
            if (event.pubkey === window.keys.pub) {
                this.app.settingsView?.displayProfile(profileData);
            } else {
                await this.app.db.updateFriendProfile(event.pubkey, profileData.name, profileData.picture);
                if (this.app.mainContent.currentView instanceof this.app.FriendsView && (await this.app.db.getFriend(event.pubkey))) {
                    await this.app.friendsView.loadFriends();
                }
            }
        } catch (error) {
            console.error("Error processing Kind 0 event:", error);
        }
    }

    async handleKind3(event) {
        try {
            let contacts = [];
            try {
                const content = JSON.parse(event.content);
                if (Array.isArray(content)) {
                    contacts = content;
                } else if (typeof content === 'object' && content !== null) {
                    contacts = Object.keys(content);
                }
            } catch (e) {
                console.warn("Error parsing content:", e);
            }

            const pTags = event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
            contacts = contacts.concat(pTags);

            contacts = [...new Set(contacts)];

            for (const pubkey of contacts) {
                if (pubkeyRegex.test(pubkey) && pubkey !== window.keys.pub) {
                    await this.app.db.addFriend(pubkey);
                    await this.subscribe([{kinds: [0], authors: [pubkey]}], {id: `friend-profile-${pubkey}`});
                }
            }
            if (event.pubkey === window.keys.pub) {
                await this.app.friendsView?.loadFriends();
            }
        } catch (error) {
            console.error("Error processing kind 3 event:", error);
        }
    }

    async handleKind5(event) {
        try {
            const eventIdsToDelete = event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1]);
            for (const eventId of eventIdsToDelete) {
                try {
                    await this.app.db.delete(eventId);
                } catch (error) {
                    console.error(`Failed to delete object with id ${eventId}: `, error);
                }
            }

            if (this.app.mainContent.currentView instanceof this.app.ContentView) {
                await this.app.renderList();
            }
        } catch (error) {
            console.error("Error handling kind 5 event:", error);
        }
    }

    async handleObjectEvent(event) {
        try {
            if (!event.content || event.content.trim()[0] !== "{") return;
            const data = JSON.parse(event.content);
            if (!data.id) return;

            const existingObj = await this.app.db.get(data.id);
            const nobj = {
                ...existingObj,
                id: data.id,
                name: data.name,
                content: DOMPurify.sanitize(data.content),
                tags: this.extractTagsFromEvent(event),
                createdAt: existingObj?.createdAt || (event.created_at * 1000),
                updatedAt: event.created_at * 1000,
            };
            await this.app.db.save(nobj);

        } catch (error) {
            console.error("Parsing error", error);
        }
    }

    extractTagsFromEvent(event) {
        const tags = [];
        for (const tag of event.tags) {
            if (tag.length >= 2) {
                const tagName = tag[0];
                const tagValue = tag[1];

                if (tagName === 't') {
                    tags.push({name: tagValue, condition: 'is', value: ''})
                } else {
                    let condition = 'is';
                    let value = tagValue;

                    if ((tagName === 'p' || tagName === 'e') && tag.length >= 2) {
                        condition = 'references';
                    }
                    tags.push({name: tagName, condition, value});
                }
            }
        }
        return tags;
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
            await this.subscribe([{kinds: [30000], authors: [window.keys.pub]}], {
                relay,
                onEvent: this.handleObjectEvent.bind(this)
            });
            await this.subscribe([{kinds: [1]}], {relay, id: `feed-${relay.url}`});
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
            await this.unsubscribe({relay: relay.url, id: subId});

            await this.subscribe([{kinds: [1, 30000], authors: [pubkey]}, {kinds: [1, 30000], '#p': [pubkey]}], {
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
            await this.subscribe([{kinds: [30000], ids: [friendsObjectId]}], {
                relay,
                id: `friends-object`,
                onEvent: this.handleObjectEvent.bind(this)
            });
        } catch (error) {
            console.error("Error subscribing to friends:", error);
        }
    }

    async disconnectFromAllRelays() {
        try {
            for (const relayUrl in this.relayObjects) {
                await this.relayObjects[relayUrl].close();
            }
            this.relayStatuses = {};
            this.relayObjects = {};
            this.subscriptions = {};
        } catch (error) {
            console.error("Error disconnecting from relays:", error);
        }
    }
}