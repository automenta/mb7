import { parseISO, formatISO } from 'date-fns';

export const Ontology = {
    "location": {
        conditions: ["is", "contains", "near"],
        validate: (value, condition) => typeof value === "string" && value.length > 0,
        serialize: (value) => value,
        deserialize: (value) => value,
        ui: {
            type: "text", // or "map", "location-picker", etc.
            placeholder: "Enter a location",
            icon: "📍"
        }
    },
    "time": {
        conditions: ["is", "before", "after", "between"],
        validate: (value, condition) => {
            if (condition === "between") {
                return isValidDate(value.start) && isValidDate(value.end);
            }
            return isValidDate(value);
        },
        serialize: (value) => {
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify({start: formatISO(parseISO(value.start)), end: formatISO(parseISO(value.end))});
            }
            return formatISO(parseISO(value));
        },
        deserialize: (value) => {
            try {
                const parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object' && parsed.start && parsed.end) {
                    return { start: parsed.start, end: parsed.end };
                }
            } catch (e) {
                // Ignore JSON parsing errors, assume it's a single date
            }
            return value;
        }
    },
    "string": {
        conditions: ["is", "contains", "matches regex"],
        validate: (value, condition) => typeof value === "string",
        serialize: (value) => value,
        deserialize: (value) => value
    },
    "number": {
        conditions: ["is", "greater than", "less than", "between"],
        validate: (value, condition) => {
            if (condition === "between") {
                return !isNaN(parseFloat(value.lower)) && isFinite(value.lower) &&
                    !isNaN(parseFloat(value.upper)) && isFinite(value.upper);
            }
            return !isNaN(parseFloat(value)) && isFinite(value);
        },
        serialize: (value) => {
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify({lower: String(value.lower), upper: String(value.upper)});
            }
            return String(value)
        },
        deserialize: (value) => {
            try {
                const parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object' && parsed.lower && parsed.upper) {
                    return { lower: parsed.lower, upper: parsed.upper };
                }
            } catch (e) {
                // Ignore JSON parsing errors, assume it's a single number
            }
            return value;
        },
        ui: {
            type: "number",
            unit: "meters",
            min: 0,
            max: 100
        }
    },
    "People": {
        conditions: ["is"],
        type: "object",
        validate: (value, condition) => {
            return typeof value === 'object';
        },
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => JSON.parse(value)
    },
    "Emotion": {
        conditions: ["is", "is between", "is below", "is above"],
        validate: (value, condition) => {
            if (condition === "is between") {
                return !isNaN(parseFloat(value.lower)) && isFinite(value.lower) &&
                    !isNaN(parseFloat(value.upper)) && isFinite(value.upper);
            }
            return !isNaN(parseFloat(value)) && isFinite(value);
        },
        serialize: (value) => {
            if (typeof value === 'object' && value !== null) {
                return JSON.stringify({lower: String(value.lower), upper: String(value.upper)});
            }
            return String(value)
        },
        deserialize: (value) => {
            try {
                const parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object' && parsed.lower && parsed.upper) {
                    return { lower: parsed.lower, upper: parsed.upper };
                }
            } catch (e) {
                // Ignore JSON parsing errors, assume it's a single number
            }
            return value;
        }
    },
    "Business": {
        conditions: ["is one of"],
        validate: (value, condition) => typeof value === "string",
        serialize: (value) => value,
        deserialize: (value) => value
    },
    "Data": {
        conditions: ["is one of"],
        validate: (value, condition) => Array.isArray(value),
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => JSON.parse(value)
    },
    "DueDate": {
        conditions: ["is", "before", "after", "between"],
        validate: (value, condition) => condition === "between" ? isValidDate(value.start) && isValidDate(value.end) : isValidDate(value),
        serialize: (value) => typeof value === 'object' && value !== null ? JSON.stringify({start: value.start, end: value.end}) : value,
        deserialize: (value) => {
            try {
                const parsed = JSON.parse(value);
                if (parsed && typeof parsed === 'object' && parsed.start && parsed.end) {
                    return { start: parsed.start, end: parsed.end };
                }
            } catch (e) {
                // Ignore JSON parsing errors, assume it's a single date
            }
            return value;
        }
    },
    "List": {
        conditions: ["is"],
        type: "list",
        validate: (value, condition) => Array.isArray(value),
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => JSON.parse(value)
    },
    "Settings": {
        conditions: ["is"],
        type: "object",
        tags: {
            "relays": {
                type: "string",
                required: false,
                label: "Nostr Relays",
                description: "Comma-separated list of Nostr relay URLs.",
                validate: (value, condition) => typeof value === "string",
                serialize: (value) => value,
                deserialize: (value) => value,
                default: ""
            },
            "webrtcNostrRelays": {
                type: "string",
                required: false,
                label: "WebRTC Nostr Relays",
                description: "Comma-separated list of WebRTC Nostr relay URLs.",
                validate: (value, condition) => typeof value === "string",
                serialize: (value) => value,
                deserialize: (value) => value,
                default: ""
            },
            "privateKey": {
                type: "string",
                required: false,
                label: "Nostr Private Key",
                description: "Your Nostr private key (hex or npriv).",
                validate: (value, condition) => typeof value === "string",
                serialize: (value) => value,
                deserialize: (value) => value,
                default: ""
            },
            "dateFormat": {
                type: "string",
                required: false,
                label: "Date Format",
                description: "The format for displaying dates.",
                validate: (value, condition) => typeof value === "string",
                serialize: (value) => value,
                deserialize: (value) => value,
                default: "yyyy-MM-dd"
            },
            "profileName": {
                type: "string",
                required: false,
                label: "Profile Name",
                description: "Your profile name.",
                validate: (value, condition) => typeof value === "string",
                serialize: (value) => value,
                deserialize: (value) => value,
                default: ""
            },
            "profilePicture": {
                type: "string",
                required: false,
                label: "Profile Picture URL",
                description: "URL for your profile picture.",
                validate: (value, condition) => typeof value === "string",
                serialize: (value) => value,
                deserialize: (value) => value,
                default: ""
            },
            "signalingStrategy": {
                type: "select",
                default: "nostr",
                label: "Signaling Strategy",
                description: "The signaling strategy to use for WebRTC.",
                options: ["nostr", "webrtc"],
                validate: (value, condition) => ["nostr", "webrtc"].includes(value),
                serialize: (value) => value,
                deserialize: (value) => value
            },
            "word2vecModelPath": {
                type: "string",
                required: false,
                label: "Word2Vec Model Path",
                description: "Path to the Word2Vec model file.",
                validate: (value, condition) => typeof value === "string",
                serialize: (value) => value,
                deserialize: (value) => value,
                default: ""
            }
        },
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => JSON.parse(value)
    },
    "Public": {
        conditions: ["is"],
        validate: (value, condition) => typeof value === "boolean",
        serialize: (value) => value.toString(),
        deserialize: (value) => value === "true"
    }
};

Ontology.Note = {
    conditions: ["is"],
    type: "object",
    validate: (value, condition) => {
        return typeof value === 'object';
    },
    serialize: (value) => JSON.stringify(value),
    deserialize: (value) => JSON.parse(value)
};

Ontology.Event = {
    conditions: ["is"],
    type: "object",
    validate: (value, condition) => {
        return typeof value === 'object';
    },
    serialize: (value) => JSON.stringify(value),
    deserialize: (value) => JSON.parse(value)
};

Ontology.Relay = {
    conditions: ["is"],
    type: "object",
    validate: (value, condition) => {
        return typeof value === 'object';
    },
    serialize: (value) => JSON.stringify(value),
    deserialize: (value) => JSON.parse(value)
};

const isValidDate = (dateString) => {
    try {
        return !isNaN(new Date(dateString).getTime());
    } catch (error) {
        return false;
    }
};

export const getTagDefinition = (name) => {
    // TODO: Add support for semantic information, such as synonyms, related concepts, and hierarchical relationships
    return Ontology[name] || Ontology.string;
};

export { isValidDate };
