ui/note/note-details.js
import { formatDate } from '../content-view-renderer.js';

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
    }

    setSelectedNote(note) {
        this.selectedNote = note;
        this.render();
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
                    font-family: sans-serif;
                }
                .detail-row {
                    margin-bottom: 8px;
                }
                .detail-label {
                    font-weight: bold;
                    margin-right: 5px;
                }
            </style>
            <div class="note-details-container">
                <div class="detail-row">
                    <span class="detail-label">Name:</span><span>${this.selectedNote.name}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Created:</span><span>${formatDate(this.selectedNote.created)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Modified:</span><span>${formatDate(this.selectedNote.modified)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">ID:</span><span>${this.selectedNote.id}</span>
                </div>
            </div>
        `;
        return this;
    }
}

customElements.define('note-details', NoteDetails);
