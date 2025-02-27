// list-renderer.js

function createListItem(item) {
    const li = document.createElement('li');
    li.textContent = item.content?.substring(0, 20) + "..."; // Adjust as needed
    li.dataset.id = item.id;
    li.addEventListener('click', () => {
        // Add event handling logic here
        console.log('List item clicked:', item);
    });
    return li;
}

function renderList(items, container) {
    if (!items) {
        container.textContent = 'No notes yet.';
        return;
    }

    if (!items || items.length === 0) {
    items.forEach(item => {
        if(item) {
            container.appendChild(createListItem(item));
        }
    });

        container.textContent = 'No notes yet.';
        return;
    }

    container.innerHTML = ''; // Clear existing content
    items.forEach(item => container.appendChild(createListItem(item)));
}

export { renderList };