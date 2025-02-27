import { format, formatISO, isValid as isValidDate, parseISO } from "date-fns";

export const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), localStorage.getItem("dateFormat") || "Pp")
        : "";

export const dateISO = () => formatISO(new Date());

export const renderRecentActivity = async (app, el) => {
    const recent = await app.db.getRecent(5);
    const recentActivity = el.querySelector("#recent-activity");
    recentActivity.innerHTML = recent.map(obj => `<p><strong>${obj.name}</strong> - Updated: ${formatDate(obj.updatedAt)}</p>`).join('');
};

export const renderTagCloud = (app, el) => {
    app.db.getAll().then(objects => {
        const tagCounts = {};
        objects.forEach(obj => obj.tags?.forEach(tag => tagCounts[tag.name] = (tagCounts[tag.name] || 0) + 1));
        const tagCloud = el.querySelector("#tag-cloud");
        tagCloud.innerHTML = Object.entries(tagCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([tagName, count]) => `<span style="font-size:${10 + count * 2}px; margin-right:5px;">${tagName}</span>`).join('');
    });
};


export const renderNostrFeed = async (app, el) => {
    const feedEl = el.querySelector('#nostr-feed');
    try {
        // Replace with actual relay URL
        const relayUrl = 'wss://relay.damus.io';
        const sub = [
            "REQ",
            "my-sub",
            {
                limit: 10,
                kinds: [1] // Text notes
            }
        ];
        const connection = new WebSocket(relayUrl);

        connection.onopen = () => {
            console.log("WebSocket connection opened");
            connection.send(JSON.stringify(sub));
        };

        
                connection.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    console.log("Received message:", data);
                    if (data[0] === "EVENT") {
                        const subId = data[1];
                        const eventContent = data[2].content;
                        feedEl.innerHTML += `<p>[${subId}] ${eventContent}</p>`;
                    } else if (data[0] === "NOTICE") {
                        console.log("NOTICE:", data[1]);
                    } else {
                        console.log("Unknown message type:", data);
                    }
                };
        connection.onerror = (error) => {
            console.error('WebSocket error:', error);
            feedEl.innerHTML = '<p>Error fetching Nostr feed.</p>';
        };
    } catch (error) {
        console.error('Error fetching Nostr feed:', error);
        feedEl.innerHTML = '<p>Error fetching Nostr feed.</p>';
    }
};

export const renderNetworkStatus = (app, el) => {
    const statusEl = el.querySelector('#network-status');
    statusEl.innerHTML = `<p>Network Status: ${navigator.onLine ? 'Online' : 'Offline'}</p>`;
};