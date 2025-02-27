export const TagOntology = {
    "location": {
        conditions: ["is", "contains", "near"],
        validate: (value, condition) => typeof value === "string" && value.length > 0,
        serialize: (value) => value,
        deserialize: (value) => value
    },
    "time": {
        conditions: ["is", "before", "after", "between"],
        validate: (value, condition) => {
            if (condition === "between") {
                return isValidDate(parseISO(value.start)) && isValidDate(parseISO(value.end));
            }
            return isValidDate(parseISO(value));
        },
        serialize: (value) => typeof value === 'object' && value !== null ?
            {start: formatISO(parseISO(value.start)), end: formatISO(parseISO(value.end))} : formatISO(parseISO(value)),
        deserialize: (value) => value
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
                return {lower: String(value.lower), upper: String(value.upper)};
            }
            return String(value)
        },
        deserialize: (value) => value // Could also convert back to number if needed
    },
    "People": {
        conditions: ["is"],
        type: "object",
        properties: {
            pubkey: {type: "string", required: true},
            name: {type: "string"},
            picture: {type: "string"}
        },
        validate: (value, condition) => {
            return typeof value === 'object' &&
                typeof value.pubkey === 'string' && value.pubkey.length === 64;
        },
        serialize: (value) => value,
        deserialize: (value) => value
    },
    "Settings": {
        conditions: ["is"],
        type: "object",
        properties: {
            relays: {type: "string", required: false},
            dateFormat: {type: "string", required: false},
            profileName: {type: "string", required: false},
            profilePicture: {type: "string", required: false}
        },
        validate: (value, condition) => {
            return typeof value === 'object';
        },
        serialize: (value) => value,
        deserialize: (value) => value
    }
};

export const getTagDefinition = (name) => TagOntology[name] || TagOntology.string;
