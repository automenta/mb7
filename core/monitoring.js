// core/monitoring.js

import {sha256} from 'js-sha256';

class Monitoring {
    constructor(app) {
        this.app = app;
        this.metrics = {};
        this.errorCount = 0;
        this.syncLatencies = [];
        this.maxSyncLatenciesLength = 100;
        this.previousDataHash = null;
    }

    async start() {
        // Initialize monitoring system
        this.initializeMetrics();
        this.startCollectingMetrics();
    }

    async stop() {
        // Stop monitoring system
        clearInterval(this.metricsInterval);
    }

    initializeMetrics() {
        // Define the metrics to be collected
        this.metrics = {
            synchronizationLatency: 0,
            errorRate: 0,
            cpuUsage: 0,
            memoryUsage: 0,
            networkIO: 0,
            dataConsistency: 0,
        };
    }

    startCollectingMetrics() {
        // Collect metrics at regular intervals
        this.metricsInterval = setInterval(() => {
            this.collectMetrics();
            this.storeMetrics();
        }, 5000);
    }

    async collectMetrics() {
        // Collect the metrics
        this.metrics.synchronizationLatency = this.getSynchronizationLatency();
        this.metrics.errorRate = this.getErrorRate();
        this.metrics.cpuUsage = this.getCpuUsage();
        this.metrics.memoryUsage = this.getMemoryUsage();
        this.metrics.networkIO = this.getNetworkIO();
        // Pass the Yjs document to getDataConsistency()
        this.metrics.dataConsistency = this.getDataConsistency(() => this.app.yDoc.getText('content').toString());
    }

    async storeMetrics() {
        // Store the metrics as NObjects
        const timestamp = Date.now();
        const monitoringData = {
            kind: 'monitoring',
            name: 'Monitoring Data',
            content: JSON.stringify(this.metrics),
            timestamp,
            private: true,
            tags: [],
            priority: 'Medium',
        };
        try {
            const newObject = await this.app.db.saveObject(monitoringData);
            if (newObject) {
                //console.log('Monitoring data stored as NObject:', newObject.id);
            } else {
                console.error('Error storing monitoring  newObject is null');
            }
        } catch (error) {
            console.error('Error storing monitoring ', error);
        }
    }

    /**
     * Measures the time it takes for data to synchronize between peers (via Yjs).
     * This requires instrumenting the Yjs document to record timestamps of changes
     * and comparing them on different clients.
     * @returns {number} The synchronization latency in milliseconds.
     */
    async getSynchronizationLatency() {
        if (this.syncLatencies.length === 0) return 0;
        const sum = this.syncLatencies.reduce((a, b) => a + b, 0);
        return (sum / this.syncLatencies.length) || 0;
    }

    addSyncLatency(latency) {
        this.syncLatencies.push(latency);
        if (this.syncLatencies.length > this.maxSyncLatenciesLength) {
            this.syncLatencies.shift();
        }
    }

    /**
     * Calculates the error rate of the application.
     * This requires tracking the number of errors that occur over a given
     * time interval.  The error count is incremented in the `ErrorHandler.handleError()`
     * method.
     * @returns {number} The error rate as a percentage.
     */
    getErrorRate() {
        // Calculate the error rate as a percentage
        const errorRate = (this.errorCount / 5000) * 100; // errors per 5 seconds
        this.errorCount = 0; // Reset the error count
        return errorRate;
    }

    /**
     * Gets the CPU usage of the application.
     * This uses the `performance` API in the browser to access CPU usage data.
     * @returns {number} The CPU usage as a percentage.
     */
    async getCpuUsage() {
        if (!window.performance || !window.performance.now) {
            console.warn('Performance API not supported.');
            return 0;
        }

        // This is a placeholder.  The actual implementation will depend on the
        // browser and the available APIs.  It may not be possible to get
        // accurate CPU usage data in all browsers.
        return window.performance.now();
    }

    /**
     * Gets the memory usage of the application.
     * This uses the `performance` API in the browser to access memory usage data.
     * @returns {number} The memory usage in megabytes.
     */
    async getMemoryUsage() {
        if (!window.performance || !window.performance.memory) {
            console.warn('Memory API not supported.');
            return 0;
        }

        // This is a placeholder.  The actual implementation will depend on the
        // browser and the available APIs.  It may not be possible to get
        // accurate memory usage data in all browsers.
        return window.performance.memory.usedJSHeapSize / 1048576;
    }

    /**
     * Gets the network I/O of the application.
     * This uses the `performance` API and `PerformanceObserver` to monitor network requests.
     * @returns {number} The network I/O in bytes.
     */
    async getNetworkIO() {
        if (!window.performance || !window.performance.getEntriesByType) {
            console.warn('Performance API not supported.');
            return 0;
        }

        // This is a placeholder.  The actual implementation will depend on the
        // browser and the available APIs.  It may not be possible to get
        // accurate network I/O data in all browsers.
        let network = window.performance.getEntriesByType("resource");
        return network.length;
    }

    /**
     * Verifies the integrity of the data across different clients.
     * This is the most complex metric to implement.  One approach is to
     * periodically compare the state of the Yjs document on different clients.
     * You could calculate a hash of the document content and compare the hashes.
     * If the hashes don't match, it indicates a data consistency issue.
     * @param {function} getContent - A function that returns the Yjs document content.
     * @returns {number} A value indicating the data consistency (e.g., 0 for inconsistent, 1 for consistent).
     */
    async getDataConsistency(getContent) {
        try {
            // Get the content of the Yjs document
            const yDocContent = getContent();

            // Calculate the hash of the content
            const currentDataHash = sha256(yDocContent);

            // Compare the current hash with the previous hash
            if (this.previousDataHash && this.previousDataHash !== currentDataHash) {
                console.warn('Data consistency issue detected!');
                return 0; // Inconsistent
            }

            // Store the current hash for the next comparison
            this.previousDataHash = currentDataHash;
            return 1; // Consistent
        } catch (error) {
            console.error('Error getting data consistency:', error);
            return 0; // Inconsistent
        }
    }
}

export {Monitoring};
