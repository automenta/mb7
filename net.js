import { relayInit, getEventHash, signEvent } from "https://esm.sh/nostr-tools@1.8.0";

/** generate a Nostr private key */
export const privateKey = () => {
    const array = new Uint8Array(32);
    window.crypto.getRandomValues(array);
    return Array.from(array)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
};

export class Nostr {
    constructor(matcher) {
        this.matcher = matcher;
        this.relayUrl = "wss://relay.damus.io";
        this.relay = relayInit(this.relayUrl);
        this.setupRelayEvents();
    }

    connect() {
        this.relay.connect();
    }

    setupRelayEvents() {
        this.relay.on("connect", () => {
            console.log("Connected to relay");
            $("#nostr-connection-status").text("Connected");
            this.subscribe();
            this.subscribeFeed();
        });
        this.relay.on("error", (err) => {
            console.error("Relay error", err);
            $("#nostr-connection-status").text(`Error: ${err}`);
        });
        this.relay.on("disconnect", () => {
            console.log("Disconnected");
            $("#nostr-connection-status").text("Disconnected");
        });
    }
    subscribe() {
        this.relay.sub([{ kinds: [30000] }]).on("event", (ev) => {
            try {
                if (!ev.content || ev.content.trim()[0] !== "{") return;
                const data = JSON.parse(ev.content);
                if (!data.id) return;
                const sanitizedContent = DOMPurify.sanitize(data.content);
                window.app.db.getAll().then(allObjs => {
                    const existingObj = allObjs.find(o => o.id === data.id);
                    const nobj = existingObj
                        ? { ...existingObj, name: data.name, content: sanitizedContent, tags: ev.tags.filter(t => t[0] === "t").map(t => t[1]), updatedAt: ev.created_at * 1000 }
                        : { id: data.id, name: data.name, content: sanitizedContent, tags: ev.tags.filter(t => t[0] === "t").map(t => t[1]), createdAt: ev.created_at * 1000, updatedAt: ev.created_at * 1000 };
                    window.app.db.save(nobj).then(() => window.app.renderList());
                });
            } catch (e) {
                console.error("Parsing error", e);
            }
        });
    }
    subscribeFeed() {
        this.relay.sub([{ kinds: [1] }]).on("event", (ev) => {
            const timeStr = dateFns.format(new Date(ev.created_at * 1000), "p");
            $("#nostr-feed")
                .prepend(
                    `<div>[${timeStr}] ${ev.pubkey}: ${DOMPurify.sanitize(ev.content)}</div>`
                )
                .children(":gt(19)")
                .remove();
            this.matcher.matchEvent(ev);
        });
    }
    publish(nobj) {
        const sanitizedContent = DOMPurify.sanitize(nobj.content);
        const content = JSON.stringify({
            id: nobj.id,
            name: nobj.name,
            content: sanitizedContent,
        });
        const ev = {
            pubkey: window.keys.pub,
            created_at: Math.floor(nobj.updatedAt / 1000),
            kind: 30000,
            tags: nobj.tags.map(tag => ["t", tag]),
            content,
        };
        ev.id = getEventHash(ev);
        ev.sig = signEvent(ev, window.keys.priv);
        this.relay.publish(ev);
    }
}
