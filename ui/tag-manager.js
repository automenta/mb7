ui/tag-manager.js
import { createElement } from '../utils.js';
import { Tag } from './tag.js';
import Ontology from '../core/ontology.js';

export class TagManager {
    constructor(note, app, getTagDefinition) {
        this.note = note;
        this.app = app;
        this.getTagDefinition = getTagDefinition;
        this.shadow = this.attachShadow({mode: 'open'});
        this.tags = this.note.tags || [];
    }


    connectedCallback() {
        this.render();
    }


    addTag(tagName, tagDef) {
        if (!this.tags.includes(tagName)) {
            this.tags.push(tagName);
            this.note.tags = this.tags;
            this.app.noteManager.saveObject(this.note);
            this.render();
        }
    }

    removeTag(tagName) {
        this.tags = this.tags.filter(tag => tag !== tagName);
        this.note.tags = this.tags;
        this.app.noteManager.saveObject(this.note);
        this.render();
    }


    render() {
        this.shadow.innerHTML = `
        <style>
            .tag-manager {
                display: flex;
                flex-direction: column;
                gap: 5px;
            }

            .tag-list {
                display: flex;
                flex-wrap: wrap;
                gap: 5px;
            }
        </style>
        <div class="tag-manager">
            <h3>Tags</h3>
            <div class="tag-list" id="tag-list">
                ${this.tags.map(tagName => `<nt-tag tag-name="${tagName}"></nt-tag>`).join('')}
            </div>
        </div>
        `;
        this.attachTagEventListeners();
        return this.shadow.firstChild;
    }


    attachTagEventListeners() {
        this.tags.forEach(tagName => {
            const tagElement = this.shadow.querySelector(`nt-tag[tag-name="${tagName}"]`);
            if (tagElement) {
                tagElement.onclick = () => {
                    this.removeTag(tagName);
                };
            }
        });
    }
}

customElements.define('nt-tag-manager', TagManager);
