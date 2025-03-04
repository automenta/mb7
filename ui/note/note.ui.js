// ui/note/note.ui.js
import { createElement } from '../utils.js';

export class NoteUI {
    createPrivacyContainer() {
        const privacyContainer = createElement('div', { className: 'privacy-container' });
        return privacyContainer;
    }

    createPrioritySelect() {
        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'note-priority-select';
        return prioritySelect;
    }

    createTitleInput(onInput) {
        const titleInput = document.createElement('input');
        titleInput.type = 'text';
        titleInput.placeholder = 'Note Title';
        titleInput.className = 'note-title-input';
        titleInput.addEventListener('input', onInput);
        return titleInput;
    }

    createTextView(text) {
        const view = document.createElement('div');
        view.textContent = text;
        return view;
    }

    createPrivacyLabel() {
        const privacyLabel = createElement('label', { htmlFor: 'privacyCheckbox' }, 'Private:');
        return privacyLabel;
    }

    createPrivacyCheckbox() {
        const privacyCheckbox = createElement('input', { type: 'checkbox', id: 'privacyCheckbox' });
        return privacyCheckbox;
    }
}
