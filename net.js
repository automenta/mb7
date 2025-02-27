import DOMPurify from 'dompurify';
import {getEventHash, nip19, Relay, validateEvent, verifyEvent} from 'nostr-tools';
import {nanoid} from 'nanoid';
import { getTagDefinition } from './ontology';

const pubkeyRegex = /^[0-9a-fA-F]{64}$/;

export class Nostr {
    constructor(app) {
        this.app = app;
        this.relays = ["wss://relay.damus.io", "wss://relay.snort.social"];
        this.subscriptions = {}; // Centralized subscription management
        this.relayStatuses = {}; // Track relay connection status
        this.relayObjects = {}; //Store the actual relay objects
    }

    setRelays(relays) {
        this.disconnectFromAllRelays();
        this.relays = relays;
        this.connect(); // Reconnect with new relays
    }

    connect() {
        this.disconnectFromAllRelays();
        this.connectToRelays(); // Connect to all relays
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
            return; // Already connecting or connected
        }

        //console.log(`Connecting to relay: ${relayUrl}`);
        this.relayStatuses[relayUrl] = {status: "connecting"};

        try {
            const relay = await Relay.connect(relayUrl);
            this.relayObjects[relayUrl] = relay; //Store the relay object

            this.onOpen(relay); // Manually call onOpen, since it might have already happened.

        } catch (error) {
            console.error("WebSocket connection error:", error);
            this.relayStatuses[relayUrl] = {status: "error"};
        }
    }

    onOpen(relay) {
        console.log("Connected to relay:", relay.url);
        this.relayStatuses[relay.url] = {status: "connected"};
        this.relayConnected(relay);
    }

    onNotice(relay, notice) {
        console.log(`NOTICE from ${relay.url}: ${notice}`);
        this.app.showNotification(`NOTICE from ${relay.url}: ${notice}`, "warning");
    }

    onClose(relay) {
        console.log("Disconnected from relay:", relay.url);
        this.relayStatuses[relay.url].status = "disconnected";

        //check if *all* relays are disconnected
        if (this.relays.every(r => this.relayStatuses[r]?.status === "disconnected" || this.relayStatuses[r] === undefined)) {
        }
    }


    // Unified subscription method (supports relay objects)
    subscribe(filters, options) {
        const relay = options.relay;
        const subId = options.id || nanoid();

        if (relay) {
            const sub = relay.subscribe(filters, {
                id: subId, onevent: options.onEvent || this.onEvent.bind(this), eose: () => {
                    console.log(`EOSE from ${relay.url} for subscription ${subId}`);
                }
            });
            this.subscriptions[relay.url] = {...(this.subscriptions[relay.url] || {}), [subId]: sub};
            return {relay: relay.url, id: subId};

        } else {
            //fallback, subscribe to *all* connected relays
            this.relays.forEach(relayUrl => {
                if (this.relayStatuses[relayUrl]?.status === 'connected') {
                    const relay = this.relayObjects[relayUrl];
                    const sub = relay.subscribe(filters, {
                        id: subId,
                        onevent: options.onEvent || this.onEvent.bind(this),
                        eose: () => {
                            console.log(`EOSE from ${relay.url} for subscription ${subId}`);
                        }
                    });
                    this.subscriptions[relayUrl] = {...(this.subscriptions[relayUrl] || {}), [subId]: sub};
                }
            });
            return {id: subId};
        }
    }

    // Unified unsubscription method
    unsubscribe(subInfo) {
        if (!subInfo) return;

        if (subInfo.relay) {
            //a specific relay.
            const r = this.subscriptions[subInfo.relay];
            if (r && r[subInfo.id]) {
                r[subInfo.id].close();
                delete r[subInfo.id];
            }
        } else {
            //unsubscribe from *all* relays
            for (let relayUrl in this.subscriptions) {
                const u = this.subscriptions[relayUrl];
                if (u[subInfo.id]) {
                    u[subInfo.id].close();
                    delete u[subInfo.id];
                }
            }
        }
    }


    async onEvent(event) {
        if (!validateEvent(event) || !verifyEvent(event)) {
            console.warn("Invalid event received:", event);
            return;
        }

        switch (event.kind) {
            case 1:
                await this.app.matcher.matchEvent(event); // Existing content matching
                const timeStr = new Date(event.created_at * 1000).toLocaleTimeString();
                const nostrFeed = document.getElementById("nostr-feed"); // Assuming an element with this ID exists
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
                await this.handleObjectEvent(event); //handle custom object
                break;
        }
    }

    async handleKind0(event) {
        try {
            const profileData = JSON.parse(event.content);
            if (event.pubkey === window.keys.pub) {
                // Update own profile display
                this.app.settingsView?.displayProfile(profileData);
            } else {
                // Update friend's profile (if we're subscribed to it)
                await this.app.db.updateFriendProfile(event.pubkey, profileData.name, profileData.picture);
                // Refresh friends list only if FriendsView is active *AND* this friend is in the list
                if (this.app.mainContent.currentView instanceof this.app.FriendsView && (await this.app.db.getFriend(event.pubkey))) {
                    await this.app.friendsView.loadFriends(); // Refresh the entire list
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

            // Extract p tags
            const pTags = event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
            contacts = contacts.concat(pTags);

            // remove duplicates.
            contacts = [...new Set(contacts)];

            for (const pubkey of contacts) {
                // Check if the pubkey is valid before adding
                if (pubkeyRegex.test(pubkey) && pubkey !== window.keys.pub) {
                    await this.app.db.addFriend(pubkey);
                    // Subscribe to the friend's profile (Kind 0) - Use the unified subscribe
                    this.subscribe([{kinds: [0], authors: [pubkey]}], {id: `friend-profile-${pubkey}`});
                }
            }
            // Refresh friends list if the current user sent the event
            if (event.pubkey === window.keys.pub) {
                await this.app.friendsView?.loadFriends();
            }
        } catch (error) {
            console.error("Error processing kind 3 event:", error);
        }
    }

    async handleKind5(event) {
        const eventIdsToDelete = event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1]);
        for (const eventId of eventIdsToDelete) {
            try {
                await this.app.db.delete(eventId);
            } catch (error) {
                console.error(`Failed to delete object with id ${eventId}: `, error);
            }
        }

        // Refresh the content list if it's the current view
        if (this.app.mainContent.currentView instanceof this.app.ContentView) {
            await this.app.renderList();
        }
    }

    async handleObjectEvent(event) {
        try {
            if (!event.content || event.content.trim()[0] !== "{") return;
            const data = JSON.parse(event.content);
            if (!data.id) return;

            const existingObj = await this.app.db.get(data.id);
            const nobj = {
                ...existingObj, // Preserve existing data
                id: data.id,
                name: data.name,
                content: DOMPurify.sanitize(data.content),
                tags: this.extractTagsFromEvent(event), // Use a dedicated function to extract and normalize tags
                createdAt: existingObj?.createdAt || (event.created_at * 1000), // Keep existing, if present
                updatedAt: event.created_at * 1000,
            };
            await this.app.db.save(nobj);

        } catch (error) {
            console.error("Parsing error", error);
        }
    }

    extractTagsFromEvent(event) {
        // Extract and normalize tags, handling both 't' and custom tags
        const tags = [];
        for (const tag of event.tags) {
            if (tag.length >= 2) {
                const tagName = tag[0];
                const tagValue = tag[1];

                if (tagName === 't') {
                    //keep the "t" tags as they were
                    tags.push({name: tagValue, condition: 'is', value: ''}) //Add the standard tag structure
                } else {
                    //custom tags, like p, e, etc.
                    let condition = 'is'; // Default condition
                    let value = tagValue;

                    //Check the special condition for "p" and "e" tags, following Nostr convention.
                    if ((tagName === 'p' || tagName === 'e') && tag.length >= 2) {
                        condition = 'references'; // Or any other suitable condition name
                    }
                    tags.push({name: tagName, condition, value});
                }
            }
        }
        return tags;
    }

    publish(object) {
        const event = {
            kind: 1, //or 30000 for custom objects.  Using 1 for now.
            created_at: Math.floor(Date.now() / 1000),
            tags: object.tags.map(tag => {
                // Serialize the tag value based on its type
                const tagDef = getTagDefinition(tag.name);
                const serializedValue = tagDef.serialize(tag.value);

                // Construct the tag array as expected by Nostr
                return [tag.name, ...(Array.isArray(serializedValue) ? serializedValue : [String(serializedValue)])];
            }),
            content: object.content,
            pubkey: window.keys.pub,
        };
        this.publishEvent(event);
    }


    async publishEvent(event) {
        try {
            event.id = getEventHash(event);
            event.sig = await signEvent(event, window.keys.priv);
            this.publishRawEvent(event)
            return event;
        } catch (error) {
            console.error("Failed to publish event", error);
            this.app.showNotification(`Failed to publish event: ${error.message}`, "error");
            throw error; // Re-throw for caller handling
        }
    }

    publishRawEvent(event) {
        if (!this.relays || this.relays.length === 0) {
            this.app.showNotification("No relays configured. Cannot publish.", "error");
            return
        }
        this.relays.forEach(relayUrl => {
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
                //optionally, queue the event for later.
            }
        });
    }


    // Common handler for relay connections, for both initial and friend connections
    relayConnected(relay) {
        this.subscribe([{kinds: [30000], authors: [window.keys.pub]}], {
            relay,
            onEvent: this.handleObjectEvent.bind(this)
        }); //custom objects
        this.subscribe([{kinds: [1]}], {relay, id: `feed-${relay.url}`}); // General feed
        this.subscribeToFriends(relay);
    }

    connectToPeer(pubkey) {
        // We'll subscribe to events tagged with this pubkey.
        this.relays.forEach(relayUrl => {
            if (this.relayStatuses[relayUrl]?.status === 'connected') {
                this.subscribeToPubkey(this.relayObjects[relayUrl], pubkey);
            } else {
                //If not connected, we rely on the 'connect' event listener already set up in connectToRelay.
            }
        });
    }

    subscribeToPubkey(relay, pubkey) {
        // Check for and remove existing subscription for this pubkey on this relay
        const subId = `friend_${pubkey}`;
        this.unsubscribe({relay: relay.url, id: subId});

        this.subscribe([{kinds: [1, 30000], authors: [pubkey]}, {kinds: [1, 30000], '#p': [pubkey]}], {
            relay,
            id: subId
        }); //unified subscribe
    }

    async subscribeToFriends(relay) {
        const friendsObjectId = await this.app.db.getFriendsObjectId();
        this.subscribe([{kinds: [30000], ids: [friendsObjectId]}], {
            relay,
            id: `friends-object`,
            onEvent: this.handleObjectEvent.bind(this)
        });
    }

    disconnectFromAllRelays() {
        for (const relayUrl in this.relayObjects) {
            this.relayObjects[relayUrl].close();
        }
        this.relayStatuses = {}; // Reset relay statuses
        this.relayObjects = {};
        this.subscriptions = {}; // Clear subscriptions
    }
}