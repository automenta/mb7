import * as Y from 'yjs';

export class YjsHelper {

    static createYMap(yDoc, mapName) {
        let yMap = yDoc.getMap(mapName);
        if (!yMap) {
            yMap = new Y.Map();
            yDoc.getMap().set(mapName, yMap);
        }
        return yMap;
    }

    static observeYMap(yMap, callback) {
        yMap.observe(callback);
    }

    static updateYMapValue(yDoc, yMap, key, value) {
        yDoc.transact(() => {
            yMap.set(key, value);
        });
    }

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
