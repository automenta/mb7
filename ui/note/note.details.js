import {Ontology} from '../../core/ontology.js';

export class NoteDetails extends HTMLElement {
    constructor(noteView) {
        super();
        this.noteView = noteView;

        this.el = document.createElement('div');
        this.el.className = 'note-details-container';

        this.el.innerHTML = `
            ${this.createPriorityEdit().outerHTML}
            ${this.createPrivacyEdit().outerHTML}
            ${this.createShareEdit().outerHTML}
            ${this.createTagsSection().outerHTML}
        `;

        this.tagArea = this.createTagArea();
    }

    createDetailEdit(text, icon) {
        const label = document.createElement('span');
        label.textContent = `${icon} ${text}`;
        label.classList.add('margin-left');
        return label;
    }

    createShareEdit() {
        return this.createDetailEdit('No One', '👥');
    }

    createPrivacyEdit() {
        const container = document.createElement('div');
        container.className = 'privacy-container';

        const label = document.createElement('label');
        label.textContent = 'Private ';
        container.appendChild(label);

        const toggle = document.createElement('input');
        toggle.type = 'checkbox';
        toggle.checked = true; // Default to private
        label.appendChild(toggle);

        toggle.addEventListener('change', () => {
            const noteId = this.noteView.selectedNote.id;
            const isPrivate = toggle.checked;
            this.noteView.updateNotePrivacy(noteId, isPrivate);
        });

        container.appendChild(label);
        return container;
    }

    createPriorityEdit() {
        return this.noteView.newPriEdit();
    }

    createTagsSection() {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'note-tags-container';

        const tagInput = document.createElement('input');
        tagInput.setAttribute('list', 'tag-suggestions');
        tagInput.className = 'tag-select';
        tagInput.placeholder = 'Enter a tag';

        const datalist = document.createElement('datalist');
        datalist.id = 'tag-suggestions';

        // Get tag names from UnifiedOntology and sort them alphabetically
        const tagNames = Object.keys(Ontology).sort();

        // Add tag names as options
        tagNames.forEach(tag => {
            const option = document.createElement('option');
            option.value = tag;
            datalist.appendChild(option);
        });

        tagsContainer.appendChild(tagInput);
        tagsContainer.appendChild(datalist);

        const addTagButton = document.createElement('button');
        addTagButton.textContent = '[+ Tag]';
        addTagButton.classList.add('margin-left');
        tagsContainer.appendChild(addTagButton);

        this.renderTags(tagsContainer);
        addTagButton.addEventListener('click', () => {
            this.addTagToNote(tagInput.value, tagsContainer);
        });

        return tagsContainer;
    }

    clearTagInput() {
        const tagInput = this.tagArea.querySelector('.note-tag-input');
        tagInput.value = '';
    }

    createTagArea() {
        const tagArea = document.createElement('div');
        tagArea.className = 'note-tag-area';

        const tagInput = document.createElement('input');
        tagInput.type = 'text';
        tagInput.placeholder = 'Add a tag';
        tagInput.className = 'note-tag-input';

        const addTagButton = document.createElement('button');
        addTagButton.textContent = '[+ Tag]';
        addTagButton.classList.add('margin-left');

        tagArea.appendChild(tagInput);
        tagArea.appendChild(addTagButton);

        const clearTagButton = document.createElement('button');
        clearTagButton.textContent = '[x Clear]';
        clearTagButton.classList.add('margin-left');
        tagArea.appendChild(clearTagButton);

        addTagButton.addEventListener('click', async () => {
            const tagName = tagInput.value.trim();
            if (tagName) {
                await this.addTagToNote(tagName);
                this.clearTagInput(); // Clear the input after adding the tag
            }
        });

        clearTagButton.addEventListener('click', () => {
            this.clearTagInput();
        });

        return tagArea;
    }

    renderTags(tagsContainer) {
        if (!this.noteView.selectedNote) {
            return;
        }
        const noteId = this.noteView.selectedNote.id;
        this.noteView.getNoteTags(noteId).then(tags => {
            tags.forEach(tagData => {
                const tagElement = document.createElement('gra-tag');
                tagElement.data = tagData;
                tagsContainer.appendChild(tagElement);
            });
        });
    }

    async addTagToNote(tagName, tagsContainer) {
        if (!tagName) {
            return; // Don't add tag if no tag is selected
        }
        const noteId = this.noteView.selectedNote.id;
        const newTag = {
            name: tagName,
            type: 'text',
            value: ''
        };
        const note = await this.noteView.app.db.get(noteId);
        if (note) {
            note.tags.push(newTag);
            await this.noteView.app.db.saveObject(note, false);
            this.renderTags(tagsContainer);
        }
    }

     render() {
         this.el.innerHTML = `
            ${this.createPriorityEdit().outerHTML}
            ${this.createPrivacyEdit().outerHTML}
            ${this.createShareEdit().outerHTML}
            ${this.createTagsSection().outerHTML}
        `;
        return this.el;
    }
}

if (!customElements.get('note-details')) {
    customElements.define('note-details', NoteDetails);
}
