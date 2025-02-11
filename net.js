// net.js
import { getEventHash, relayInit, signEvent, nip19 } from "https://esm.sh/nostr-tools@1.8.0";

export class Nostr {
    constructor(matcher) {
        this.matcher = matcher;
        this.relays = ["wss://relay.damus.io", "wss://relay.snort.social"]; // Use multiple relays
        this.subscriptions = {}; // Keep track of subscriptions
    }

    connect() {
        this.relays.forEach(relayUrl => {
            try {
                const relay = relayInit(relayUrl);
                relay.on("connect", () => {
                    console.log(`Connected to ${relayUrl}`);
                    this.relayConnected(relay); // Call common connection handler

                });
                relay.on("error", (err) => {
                    console.error(`Relay error (${relayUrl}):`, err);
                });
                relay.on("disconnect", () => {
                    console.log(`Disconnected from ${relayUrl}`);
                    this.relayDisconnected(relay);
                });

                relay.connect();
                relay.url = relayUrl; // Store the URL for later use
                this.relay = relay;

            } catch (error) {
                console.error(`Failed to initialize relay ${relayUrl}`, error)
            }
        });
    }

    // Common handler for relay connections
    relayConnected(relay) {
        $("#network-status").text("Connected"); //generic status
        this.subscribe(relay);
        this.subscribeFeed(relay);
        this.subscribeToFriends(relay); // Subscribe to friends' updates
    }

    relayDisconnected(relay) {
        //check if *all* relays are disconnected
        if (this.relays.every(r => {
            const testRelay = relayInit(r);
            return testRelay.status === 3; // 3 = CLOSED (per Nostr spec)
        })) {
            $("#network-status").text("Disconnected");
        }
    }

    subscribe(relay) {
        if (this.subscriptions[relay.url] && this.subscriptions[relay.url].objects) {
            this.subscriptions[relay.url].objects.unsub(); // Unsubscribe first
        }
        const sub = relay.sub([{ kinds: [30000], authors: [window.keys.pub] }]);
        sub.on("event", this.handleObjectEvent.bind(this));
        // Store the subscription
        this.subscriptions[relay.url] = { ...(this.subscriptions[relay.url] || {}), objects: sub };
    }


    subscribeFeed(relay) {
        if (this.subscriptions[relay.url] && this.subscriptions[relay.url].feed) {
            this.subscriptions[relay.url].feed.unsub(); //unsub first
        }
        const sub = relay.sub([{ kinds: [1] }]); // Subscribe to kind 1 (short text notes)
        sub.on("event", (ev) => {
            const timeStr = new Date(ev.created_at * 1000).toLocaleTimeString();
            $("#nostr-feed") //Assuming an element with this ID exists
                .prepend(`<div>[${timeStr}] ${ev.pubkey}: ${DOMPurify.sanitize(ev.content)}</div>`)
                .children(":gt(19)")
                .remove();
            this.matcher.matchEvent(ev);
        });
        this.subscriptions[relay.url] = { ...(this.subscriptions[relay.url] || {}), feed: sub };
    }

    async handleObjectEvent(ev) {
        try {
            if (!ev.content || ev.content.trim()[0] !== "{") return;
            const data = JSON.parse(ev.content);
            if (!data.id) return;

            const existingObj = await window.app.db.get(data.id);
            const nobj = {
                ...existingObj, // Preserve existing data
                id: data.id,
                name: data.name,
                content: DOMPurify.sanitize(data.content),
                tags: this.extractTagsFromEvent(ev), // Use a dedicated function
                createdAt: existingObj?.createdAt || (ev.created_at * 1000), // Keep existing, if present
                updatedAt: ev.created_at * 1000,
            };
            await window.app.db.save(nobj);

        } catch (e) {
            console.error("Parsing error", e);
        }
    }

