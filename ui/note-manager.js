export class NoteManager {
    constructor(app, db, errorHandler, matcher, nostr, notificationManager) {
        this.app = app;
        this.db = db;
        this.errorHandler = errorHandler;
        this.matcher = matcher;
        this.nostr = nostr;
        this.notificationManager = notificationManager;
    }

    sanitizeContent(content) {
        if (typeof content !== 'string') return content;
        return content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }
}
