export class NoteDetails extends HTMLElement {
    /**
     * Constructor for the NoteDetails class.
     * @param {object} noteView - The note view object.
     */
    constructor(noteView) {
        super();
        this.noteView = noteView;
        this.shadow = this.attachShadow({mode: 'open'});
        this.selectedNoteId = null; // Track selected note ID
    }

    /**
     * Called when the element is connected to the DOM.
     */
    connectedCallback() {
        this.shadow.addEventListener('tag-removed', this.handleTagRemoved.bind(this));
        this.noteView.store.subscribe(() => {
            this.updateNoteDetails(); // Update on store changes
        });
        this.updateNoteDetails(); // Initial render
    }

    /**
     * Handles the tag-removed event.
     * @param {Event} event - The tag-removed event.
     */
    handleTagRemoved(event) {
        const tag = event.detail.tag;
        this.removeTag(tag);
    }

    /**
     * Removes a tag from the note.
     * @param {object} tag - The tag to remove.
     */
    async removeTag(tag) {
        try {
            const tagName = tag.getTagDefinition().name;
            if (this.noteView.selectedNote) {
                const note = this.noteView.selectedNote;
                const tagIndex = note.tags.findIndex(tag => tag.name === tagName);
                if (tagIndex !== -1) {
                    note.tags.splice(tagIndex, 1);
                    await this.noteView.app.db.saveObject(note, false);
                    this.renderTags();
                    this.noteView.displayTags(note.id);
                } else {
                    console.error('Tag not found');
                }
            } else {
                console.error('Note not found');
            }
        } catch (error) {
            console.error('Error removing tag:', error);
        }
    }

    /**
     * Updates the note details based on the selected note in the store.
     */
    async updateNoteDetails() {
        const selectedNoteId = this.noteView.store.getState().selectedNoteId;
        if (selectedNoteId && selectedNoteId !== this.selectedNoteId) {
            this.selectedNoteId = selectedNoteId;
            try {
                this.selectedNote = await this.noteView.db.get(selectedNoteId);
                this.render();
            } catch (error) {
                console.error('Error fetching note details:', error);
            }
        }
    }

    /**
     * Renders the note details.
     */
    render() {
        if (!this.selectedNote) {
            this.shadow.innerHTML = `<p>No note selected.</p>`;
            return;
        }

        this.shadow.innerHTML = `
            <style>
                .note-details-container {
                    padding: 10px;
                }
                .privacy-container {
                    display: flex;
                    align-items: center;
                    margin-bottom: 5px;
                }
                .note-tags-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                }
                .note-title {
                    font-size: 1.5em;
                    margin-bottom: 10px;
                }
                .note-content {
                    white-space: pre-wrap; /* Preserve line breaks */
                }
            </style>
            <div class="note-details-container">
                <h2 class="note-title">${this.selectedNote.name}</h2>
                <div class="note-content">${this.selectedNote.content}</div>
                <div class="privacy-container">
                </div>
                <div class="note-tags-container">
                </div>
                <button id="share-button">Share</button>
            </div>
        `;

        this.renderTags();

        const shareButton = this.shadow.querySelector('#share-button');
        shareButton.addEventListener('click', () => this.shareNote());
    }

    /**
     * Renders the tags.
     */
    async renderTags() {
        const tagsContainer = this.shadow.querySelector('.note-tags-container');
        tagsContainer.innerHTML = ''; // Clear existing tags

        if (this.selectedNote && this.selectedNote.tags) {
            this.selectedNote.tags.forEach(tag => {
                const tagElement = document.createElement('data-tag');
                tagElement.setAttribute('tag-definition', JSON.stringify(tag));
                tagElement.setAttribute('value', tag.value || '');
                tagElement.setAttribute('condition', tag.condition || 'is');
                +tagElement.app = this.noteView.app; // Pass the app instance
                tagsContainer.appendChild(tagElement);
            });
        }
    }

    /**
     * Shares the note.
     */
    async shareNote() {
        if (this.noteView.selectedNote) {
            try {
                await this.noteView.app.noteManager.publishObject(this.noteView.selectedNote);
            } catch (error) {
                console.error('Error sharing note:', error);
                this.noteView.app.errorHandler.handleError(error, 'Error sharing note');
            }
        } else {
            console.warn('No note selected to share.');
            this.noteView.app.notificationManager.showNotification('No note selected to share.', 'warning');
        }
    }
}

if (!customElements.get('note-details')) {
    customElements.define('note-details', NoteDetails);
}
