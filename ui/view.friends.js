ui/view.friends.js
import { View } from '../view.js';
import { createElement } from '../utils.js';

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
        this.friendsList = createElement('ul', {id: 'friends-list'});
    }

    build() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }

        this.el.appendChild(createElement('h2', {}, 'Friends'));

        const inputContainer = createElement('div', {style: 'margin-bottom: 10px;'});
        const pubkeyInput = createElement('input', {
            type: 'text',
            placeholder: 'Enter Pubkey to Add Friend',
            id: 'pubkeyInput'
        });
        inputContainer.appendChild(pubkeyInput);

        const addButton = createElement('button', {}, 'Add Friend');
        addButton.addEventListener('click', async () => {
            const pubkey = pubkeyInput.value.trim();
            if (pubkey) {
                await this.handleAddFriend(pubkey);
                pubkeyInput.value = '';
            }
        });
        inputContainer.appendChild(addButton);
        this.el.appendChild(inputContainer);


        this.el.appendChild(this.friendsList);

        this.loadFriends();
        return this.el;
    }


    async handleAddFriend(pubkey) {
        try {
            await this.addFriend(pubkey);
            await this.subscribeToPubkey(`friend-profile-${pubkey}`);
            await this.loadFriends();
            this.showNotification(`Friend ${pubkey} added successfully.`, 'success');
        } catch (error) {
            console.error("Error adding friend:", error);
            this.showNotification(`Failed to add friend: ${error.message}`, 'error');
        }
    }


    async loadFriends() {
        this.friendsList.innerHTML = '';

        try {
            const friendsObject = await this.db.getFriends();
            if (friendsObject && friendsObject.friends) {
                for (const friendObjectId of friendsObject.friends) {
                    const friendObject = await this.db.get(friendObjectId);
                    if (friendObject) {
                        this.addFriendToList(friendObject);
                    }
                }
            }
        } catch (error) {
            console.error("Error loading friends:", error);
            this.showNotification('Failed to load friends.', 'error');
        }
    }


    addFriendToList(friendObject) {
        const listItem = createElement('li', {style: 'display: flex; align-items: center; justify-content: space-between; padding: 5px; margin-bottom: 5px; border-bottom: 1px solid #eee;'});

        const friendInfo = createElement('div', {style: 'display: flex; align-items: center;'});
        const picture = createElement('img', {
            src: friendObject.tags.find(tag => tag[0] === 'picture')?.[1] || 'default_profile_image.png',
            alt: 'Profile Picture',
            style: 'width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;'
        });
        friendInfo.appendChild(picture);

        const name = createElement('span', {}, friendObject.tags.find(tag => tag[0] === 'profileName')?.[1] || 'Unknown Name');
        friendInfo.appendChild(name);
        listItem.appendChild(friendInfo);


        const removeButton = createElement('button', {}, 'Remove');
        removeButton.addEventListener('click', async () => {
            const pubkeyTag = friendObject.tags.find(tag => tag[0] === 'pubkey');
            if (pubkeyTag && pubkeyTag[1]) {
                await this.handleRemoveFriend(pubkeyTag[1]);
            }
        });
        listItem.appendChild(removeButton);

        this.friendsList.appendChild(listItem);
    }


    async handleRemoveFriend(pubkey) {
        try {
            await this.unsubscribeToPubkey(`friend-profile-${pubkey}`);
            await this.removeFriend(pubkey);
            await this.loadFriends();
            this.showNotification(`Friend ${pubkey} removed.`, 'success');
        } catch (error) {
            console.error("Error removing friend:", error);
            this.showNotification(`Failed to remove friend: ${error.message}`, 'error');
        }
    }


    render() {
        this.build();
        return this.el;
    }
}
