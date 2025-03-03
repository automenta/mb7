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

        addTagButton.addEventListener('click', async () => {
            const tagName = tagInput.value.trim();
            if (tagName) {
                await this.addTagToNote(tagName);
                tagInput.value = '';
            }
        });

        return tagsContainer;
    }

    clearTagInput() {
    }

    createTagArea() {
        return document.createElement('div');
    }

    renderTags(tagsContainer) {
        if (!this.noteView.selectedNote) {
            return;
        }
        const noteId = this.noteView.selectedNote.id;
        this.noteView.getNoteTags(noteId).then(tags => {
            tags.forEach(tagData => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag-item';
                const tagDefinition = this.noteView.app.getTagDefinition(tagData.name);
                const emoji = tagDefinition && tagDefinition.instances && tagDefinition.instances[0] ? tagDefinition.instances[0].emoji : '';
                tagElement.innerHTML = `<span>${emoji} ${tagData.name}</span><button class="remove-tag">x</button>`;
                tagsContainer.appendChild(tagElement);
            });
        });
    }

    async addTagToNote(tagName) {
        if (!tagName) {
            return;
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
            this.renderTags(this.el.querySelector('.note-tags-container'));
            this.noteView.showMessage('Tag added');
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
