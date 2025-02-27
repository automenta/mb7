import {format, isValid as isValidDate, parseISO} from "date-fns";

export const formatDate = (timestamp) =>
    timestamp && isValidDate(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp))
        ? format(typeof timestamp === "string" ? parseISO(timestamp) : new Date(timestamp), localStorage.getItem("dateFormat") || "Pp")
        : "";

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