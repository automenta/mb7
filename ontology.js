export const UnifiedOntology = {
    "location": {
        conditions: ["is", "contains", "near"],
        validate: (value, condition) => typeof value === "string" && value.length > 0,
        serialize: (value) => value,
        deserialize: (value) => value,
        instances: [
            {name: "Location", emoji: "📍", conditions: {"is at": "is at", "is within": "is within"}}
        ]
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
        deserialize: (value) => value,
        instances: [
            {
                name: "Time",
                emoji: "⏰",
                conditions: {
                    "is at": "is at",
                    "is between": "is between",
                    "is before": "is before",
                    "is after": "is after"
                }
            }
        ]
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
        deserialize: (value) => value, // Could also convert back to number if needed
        instances: [
            {
                name: "Mass",
                unit: "kg",
                emoji: "⚖️",
                conditions: {is: "is", "is between": "is between", "is below": "is below", "is above": "is above"}
            },
            {
                name: "Length",
                unit: "m",
                emoji: "📏",
                conditions: {is: "is", "is between": "is between", "is below": "is below", "is above": "is above"}
            },
            {
                name: "Temperature",
                unit: "°C",
                emoji: "🌡️",
                conditions: {is: "is", "is between": "is between", "is below": "is below", "is above": "is above"}
            },
            {
                name: "Revenue",
                unit: "USD",
                emoji: "💰",
                conditions: {is: "is", "is between": "is between", "is below": "is below", "is above": "is above"}
            }
        ]
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
    },
    "Emotion": {
        instances: [
            {
                name: "Happiness",
                type: "range",
                emoji: "😊",
                min: 0,
                max: 10,
                conditions: {is: "is", "is between": "is between", "is below": "is below", "is above": "is above"}
            },
            {
                name: "Sadness",
                type: "range",
                emoji: "😢",
                min: 0,
                max: 10,
                conditions: {is: "is", "is between": "is between", "is below": "is below", "is above": "is above"}
            },
            {
                name: "Anger",
                type: "range",
                emoji: "😡",
                min: 0,
                max: 10,
                conditions: {is: "is", "is between": "is between", "is below": "is below", "is above": "is above"}
            }
        ]
    },
    "Business": {
        instances: [
            {
                name: "Product",
                type: "list",
                emoji: "📦",
                options: ["Software", "Hardware", "Service"],
                conditions: {"is one of": "is one of"}
            },
            {
                name: "Customer",
                type: "list",
                emoji: "👥",
                options: ["B2B", "B2C", "Government"],
                conditions: {"is one of": "is one of"}
            }
        ]
    },
    "Data": {
        instances: [
            {name: "List", type: "list", emoji: "🔖", options: [], conditions: {"is one of": "is one of"}}
        ]
    }
};

export const getTagDefinition = (name) => UnifiedOntology[name] || UnifiedOntology.string;
