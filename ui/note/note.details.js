export class NoteDetails extends HTMLElement {
    constructor() {
        super();

        this.el = document.createElement('div');
        this.el.className = 'note-details-container';

        this.el.innerHTML = `
            ${this.createPriorityEdit().outerHTML}
            ${this.createPrivacyEdit().outerHTML}
            ${this.createShareEdit().outerHTML}
            ${this.createTagsSection().outerHTML}
        `;
    }

    createShareEdit() {
        const sharingLabel = document.createElement('span');
        sharingLabel.textContent = '👥 No One';
        sharingLabel.classList.add('margin-left');
        return sharingLabel;
    }

    createPrivacyEdit() {
        const privacyLabel = document.createElement('span');
        privacyLabel.textContent = '🔒 Private';
        privacyLabel.classList.add('margin-left');
        return privacyLabel;
    }

    createPriorityEdit() {
        const priorityLabel = document.createElement('span');
        priorityLabel.textContent = '🚩 Med';
        return priorityLabel;
    }

    createTagsSection() {
        const tagsContainer = document.createElement('div');
        tagsContainer.className = 'note-tags-container';

        const ideaTag = document.createElement('span');
        ideaTag.textContent = '🏷️ Idea, Development';
        tagsContainer.appendChild(ideaTag);

        const addTagButton = document.createElement('button');
        addTagButton.textContent = '[+ Tag]';
        addTagButton.classList.add('margin-left');
        tagsContainer.appendChild(addTagButton);
        return tagsContainer;
    }

    // createAttachmentsSection() {
    //     const attachmentsContainer = document.createElement('div');
    //     attachmentsContainer.className = 'note-attachments-container';
    //
    //     const fileAttachment = document.createElement('span');
    //     fileAttachment.textContent = '📎 file1.pdf, image.png';
    //     attachmentsContainer.appendChild(fileAttachment);
    //
    //     const addAttachmentButton = document.createElement('button');
    //     addAttachmentButton.textContent = '[+ Attach]';
    //     addAttachmentButton.classList.add('margin-left');
    //     attachmentsContainer.appendChild(addAttachmentButton);
    //     return attachmentsContainer;
    // }

    render() {
        return this.el;
    }
}

if (!customElements.get('note-details')) {
    customElements.define('note-details', NoteDetails);
}