export class TagDisplay {
    constructor(app) {
        this.app = app;
    }

    async displayTags(noteView, noteId) {
        const tagArea = noteView.mainArea.querySelector('.note-tag-area');
        tagArea.innerHTML = ''; // Clear existing tags

        try {
            const note = await this.app.db.get(noteId);
            if (note && note.tags) {
                note.tags.forEach(tag => {
                    const tagElement = document.createElement('span');
                    tagElement.textContent = `${tag.name}: ${tag.value} `;
                    tagArea.appendChild(tagElement);
                });
            } else {
                console.log('No tags found for this note.');
            }
        } catch (error) {
            console.error('Error getting note tags:', error);
        }
    }
}
