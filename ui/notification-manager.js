export class NotificationManager {
    constructor(app) {
        this.app = app;
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
        const notificationArea = document.getElementById('notification-area');
        notification.appendTo(notificationArea);

        await notification.animateIn();
        this.notificationTimeout = setTimeout(() => {
            this.animateAndRemoveNotification(notification);
        }, 3000); // Duration notification is visible
    }


    async animateAndRemoveNotification(notification) {
        try {
            await notification.animateOut();
            notification.remove();
        } catch (error) {
            console.error('Error animating and removing notification:', error);
        } finally {
            await this.showNextNotification();
        }
    }
}
