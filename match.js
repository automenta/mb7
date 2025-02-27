import Fuse from 'fuse.js';
import {formatDate} from './content-view-renderer.js';
import {nip19} from 'nostr-tools';
import { getTagDefinition } from './ontology';

export class Matcher {
    constructor(app) {
        this.app = app;
        this.fuse = new Fuse([], {
            keys: ["name", "content", "tags.value"],
            threshold: 0.4,
            includeScore: true,
            ignoreLocation: true
        });
    }

    async matchEvent(event) {
        const text = (event.content || "").toLowerCase();
        const matches = [];
        const objects = await this.app.db.getAll();

        for (const obj of objects) {
            if (obj.tags?.some(tagData => this.matchTagData(tagData, text, event)))
                matches.push(obj);
        }

        if (!matches.length) {
            this.fuse.setCollection(objects);
            matches.push(...this.fuse.search(text).filter(r => r.score <= this.fuse.options.threshold).map(r => r.item));
        }

        if (matches.length) {
            //dedupe matches
            const uniqueMatches = [...new Set(matches.map(m => m.id))].map(id => matches.find(m => m.id === id));

            this.app.showNotification(
                `Match in ${uniqueMatches.length} object(s) for event from ${nip19.npubEncode(event.pubkey)}:<br>${uniqueMatches.map(m => `<em>${m.name}</em> (updated ${formatDate(m.updatedAt)})`).join("<br>")}`
            );
        }
    }

    matchTagData(tagData, text, event) {
        const {name, condition, value} = tagData;
        const tagDef = getTagDefinition(name);

        if (!tagDef.validate(value, condition)) return false;

        const checkTime = (val) => {
            if (tagDef.name !== 'time') return false;
            try {
                const eventDate = new Date(event.created_at * 1000);
                const parsedValue = parseISO(val);
                if (!isValidDate(parsedValue)) return false;
                if (condition === "is") return eventDate.getTime() === parsedValue.getTime();
                if (condition === "before") return eventDate < parsedValue;
                if (condition === "after") return eventDate > parsedValue;
            } catch (e) {
                console.warn("Error parsing time:", e);
            }
            return false;
        };

        if (condition === "between" && tagDef.name === "time") {
            try {
                const startDate = parseISO(value.start);
                const endDate = parseISO(value.end);
                const eventDate = new Date(event.created_at * 1000);
                return isValidDate(startDate) && isValidDate(endDate) && eventDate >= startDate && eventDate <= endDate;

            } catch {
                return false;
            }
        } else if (condition === "between" && tagDef.name === "number") {
            const lower = parseFloat(value.lower);
            const upper = parseFloat(value.upper);
            const numValue = parseFloat(text); //Try to get a numeric value
            return !isNaN(lower) && !isNaN(upper) && !isNaN(numValue) && numValue >= lower && numValue <= upper;
        } else if (condition === "matches regex") {
            try {
                return new RegExp(value, "i").test(text);
            } catch (e) {
                console.warn("Error creating regex:", e);
                return false;
            }
        } else if (["is", "contains"].includes(condition)) {
            return text.includes(value?.toLowerCase());
        } else if (["before", "after"].includes(condition)) {
            return checkTime(value);
        }
        return false;
    }
}
