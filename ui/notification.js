const NOTIFICATION_DURATION = 4000;

class Notification {
    constructor(message, type = "info") {
        this.message = message;
        this.type = type;
        this.icon = this.getIcon();
        this.element = this.createElement();
    }

    getIcon() {
        switch (this.type) {
            case "success":
                return "✅";
            case "warning":
                return "⚠️";
            case "error":
                return "❌";
            default:
                return "ℹ️";
        }
    }

    createElement() {
        const notificationEl = document.createElement('div');
        notificationEl.className = `notification ${this.type}`;
        notificationEl.innerHTML = `${this.icon} ${this.message}`;
        notificationEl.style.right = '-300px';
        notificationEl.style.opacity = 0;
        return notificationEl;
    }

    appendTo(parent) {
        parent.append(this.element);
    }

    animateIn() {
        return this.animate({
            right: '10px',
            opacity: 1
        }, { duration: 300, fill: 'forwards' });
    }

    animateOut() {
        return this.animate({
            right: '-300px',
            opacity: 0
        }, { duration: 300, fill: 'forwards' });
    }

    animate(properties, options) {
        return this.element.animate(properties, options);
    }

    remove() {
        this.element.remove();
    }
}

export default Notification;