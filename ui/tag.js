ui/tag.js
import { createElement } from '../utils.js';

export class Tag extends HTMLElement {
    constructor() {
        super();
        this.shadow = this.attachShadow({mode: 'open'});
    }

    static get observedAttributes() {
        return ['tag-name'];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (name === 'tag-name') {
            this.tagName = newValue;
            this.render();
        }
    }


    connectedCallback() {
        if (!this.tagName) {
            this.tagName = this.getAttribute('tag-name') || 'default-tag';
        }
        this.render();
    }


    render() {
        this.shadow.innerHTML = `
        <style>
            .tag {
                display: inline-flex;
                align-items: center;
                background-color: #f0f0f0;
                border: 1px solid #ccc;
                border-radius: 4px;
                padding: 2px 4px;
                margin: 2px 2px;
                cursor: pointer;
            }

            .tag-name {
                margin-right: 4px;
            }

            .remove-icon {
                opacity: 0.6;
                font-size: 0.8em;
            }
        </style>
        <div class="tag">
            <span class="tag-name">${this.tagName}</span>
            <span class="remove-icon"></span>
        </div>
        `;
    }
}

customElements.define('nt-tag', Tag);
