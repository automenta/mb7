export async function saveSettings(db, settingsObjectId, settings) {
    // TODO: Consider using a more flexible and scalable approach for storing settings data
    let settingsObject = await db.getDefaultObject(settingsObjectId);

    settingsObject.tags = [];

    const settingsMap = {
        relays: settings.relays,
        dateFormat: settings.dateFormat,
        profileName: settings.profileName,
        profilePicture: settings.profilePicture,
    };

    for (const [key, value] of Object.entries(settingsMap)) {
        if (value) {
            settingsObject.tags.push([key, value]);
        }
    }

    settingsObject.updatedAt = new Date().toISOString();
    try {
        await db.put(OBJECTS_STORE, settingsObject);
    } catch (error) {
        console.error("Failed to save settings:", error);
        console.error("Error updating friend profile:", error);

        console.error("Failed to save settings:", error);
        throw error;
    }
}