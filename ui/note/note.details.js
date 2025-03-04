import { createElement } from '../utils.js';

export class NoteDetails extends HTMLElement {
    constructor(app, noteView) {
        super();
        this.app = app;
        this.noteView = noteView;
        this.shadow = this.attachShadow({ mode: 'open' });
        this.selectedNote = null;
    }

    connectedCallback() {
        this.render();
        this.noteView.addEventListener('note-selected', (event) => {
            this.selectedNote = event.detail.note;
            this.render();
        });
    }

    render() {
        if (!this.selectedNote) {
            this.shadow.innerHTML = `<p>No note selected.</p>`;
            return this;
        }

        this.shadow.innerHTML = `
            <style>
                .note-details-container {
                    padding: 10px;
                }
                .detail-item {
                    margin-bottom: 8px;
                    font-size: 14px;
                }
                .detail-label {
                    font-weight: bold;
                    margin-right: 5px;
                }
            </style>
            <div class="note-details-container">
                <div class="detail-item"><span class="detail-label">ID:</span> ${this.selectedNote.id}</div>
                <div class="detail-item"><span class="detail-label">Created:</span> ${this.selectedNote.createdAt}</div>
                <div class="detail-item"><span class="detail-label">Updated:</span> ${this.selectedNote.updatedAt}</div>
                <div class="detail-item"><span class="detail-label">Kind:</span> ${this.selectedNote.kind}</div>
            </div>
        `;
        return this;
    }
}
