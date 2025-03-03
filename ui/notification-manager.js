import Notification from './notification.js';

const NOTIFICATION_DURATION = 4000;

export class NotificationManager {
    constructor() {
        this.notificationQueue = [];
        this.notificationTimeout = null;
    }

    showNotification(message, type = "info") {
        this.notificationQueue.push({message, type});
        if (!this.notificationTimeout) {
            this.showNextNotification();
        }
    }

    async showNextNotification() {
        if (!this.notificationQueue.length) {
            this.notificationTimeout = null;
            return;
        }
        const {message, type} = this.notificationQueue.shift();
        const notification = new Notification(message, type);
        const notificationArea = this.app.elements.notificationArea;
        notification.appendTo(notificationArea);

        await notification.animateIn();

        this.notificationTimeout = setTimeout(() => {
            this.animateAndRemoveNotification(notification);
        }, NOTIFICATION_DURATION);
    }

    async animateAndRemoveNotification(notification) {
        await notification.animateOut();
        await notification.remove();
        await this.showNextNotification();
    }
}