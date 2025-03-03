export async function saveSettings(db, settings) {
    const settingsObjectId = 'settings'; // Use a constant ID for the settings object

    const settingsObject = {
        id: settingsObjectId,
        name: "Settings",
        tags: [
            ['objectType', 'Settings'], // Use the "Settings" type from the Ontology
            ['encrypted', 'true'],
            ['visibility', 'private'],
            ['isPersistentQuery', 'false'],
            ['relays', settings.relays],
            ['dateFormat', settings.dateFormat],
            ['profileName', settings.profileName],
            ['profilePicture', settings.profilePicture],
            ['signalingStrategy', settings.signalingStrategy],
            ['webrtcNostrRelays', settings.webrtcNostrRelays],
            ['privateKey', settings.nostrPrivateKey]
        ]
    };

    try {
        await db.saveOrUpdateObject(settingsObject);
    } catch (error) {
        console.error("Failed to save settings:", error);
        console.error("Error updating friend profile:", error);

        console.error("Failed to save settings:", error);
        throw error;
    }
}