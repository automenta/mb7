import {View} from './view';
import {createElement} from './utils';
import * as NostrTools from 'nostr-tools';

export class FriendsView extends View {
    constructor(app, db, nostr) {
        super(app, `<div id="friends-view" class="view"><h2>Friends</h2></div>`);
        this.app = app;
        this.db = db;
        this.nostr = nostr
    }

    build() {
        while (this.el.firstChild) {
            this.el.removeChild(this.el.firstChild);
        }

        this.el.appendChild(createElement('h2', {}, 'Friends'));

        // Input field for adding a friend
        const inputContainer = createElement('div', {style: 'margin-bottom: 10px;'});
        const pubkeyInput = createElement('input', {
            type: 'text',
            id: 'friend-pubkey',
            placeholder: 'npub or hex pubkey',
            style: 'width: 200px; margin-right: 10px;'
        });
        inputContainer.appendChild(pubkeyInput);

        // Add friend button
        const addFriendButton = createElement('button', {id: 'add-friend', style: 'margin-right: 10px;'}, 'Add Friend');
        addFriendButton.addEventListener('click', this.addFriend.bind(this));
        inputContainer.appendChild(addFriendButton);

        this.el.appendChild(inputContainer);

        // List of friends
        this.friendsList = createElement('ul', {id: 'friends-list', style: 'list-style-type: none; padding: 0;'});
        this.el.appendChild(this.friendsList);

        this.loadFriends();
        return this.el;
    }

    async loadFriends() {
        this.friendsList.innerHTML = ''; // Clear existing list

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
            this.app.showNotification("Failed to load friends.", "error");
        }
    }

    addFriendToList(friendObject) {
        const listItem = createElement('li', {style: 'display: flex; align-items: center; justify-content: space-between; padding: 5px; border-bottom: 1px solid #eee;'});

        // Friend Info
        const friendInfo = createElement('div', {style: 'display: flex; align-items: center;'});
        const picture = createElement('img', {
            src: friendObject.tags.find(tag => tag[0] === 'picture')?.[1] || 'default_profile_image.png',
            alt: 'Profile Picture',
            style: 'width: 30px; height: 30px; border-radius: 50%; margin-right: 10px;'
        });
        friendInfo.appendChild(picture);

        const name = friendObject.tags.find(tag => tag[0] === 'name')?.[1] || 'Unknown';
        friendInfo.appendChild(createElement('span', {}, name));

        listItem.appendChild(friendInfo);

        // Remove Button
        const removeButton = createElement('button', {}, 'Remove');
        removeButton.addEventListener('click', () => this.removeFriend(friendObject.tags[0][1]));
        listItem.appendChild(removeButton);

        this.friendsList.appendChild(listItem);
    }

    /**
     * Adds a friend to the list.
     */
    async addFriend() {
        // Get the pubkey from the input field
        let pubkey = this.el.querySelector("#friend-pubkey").value.trim();
        console.log('addFriend called');
        if (!pubkey) return;

        // Check if input is an npub and decode to hex
        try {
            if (pubkey.startsWith("npub")) {
                pubkey = NostrTools.nip19.decode(pubkey).data;
            }
        } catch (error) {
            this.showNotification("Invalid npub format.", "error");
            return;
        }

        // Validate pubkey
        if (!/^[0-9a-f]{64}$/i.test(pubkey)) {
            this.showNotification("Invalid pubkey format.", "error");
            return;
        }

        try {
            // Add the friend to the database
            await this.db.addFriend(pubkey);

            // Subscribe to the friend's profile
            await this.nostr.subscribeToPubkey(pubkey, async event => {
                console.log('Event received for friend pubkey:', event);
                if (event.kind === 0) {
                    try {
                        const profile = JSON.parse(event.content);
                        const name = profile.name || 'Unknown';
                        const picture = profile.picture || 'default_profile_image.png';
                        await this.db.updateFriendProfile(pubkey, name, picture);
                        this.loadFriends(); // Refresh the friend list
                    } catch (parseError) {
                        console.error('Failed to parse profile content:', parseError);
                        this.showNotification("Failed to parse profile content.", "error");
                    }
                }
            });

            // Refresh the friend list
            await this.loadFriends();
            this.showNotification("Friend added successfully.", "success");
        } catch (error) {
            this.showNotification("Failed to add friend.", "error");
        }
    }

    /**
     * Removes a friend from the list.
     * @param {string} pubkey - The pubkey of the friend to remove.
     */
    async removeFriend(pubkey) {
        try {
            // Unsubscribe from the friend's profile
            await this.nostr.unsubscribeToPubkey(`friend-profile-${pubkey}`);

            // Remove the friend from the database
            await this.db.removeFriend(pubkey);

            // Refresh the friend list
            await this.loadFriends();
            this.showNotification("Friend removed successfully.", "success");
        } catch (error) {
            this.showNotification("Failed to remove friend.", "error");
        }
    }
}
