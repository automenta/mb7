export class ListItemRenderer {
    constructor() {
        this.el = document.createElement('div');
        this.el.className = "object-item";
        this.headerEl = document.createElement('div');
        this.headerEl.className = "object-header";
        this.nameEl = document.createElement('strong');
        this.updatedEl = document.createElement('small');
        this.headerEl.append(this.nameEl, this.updatedEl);
        this.contentEl = document.createElement('div');
        this.contentEl.className = "object-content";
        this.tagsEl = document.createElement('div');
        this.tagsEl.className = "object-tags";
        this.el.append(this.headerEl, this.contentEl, this.tagsEl);
    }

    render(obj) {
        this.el.dataset.id = obj.id;
        this.el.tabIndex = 0;
        this.nameEl.textContent = obj.name;
        this.updatedEl.textContent = `Updated: ${formatDate(obj.updatedAt)}`;
        this.contentEl.textContent = obj.content ? `${obj.content.substring(0, 100)}...` : "";
        this.tagsEl.innerHTML = "";
        if (obj.tags) {
            obj.tags.forEach(tag => {
                const tagEl = document.createElement('span');
                tagEl.className = "tag";
                tagEl.textContent = tag.name;
                this.tagsEl.append(tagEl);
            });
        }
        return this.el;
    }
}