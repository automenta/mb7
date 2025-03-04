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
            this.render();
        }
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
                margin: 2px;
                font-size: 0.85em;
            }
            .tag-name {
                margin-left: 2px;
                margin-right: 2px;
            }
        </style>
        <div class="tag">
            <span class="tag-name">${this.getAttribute('tag-name')}</span>
        </div>
        `;
    }
}
