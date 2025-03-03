import { createElement } from './utils';

function createAppMainContent() {
    const mainContent = createElement('main', {id: 'main-content'});
    return mainContent;
}

export { createAppMainContent };
