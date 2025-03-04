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
        titleInput.addEventListener('input', () => {
            onInput(titleInput.value);
        });
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

    createPrivacyEdit() {
        const container = this.createPrivacyContainer();
        const label = this.createPrivacyLabel();
        const checkbox = this.createPrivacyCheckbox();
        container.appendChild(label);
        container.appendChild(checkbox);
        return container;
    }

    createLinkedView() {
        return this.createTextView('Linked View');
    }

    createMatchesView() {
         const matchesView = document.createElement('div');
         matchesView.className = 'matches-view';
         matchesView.style.padding = '10px';
         return matchesView;
    }

    createMainArea() {
        const mainArea = document.createElement('div');
        mainArea.style.flex = '1';
        mainArea.style.flexGrow = '1';
        mainArea.style.padding = '10px';
        return mainArea;
    }

    createContentArea() {
        const contentArea = document.createElement('div');
        contentArea.className = 'note-content-area';
        contentArea.style.padding = '10px';
        return contentArea;
    }

    createTodoArea() {
        const todoArea = document.createElement('div');
        todoArea.className = 'note-todo-area';
        todoArea.style.padding = '10px';
        return todoArea;
    }

    createTagArea() {
        const tagArea = document.createElement('div');
        tagArea.className = 'note-tag-area';
        tagArea.style.padding = '10px';
        return tagArea;
    }

    createMyObjectsArea() {
        const myObjectsArea = document.createElement('div');
        myObjectsArea.className = 'my-objects-area';
        myObjectsArea.style.padding = '10px';
        return myObjectsArea;
    }
}
