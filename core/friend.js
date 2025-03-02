export async function addFriend(db, friendsObjectId, friend) {
    try {
        const friendsObject = await db.getDefaultObject(friendsObjectId);
        const existingFriendIndex = friendsObject.tags.findIndex(
            (tag) => tag[0] === 'People' && tag[1] === friend.pubkey
        );

        if (existingFriendIndex === -1) {
            friendsObject.tags.push(['People', friend.pubkey, friend.name, friend.picture]);
            friendsObject.updatedAt = new Date().toISOString();
            await db.put(OBJECTS_STORE, friendsObject);
        }
    } catch (error) {
        console.error("Failed to save settings:", error);
        console.error("Error updating friend profile:", error);


        throw error;
    }
}

export async function removeFriend(db, friendsObjectId, pubkey) {
    try {
        const friendsObject = await db.getDefaultObject(friendsObjectId);
        const friendIndex = friendsObject.tags.findIndex(
            (tag) => tag[0] === 'People' && tag[1] === pubkey
        );

        if (friendIndex !== -1) {
            friendsObject.tags.splice(friendIndex, 1);
            friendsObject.updatedAt = new Date().toISOString();
            await db.put(OBJECTS_STORE, friendsObject);
        }
    } catch (error) {
        console.error("Failed to save settings:", error);
        console.error("Error updating friend profile:", error);


        throw error;
    }
}

export async function updateFriendProfile(db, friendsObjectId, pubkey, name, picture) {
    try {
        const friendsObject = await db.getDefaultObject(friendsObjectId);
        const friendIndex = friendsObject.tags.findIndex(
            (tag) => tag[0] === 'People' && tag[1] === pubkey
        );

        if (friendIndex !== -1) {
            friendsObject.tags[friendIndex][2] = name;
            friendsObject.tags[friendIndex][3] = picture;
            friendsObject.updatedAt = new Date().toISOString();
            await db.put(OBJECTS_STORE, friendsObject);
        }
    } catch (error) {
        console.error("Failed to save settings:", error);
        console.error("Error updating friend profile:", error);

        console.error("Error updating friend profile:", error);
        throw error;
    }
}