import {formatISO, parseISO} from 'date-fns';

const isValidDate = (dateString) => {
    try {
        return !isNaN(new Date(dateString).getTime());
    } catch (error) {
        return false;
    }
};

const serializeDate = (value) => {
    try {
        if (typeof value === 'object' && value !== null && value.start && value.end) {
            return JSON.stringify({start: formatISO(parseISO(value.start)), end: formatISO(parseISO(value.end))});
        }
        return formatISO(parseISO(value));
    } catch (error) {
        console.error("Error serializing date:", error);
        return null;
    }
};

const deserializeDate = (value) => {
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && parsed.start && parsed.end) {
            return {start: parsed.start, end: parsed.end};
        }
    } catch (e) {
        // Ignore JSON parsing errors, assume it's a single date
    }
    return value;
};

const serializeNumber = (value) => {
    try {
        if (typeof value === 'object' && value !== null && value.lower && value.upper) {
            return JSON.stringify({lower: String(value.lower), upper: String(value.upper)});
        }
        return String(value);
    } catch (error) {
        console.error("Error serializing number:", error);
        return null;
    }
};

const deserializeNumber = (value) => {
    try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object' && parsed.lower && parsed.upper) {
            return {lower: parsed.lower, upper: parsed.upper};
        }
    } catch (e) {
        // Ignore JSON parsing errors, assume it's a single number
    }
    return value;
};

export const Ontology = {
    "location": {
        conditions: ["is", "contains", "near"],
        validate: (value, condition) => typeof value === "string" && value.length > 0,
        serialize: (value) => value,
        deserialize: (value) => value,
        ui: { type: "text", placeholder: "Enter a location", icon: "📍" }
    },
    "time": {
        conditions: ["is", "before", "after", "between"],
        validate: (value, condition) => condition === "between" ? isValidDate(value.start) && isValidDate(value.end) : isValidDate(value),
        serialize: serializeDate,
        deserialize: deserializeDate
    },
    "string": {
        conditions: ["is", "contains", "matches regex"],
        validate: (value, condition) => typeof value === "string",
        serialize: (value) => value,
        deserialize: (value) => value,
    },
    "number": {
        conditions: ["is", "greater than", "less than", "between"],
        validate: (value, condition) => condition === "between" ? !isNaN(parseFloat(value.lower)) && isFinite(value.lower) && !isNaN(parseFloat(value.upper)) && isFinite(value.upper) : !isNaN(parseFloat(value)) && isFinite(value),
        serialize: serializeNumber,
        deserialize: deserializeNumber,
        ui: {type: "number", unit: "meters", min: 0, max: 100}
    },
    "People": {
        conditions: ["is"],
        type: "object",
        validate: (value, condition) => typeof value === 'object',
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => {
            try {
                return JSON.parse(value);
            } catch (error) {
                console.error("Error deserializing People:", error);
                return {};
            }
        }
    },
    "Emotion": {
        conditions: ["is", "is between", "is below", "is above"],
        validate: (value, condition) => condition === "is between" ? !isNaN(parseFloat(value.lower)) && isFinite(value.lower) && !isNaN(parseFloat(value.upper)) && isFinite(value.upper) : !isNaN(parseFloat(value)) && isFinite(value),
        serialize: serializeNumber,
        deserialize: deserializeNumber
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
        deserialize: (value) => {
            try {
                return JSON.parse(value);
            } catch (error) {
                console.error("Error deserializing Data:", error);
                return [];
            }
        }
    },
    "DueDate": {
        conditions: ["is", "before", "after", "between"],
        validate: (value, condition) => condition === "between" ? isValidDate(value.start) && isValidDate(value.end) : isValidDate(value),
        serialize: serializeDate,
        deserialize: deserializeDate
    },
    "List": {
        conditions: ["is"],
        type: "list",
        validate: (value, condition) => Array.isArray(value),
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => {
            try {
                return JSON.parse(value);
            } catch (error) {
                console.error("Error deserializing List:", error);
                return [];
            }
        }
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
        deserialize: (value) => {
            try {
                return JSON.parse(value);
            } catch (error) {
                console.error("Error deserializing Settings:", error);
                return {};
            }
        }
    },
    "Public": {
        conditions: ["is"],
        validate: (value, condition) => typeof value === "boolean",
        serialize: (value) => value.toString(), // Serialize boolean to string
        deserialize: (value) => value === "true",
        ui: { type: "boolean" }
    },
    "textarea": {
        conditions: ["is", "contains"],
        validate: (value, condition) => typeof value === "string",
        serialize: (value) => value,
        deserialize: (value) => value,
        ui: {type: "textarea", placeholder: "Enter text"}
    },
    "date": {
        conditions: ["is", "before", "after", "between"],
        validate: (value, condition) => condition === "between" ? isValidDate(value.start) && isValidDate(value.end) : isValidDate(value),
        serialize: serializeDate,
        deserialize: deserializeDate,
        ui: { type: "date" }
    },
    "boolean": { // Added boolean tag definition
        conditions: ["is"],
        validate: (value, condition) => typeof value === "boolean",
        serialize: (value) => value.toString(), // Serialize boolean to string
        deserialize: (value) => value === "true",
        ui: { type: "boolean" } // Define UI type for boolean tags
    }
};

["Note", "Event", "Relay"].forEach(type => {
    Ontology[type] = {
        conditions: ["is"],
        type: "object",
        validate: (value, condition) => typeof value === 'object',
        serialize: (value) => JSON.stringify(value),
        deserialize: (value) => {
            try {
                return JSON.parse(value);
            } catch (error) {
                console.error(`Error deserializing ${type}:`, error);
                return {};
            }
        }
    };
});

export const getTagDefinition = (name) => Ontology[name] || Ontology.string;
export {isValidDate};
