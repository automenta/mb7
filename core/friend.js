export async function addFriend(db, friendsObjectId, friend) {
    try {
        const friendsListObject = await db.getDefaultObject(friendsObjectId);

        // Create a new Friend NObject
        const friendObjectId = `friend-${friend.pubkey}`;
        const friendObject = {
            id: friendObjectId,
            name: "Friend",
            tags: [
                ['objectType', 'People'], // Use the "People" type from the Ontology
                ['visibility', 'private'],
                ['isPersistentQuery', 'false'],
                ['pubkey', friend.pubkey],
                ['profileName', friend.name],
                ['profilePicture', friend.picture]
            ]
        };

        await db.saveOrUpdateObject(friendObject);

        // Add the friend NObject's ID to the friends list
        if (!friendsListObject.friends) {
            friendsListObject.friends = [];
        }
        if (!friendsListObject.friends.includes(friendObjectId)) {
            friendsListObject.friends.push(friendObjectId);
            friendsListObject.updatedAt = new Date().toISOString();
            await db.put(OBJECTS_STORE, friendsListObject);
        }
    } catch (error) {
        console.error("Error adding friend:", error);
        throw error;
    }
}

export async function removeFriend(db, friendsObjectId, pubkey) {
    try {
        const friendsListObject = await db.getDefaultObject(friendsObjectId);
        const friendObjectId = `friend-${pubkey}`;

        // Remove the friend NObject's ID from the friends list
        if (friendsListObject.friends && friendsListObject.friends.includes(friendObjectId)) {
            friendsListObject.friends = friendsListObject.friends.filter(id => id !== friendObjectId);
            friendsListObject.updatedAt = new Date().toISOString();
            await db.put(OBJECTS_STORE, friendsListObject);
        }

        // Optionally delete the friend NObject (if you don't want to keep a history)
        // await db.deleteObject(friendObjectId);

    } catch (error) {
        console.error("Error removing friend:", error);
        throw error;
    }
}

export async function updateFriendProfile(db, friendsObjectId, pubkey, name, picture) {
    try {
        const friendObjectId = `friend-${pubkey}`;
        const friendObject = await db.get(friendObjectId);

        if (friendObject) {
            friendObject.tags = [
                ['pubkey', friendObject.tags[0][1]],
                ['profileName', name],
                ['profilePicture', picture]
            ];
            friendObject.updatedAt = new Date().toISOString();
            await db.saveOrUpdateObject(friendObject);
        } else {
        }
    } catch (error) {
        console.error("Error updating friend profile:", error);
        throw error;
    }
}