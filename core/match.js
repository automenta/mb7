import Fuse from 'fuse.js';
import {formatDate} from '../ui/content-view-renderer.js';
import {nip19} from 'nostr-tools';
import {getTagDefinition, Ontology} from './ontology';
import natural from 'natural';
import {format, formatISO, isValid as isValidDate, parseISO} from "date-fns";

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
    async matchTagData(tagData, text, event) {
        console.log('matchTagData called with:', {tagData, text, event});
        const {name, condition, value} = tagData;
        console.log('tagData values:', {name, condition, value});
        // Implement more sophisticated tag matching techniques
        // TODO: Explore using stemming or lemmatization to normalize words
        // TODO: Consider using a thesaurus to expand the search terms
        const tagDef = getTagDefinition(name);

        if (!tagDef.validate(value, condition)) return false;

        const checkTime = (val) => {
            return false;
        };

        const stemmer = natural.PorterStemmer;
        const tokenizer = new natural.WordTokenizer();
        const Analyzer = natural.SentimentAnalyzer;
        const analyzer = new Analyzer("English", stemmer, "afinn");

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
                const stemmedText = stemmer.stem(text).toLowerCase();
                const stemmedValue = stemmer.stem(value).toLowerCase();
                return stemmedText.includes(stemmedValue);
            },
            "contains": () => {
                const stemmedText = stemmer.stem(text).toLowerCase();
                const stemmedValue = stemmer.stem(value).toLowerCase();
                return stemmedText.includes(stemmedValue);
            },
            "before": () => {
                try {
                    const eventDate = new Date(event.created_at * 1000);
                    const tagDate = parseISO(value);
                    return isValidDate(tagDate) && eventDate < tagDate;
                } catch (e) {
                    console.error("Error parsing date:", e);
                    return false;
                }
            },
            "after": () => {
                try {
                    const eventDate = new Date(event.created_at * 1000);
                    const tagDate = parseISO(value);
                    return isValidDate(tagDate) && eventDate > tagDate;
                } catch (e) {
                    console.error("Error parsing date:", e);
                    return false;
                }
            },
        };

        const handler = conditionHandlers[condition];
        if (handler) {
            return handler();
        }

        // Enhance semantic matching
        const stemmedText = stemmer.stem(text);
        const tokenizedText = tokenizer.tokenize(stemmedText);
        const sentimentScore = analyzer.getSentiment(tokenizedText);

        console.log(`Sentiment score for text "${text}": ${sentimentScore}`);

        return false;
    }

    /**
     * Enhances semantic matching using advanced techniques.
     * @param {string} text - The text to match against.
     * @param {object[]} objects - The objects to search.
     * @returns {object[]} - The matching objects.
     */
    async enhanceSemanticMatching(text, objects) {
        // Load pre-trained word embeddings (GloVe)
        const WordTokenizer = natural.WordTokenizer;
        const wordTokenizer = new WordTokenizer();

        const tokenizedText = wordTokenizer.tokenize(text);

        const Word2Vec = natural.Word2Vec;
        this.word2vec = this.word2vec || new Word2Vec();

        const modelPath = this.app.settings?.word2vecModelPath || './core/word2vec.model';
        const vectorSize = 100;
        const similarityThreshold = 0.7;

        if (!this.word2vecModelLoaded) {
            if (this.loadingWord2VecModel) return; // Prevent multiple loading attempts

            this.loadingWord2VecModel = true;
            this.word2vec.loadModel(modelPath, () => {
                console.log("Word2Vec model loaded");
                this.word2vecModelLoaded = true;
                this.loadingWord2VecModel = false;
            }, (error) => {
                this.app.errorHandler.handleError(error, "Error loading Word2Vec model");
                this.word2vecModelLoaded = false;
                this.loadingWord2VecModel = false;
            });
        }

        if (!this.word2vecModelLoaded) {
            console.warn("Word2Vec model not loaded, skipping semantic matching.");
            return [];
        }

        // Calculate the average word embedding for the text
        let textEmbedding = new Array(vectorSize).fill(0);
        let validWordCount = 0;
        for (const token of tokenizedText) {
            const vector = this.word2vec.getVector(token);
            if (vector) {
                validWordCount++;
                for (let i = 0; i < vectorSize; i++) {
                    textEmbedding[i] += vector[i];
                }
            }
        }

        if (validWordCount > 0) {
            for (let i = 0; i < vectorSize; i++) {
                textEmbedding[i] /= validWordCount;
            }
        }

        const matches = [];
        for (const obj of objects) {
            const tokenizedContent = wordTokenizer.tokenize(obj.content);
            let contentEmbedding = new Array(vectorSize).fill(0);
            let validContentWordCount = 0;

            for (const token of tokenizedContent) {
                const vector = this.word2vec.getVector(token);
                if (vector) {
                    validContentWordCount++;
                    for (let i = 0; i < vectorSize; i++) {
                        contentEmbedding[i] += vector[i];
                    }
                }
            }

            if (validContentWordCount > 0) {
                for (let i = 0; i < vectorSize; i++) {
                    contentEmbedding[i] /= validContentWordCount;
                }
            }

            const similarity = this.cosineSimilarity(textEmbedding, contentEmbedding);
            if (similarity > similarityThreshold) {
                matches.push({obj, similarity});
            }
        }

        // Sort matches by similarity
        matches.sort((a, b) => b.similarity - a.similarity);

        return matches.map(match => match.obj);
    }

    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magnitudeA += vecA[i] * vecA[i];
            magnitudeB += vecB[i] * vecB[i];
        }
        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);
        if (magnitudeA && magnitudeB) {
            return dotProduct / (magnitudeA * magnitudeB);
        } else {
            return 0;
        }
    }
}
