ui/note/note.ui.js
import { createElement } from '../utils.js';

export class NoteUI {
    constructor(noteView) {
        this.noteView = noteView;
        this.el = createElement('div', {className: 'note-view'});
        this.elements = {};
    }

    render() {
        this.elements.sidebar = this.createSidebarContainer();
        this.elements.detailArea = this.createDetailArea();
        this.elements.toolbar = this.createToolbarContainer();
        this.elements.editArea = this.createEditArea();
        this.elements.myObjectsArea = this.createMyObjectsArea();

        this.el.appendChild(this.elements.sidebar);
        this.el.appendChild(this.elements.detailArea);
        this.el.appendChild(this.elements.toolbar);
        this.el.appendChild(this.elements.editArea);
        this.el.appendChild(this.elements.myObjectsArea);

        return this.el;
    }

    renderSidebar(notesSidebar) {
        this.elements.sidebar.appendChild(notesSidebar.render());
    }

    renderDetails(noteDetails) {
        this.elements.detailArea.appendChild(noteDetails);
    }

    renderToolbar(noteToolbar) {
        this.elements.toolbar.appendChild(noteToolbar.render());
    }

    renderEdit(editView) {
        this.elements.editArea.appendChild(editView.render());
    }

    renderMyObjectsList(myObjectsList) {
        this.elements.myObjectsArea.appendChild(myObjectsList.render());
    }


    createSidebarContainer() {
        return createElement('div', {className: 'sidebar-container'});
    }

    createDetailArea() {
        return createElement('div', {className: 'detail-area'});
    }

    createToolbarContainer() {
        return createElement('div', {className: 'toolbar-container'});
    }

    createEditArea() {
        return createElement('div', {className: 'edit-area-container'});
    }

    createPrivacyContainer() {
        return createElement('div', {className: 'privacy-container'});
    }

    createPrioritySelect() {
        const prioritySelect = document.createElement('select');
        prioritySelect.className = 'note-priority-select';
        return prioritySelect;
    }

    createTextView(text) {
        const view = document.createElement('div');
        view.textContent = text;
        return view;
    }

    createPrivacyLabel() {
        return createElement('label', {htmlFor: 'privacyCheckbox'}, 'Private:');
    }

    createPrivacyCheckbox() {
        return createElement('input', {type: 'checkbox', id: 'privacyCheckbox'});
    }

    createMyObjectsArea() {
        const myObjectsArea = document.createElement('div');
        myObjectsArea.className = 'my-objects-area';
        myObjectsArea.style.padding = '10px';
        return myObjectsArea;
    }
}
