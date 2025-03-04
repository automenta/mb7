import {format, formatISO, isValid as isValidDate, parseISO} from "date-fns";

export const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), localStorage.getItem("dateFormat") || "Pp")
        : "";

export const dateISO = () => formatISO(new Date());

export const renderRecentActivity = async (app, el) => {
    const recent = await app.db.getRecent(5);
    const recentActivity = el.querySelector("#recent-activity");
    recentActivity.innerHTML = recent.map(obj => `<p><strong>${obj.name}</strong> - Updated: ${formatDate(obj.updatedAt)}</p>`).join("");
};

export const renderTagCloud = (app, el) => {
    app.db.getAll().then(objects => {
        const tagCounts = {};
        objects.forEach(obj => obj.tags?.forEach(tag => tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1));
        const tagCloud = el.querySelector("#tag-cloud");
        tagCloud.innerHTML = Object.entries(tagCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(renderTag).join('');

        function renderTag([tagName, count]) {
            return `<span style="font-size:${10 + count * 2}px; margin-right:5px;">${tagName}</span>`;
        }
    });
};


export const renderNostrFeed = async (app, el) => {
    const feedEl = el.querySelector('#nostr-feed');
    try {
        const relayUrl = localStorage.getItem('nostrRelayUrl') || 'wss://relay.damus.io'; // Use localStorage for relay URL
        feedEl.innerHTML = await fetchNostrFeed(relayUrl);
    } catch (error) {
        console.error('Error fetching Nostr feed:', error);
        feedEl.innerHTML = '<p>Error fetching Nostr feed.</p>';
    }
};

async function fetchNostrFeed(relayUrl) {
    try {
        const sub = [
            "REQ",
            "my-sub",
            {
                limit: 10,
                kinds: [1] // Text notes
            }
        ];

        const connection = new WebSocket(relayUrl);
        let feedHTML = '';
        return new Promise((resolve, reject) => {
            connection.onopen = () => {
                connection.send(JSON.stringify(sub));
            };

            connection.onmessage = (event) => {
                const [type, subId, eventData] = JSON.parse(event.data);
                if (type === "EVENT") {
                    const {content: eventContent, pubkey, created_at: createdAt} = eventData;
                    const formattedDate = formatDate(createdAt * 1000); // Convert seconds to milliseconds
                    feedHTML += `<p><strong>${pubkey}</strong> - ${formattedDate}: ${eventContent}</p>`;
                } else if (type === "NOTICE") {
                    //console.log("NOTICE:", data[1]);
                } else {
                    //console.log("Unknown message type:", data);
                }
            };

            connection.onerror = (error) => {
                console.error('WebSocket error:', error);
                reject('<p>Error fetching Nostr feed.</p>');
            };

            connection.onclose = () => {
                resolve(feedHTML);
            };
        }).finally(() => {
            connection.close();
        });
    } catch (error) {
        console.error('Error fetching Nostr feed:', error);
        return '<p>Error fetching Nostr feed.</p>';
    }
}

export const renderNetworkStatus = (app, el) => {
    const statusEl = el.querySelector('#network-status');
    statusEl.innerHTML = `<p>Network Status: ${navigator.onLine ? 'Online' : 'Offline'}</p>`;
};
