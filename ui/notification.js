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
        const e = document.createElement('div');
        e.className = `notification ${this.type}`;
        e.innerHTML = `<span class="notification-icon">${this.icon}</span>
                         <span class="notification-message">${this.message}</span>`;
        e.style.right = '-300px';
        e.style.opacity = 0;
        return e;
    }

    appendTo(parent) {
        parent.append(this.element);
    }

    animateIn() {
        return this.animate({
            right: '10px',
            opacity: 1
        }, {duration: 300, fill: 'forwards'});
    }

    animateOut() {
        return this.animate({
            right: '-300px',
            opacity: 0
        }, {duration: 300, fill: 'forwards'});
    }

    remove() {
        this.element.remove();
    }
}

export default Notification;