    extractTagsFromEvent(event) {
        // Extract and normalize tags, handling both 't' and custom tags
        const tags = [];
        for (const tag of event.tags) {
            if (tag.length >= 2) {
                const tagName = tag[0];
                const tagValue = tag[1];

                if(tagName === 't') {
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
                    tags.push({ name: tagName, condition, value});
                }
            }
        }
        return tags;
    }

    publish(nobj) {
        const content = JSON.stringify({ id: nobj.id, name: nobj.name, content: DOMPurify.sanitize(nobj.content) });
        const ev = {
            pubkey: window.keys.pub,
            created_at: Math.floor(Date.now()/1000), //Use the *current* time
            kind: 30000,
            tags: nobj.tags.map(tag => [tag.name, tag.value, tag.condition]),  // Include condition if needed
            content,
        };
        ev.id = getEventHash(ev);
        ev.sig = signEvent(ev, window.keys.priv);

        // Publish to all connected relays
        this.relays.forEach(async relayUrl => {
            try {
                const relay = relayInit(relayUrl);
                await relay.connect(); // Ensure connection (important!)
                let pub = relay.publish(ev)
                pub.on('ok', () => {
                    console.log(`${relay.url} has accepted our event`)
                })
                pub.on('failed', reason => {
                    console.log(`failed to publish to ${relay.url}: ${reason}`)
                })
            } catch (error) {
                console.error(`Failed to publish to ${relayUrl}`, error)
            }
        });
    }

    async publishRawEvent(event) {
        this.relays.forEach(async relayUrl => {
            try {
                const relay = relayInit(relayUrl);
                await relay.connect();
                let pub = relay.publish(event)
                pub.on('ok', () => {
                    console.log(`${relay.url} has accepted our event`)
                })
                pub.on('failed', reason => {
                    console.log(`failed to publish to ${relay.url}: ${reason}`)
                })
            } catch(error) {
                console.error(`Failed to publish raw event to ${relayUrl}`, error)
            }
        });
    }

    setRelays(relays) {
        // Unsubscribe from existing relays
        Object.values(this.subscriptions).forEach(subs => {
            Object.values(subs).forEach(sub => sub.unsub());
        });
        this.subscriptions = {}; // Clear subscriptions

        this.relays = relays;
        this.connect(); // Reconnect with the new relays
    }

    connectToPeer(pubkey) {
        // We'll subscribe to events tagged with this pubkey.
        this.relays.forEach(relayUrl => {
            const relay = relayInit(relayUrl);
            if (relay.status === 1) { // Check if connected (0: CONNECTING, 1: CONNECTED, 2: DISCONNECTING, 3: DISCONNECTED)
                this.subscribeToPubkey(relay, pubkey);
            } else {
                relay.on("connect", () => {
                    this.subscribeToPubkey(relay, pubkey);
                });
            }
        });
    }

    subscribeToPubkey(relay, pubkey) {
        // Check for and remove existing subscription for this pubkey on this relay
        if (this.subscriptions[relay.url] && this.subscriptions[relay.url][`friend_${pubkey}`]) {
            this.subscriptions[relay.url][`friend_${pubkey}`].unsub();
            delete this.subscriptions[relay.url][`friend_${pubkey}`];
        }

        const sub = relay.sub([{ kinds: [1, 30000], authors: [pubkey] }, { kinds: [1, 30000], '#p': [pubkey] }]); //Also get posts *mentioning* the pubkey
        sub.on('event', (event) => {
            // Handle the event - display a notification, update UI, etc.
            console.log('Received event from followed pubkey:', event);
            this.matcher.matchEvent(event); // Use the matcher!
            window.app.showNotification(`New event from ${nip19.npubEncode(pubkey)}`, "info"); // Show "nPubKey"
        });

        // Store the subscription
        this.subscriptions[relay.url] = { ...(this.subscriptions[relay.url] || {}), [`friend_${pubkey}`]: sub };
    }

    subscribeToFriends(relay) {
        window.app.db.getFriends().then(friends => {
            friends.forEach(friend => {
                this.subscribeToPubkey(relay, friend.pubkey);
            });
        });
    }
}