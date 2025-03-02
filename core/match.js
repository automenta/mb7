import Fuse from 'fuse.js';
import {formatDate} from '../ui/content-view-renderer.js';
import {nip19} from 'nostr-tools';
import {getTagDefinition} from './ontology';

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

    /**
     * Matches an event against existing objects.
     * @param {object} event - The event to match.
     */
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

    async findMatches(object) {
        const matches = [];
        const objects = await this.app.db.getAll();

        if (!object) {
            console.log('No object to match.');
            return matches;
        }

        const text = (object.content || '').toLowerCase();

        for (const obj of objects) {
            if (obj.tags?.some(tagData => this.matchTagData(tagData, text, object)))
                matches.push(obj);
        }

        if (!matches.length) {
            this.fuse.setCollection(objects);
            matches.push(...this.fuse.search(text).filter(r => r.score <= this.fuse.options.threshold).map(r => r.item));
        }

        //dedupe matches
        const uniqueMatches = [...new Set(matches.map(m => m.id))].map(id => matches.find(m => m.id === id));

        return uniqueMatches;
    }

    /**
     * Matches an event against a tag's data.
     * @param {object} tagData - The tag data to match against.
     * @param {string} text - The text to match.
     * @param {object} event - The event to match.
     */
    matchTagData(tagData, text, event) {
        console.log('matchTagData called with:', {tagData, text, event});
        const {name, condition, value} = tagData;
        console.log('tagData values:', {name, condition, value});
        // TODO: Implement more sophisticated tag matching techniques
        const tagDef = getTagDefinition(name);

        if (!tagDef.validate(value, condition)) return false;

        const checkTime = (val) => {
            //Corrected recursive call
            //return checkTime(val, event, tagDef, condition);
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
        }

        const conditionHandlers = {
            "matches regex": () => {
                try {
                    return new RegExp(value, "i").test(text);
                } catch (e) {
                    this.app.errorHandler.handleError(e, "Error creating regex");
                    return false;
                }
            },
            "is": () => {
                console.log('text', text, 'value', value);
                return text?.toLowerCase().includes(value?.toLowerCase());
            },
            "contains": () => {
                console.log('text', text, 'value', value);
                return text?.toLowerCase().includes(value?.toLowerCase());
            },
            "before": () => checkTime(value),
            "after": () => checkTime(value),
        };

        const handler = conditionHandlers[condition];
        if (handler) {
            return handler();
        }

        return false;
    }

    /**
     * Enhances semantic matching using advanced techniques.
     * @param {string} text - The text to match against.
     * @param {object[]} objects - The objects to search.
     * @returns {object[]} - The matching objects.
     */
    /**
     * Enhances semantic matching using advanced techniques (not implemented).
     * @param {string} text - The text to match against.
     * @param {object[]} objects - The objects to search.
     * @returns {object[]} - The matching objects.
     */
    async enhanceSemanticMatching(text, objects) {
        // TODO: Implement enhanced semantic matching logic here
        // TODO: Explore word embeddings or knowledge graphs for semantic matching
        // TODO: Consider updating core/ontology.js to support semantic information
        console.log(`Performing enhanced semantic matching for text: ${text} (not implemented)`);
        return objects.filter(obj => obj.content.includes(text)); // Placeholder
    }
}
