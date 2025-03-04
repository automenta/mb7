core/error.js
export class ErrorHandler {
    constructor(app) {
        this.app = app;
    }

    handleError(error, message = "An unexpected error occurred.") {
        const timestamp = new Date().toISOString();
        console.error(`[${timestamp}] ${message}: ${error.name} - ${error.message}`, error);
        this.app.notificationManager.showNotification(`${message}: ${error.message}`, "error");
        this.app.monitoring.errorCount++;
    }
}
