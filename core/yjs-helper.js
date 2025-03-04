import * as Y from 'yjs';

export class YjsHelper {
    /**
     * Creates a Yjs map if it doesn't exist.
     * @param {Y.Doc} yDoc - The Yjs document.
     * @param {string} mapName - The name of the map.
     * @returns {Y.Map} The Yjs map.
     */
    static createYMap(yDoc, mapName) {
        let yMap = yDoc.getMap(mapName);
        if (!yMap) {
            yMap = new Y.Map();
            yDoc.getMap().set(mapName, yMap);
        }
        return yMap;
    }

    /**
     * Observes changes to a Yjs map and calls a callback function.
     * @param {Y.Map} yMap - The Yjs map.
     * @param {function} callback - The callback function to call when the map changes.
     */
    static observeYMap(yMap, callback) {
        yMap.observe(callback);
    }

    /**
     * Updates a value in a Yjs map within a transaction.
     * @param {Y.Doc} yDoc - The Yjs document.
     * @param {Y.Map} yMap - The Yjs map.
     * @param {string} key - The key to update.
     * @param {any} value - The new value.
     */
    static updateYMapValue(yDoc, yMap, key, value) {
        yDoc.transact(() => {
            yMap.set(key, value);
        });
    }

    /**
     * Sets a before transaction hook to track sync latency.
     * @param {Y.Doc} yDoc - The Yjs document.
     * @param {function} addSyncLatency - The function to call with the sync latency.
     */
    static setSyncLatencyHook(yDoc, addSyncLatency) {
        yDoc.on('beforeTransaction', transaction => {
            transaction.origin = {timestamp: Date.now()};
        });

        yDoc.on('afterTransaction', transaction => {
            if (transaction.origin && transaction.origin.timestamp) {
                const latency = Date.now() - transaction.origin.timestamp;
                addSyncLatency(latency);
            }
        });
    }
}
