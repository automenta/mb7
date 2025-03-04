// ui/note/note.ui.js
import { createElement } from '../utils.js';

export function createPrivacyContainer() {
    const privacyContainer = createElement('div', { className: 'privacy-container' });
    return privacyContainer;
}

export function createPrioritySelect() {
    const prioritySelect = document.createElement('select');
    prioritySelect.className = 'note-priority-select';
    return prioritySelect;
}

export function createTitleInput(onInput) {
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'Note Title';
    titleInput.className = 'note-title-input';
    titleInput.addEventListener('input', onInput);
    return titleInput;
}

export function createTextView(text) {
    const view = document.createElement('div');
    view.textContent = text;
    return view;
}
