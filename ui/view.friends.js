import { View } from './view.js';
import { createElement } from './utils.js';

export class FriendsView extends View {
    constructor(store, db, addFriend, removeFriend, subscribeToPubkey, unsubscribeToPubkey, showNotification) {
        super(store, `<div id="friends-view" class="view"><h2>Friends</h2></div>`);
        this.store = store;
        this.db = db;
        this.addFriend = addFriend;
        this.removeFriend = removeFriend;
        this.subscribeToPubkey = subscribeToPubkey;
        this.unsubscribeToPubkey = unsubscribeToPubkey;
        this.showNotification = showNotification;
    }

    build() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }

        this.el.appendChild(createElement('h2', {}, 'Friends'));

        const inputContainer = createElement('div', {style: 'margin-bottom: 10px;'});
        const pubkeyInput = createElement('input', {
            type: 'text',
            placeholder: 'Enter Pubkey',
            id: 'pubkeyInput'
        });
        inputContainer.appendChild(pubkeyInput);

        const addButton = createElement('button', {}, 'Add Friend');
        addButton.addEventListener('click', async () => {
            const pubkey = pubkeyInput.value.trim();
            if (pubkey) {
                try {
                    await this.addFriend(pubkey);
                    this.showNotification('Friend added successfully.', 'success');
                    pubkeyInput.value = '';
                    this.render(); // Re-render the view to update the friends list
                } catch (error) {
                    console.error('Error adding friend:', error);
                    this.showNotification(`Failed to add friend: ${error.message}`, 'error');
                }
            } else {
                this.showNotification('Please enter a valid Pubkey.', 'warning');
            }
        });
        inputContainer.appendChild(addButton);
        this.el.appendChild(inputContainer);


        const friendsList = createElement('ul', {});
        this.store.friends.forEach(friendPubkey => {
            const listItem = createElement('li', {}, friendPubkey);
            const removeButton = createElement('button', {}, 'Remove');
            removeButton.addEventListener('click', async () => {
                try {
                    await this.removeFriend(friendPubkey);
                    this.showNotification('Friend removed successfully.', 'success');
                    this.render(); // Re-render the view to update the friends list
                } catch (error) {
                    console.error('Error removing friend:', error);
                    this.showNotification(`Failed to remove friend: ${error.message}`, 'error');
                }
            });
            listItem.appendChild(removeButton);
            friendsList.appendChild(listItem);
        });
        this.el.appendChild(friendsList);
    }

    render() {
        this.build();
        return this.el;
    }
}
