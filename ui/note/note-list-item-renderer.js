function createListItem(item, updateNote, yMap) {
    const li = document.createElement('li');
    li.dataset.id = item.id;

    // Name editor
    const nameSpan = document.createElement('span');
    nameSpan.className = 'note-name';
    nameSpan.contentEditable = true;
    nameSpan.textContent = item.name;

    // Sync name changes with Yjs
    const yName = yMap.get(item.id).get('name');
    syncNameWithYjs(nameSpan, yName, updateNote, item.id);

    // Content preview
    const contentPreview = document.createElement('span');
    contentPreview.className = 'content-preview';

    // Sync content changes with Yjs
    const yContent = yMap.get(item.id).get('content');
    yContent.observe(event => {
        contentPreview.textContent = yContent.toString().substring(0, 50) + '...';
    });
    contentPreview.textContent = yContent.toString().substring(0, 50) + '...';

    // Delete button
    const deleteButton = document.createElement('button');
    deleteButton.textContent = 'Delete';
    deleteButton.addEventListener('click', async () => {
        await updateNote(item.id, null);
    });

    li.append(nameSpan, contentPreview, deleteButton);
    return li;
}

function syncNameWithYjs(nameSpan, yName, updateNote, itemId) {
    yName.observe(event => {
        if (!nameSpan.isSameNode(document.activeElement)) {
            nameSpan.textContent = yName.toString();
        }
    });

    nameSpan.addEventListener('input', () => {
        yName.delete(0, yName.length);
        yName.insert(0, nameSpan.textContent);
    });

    nameSpan.addEventListener('blur', async () => {
        await updateNote(itemId, {name: nameSpan.textContent});
    });
}

const NoteListRenderer = {
    createListItem: createListItem,
    syncNameWithYjs: syncNameWithYjs
};

export {NoteListRenderer};