import DOMPurify from 'dompurify';

const pubkeyRegex = /^[0-9a-fA-F]{64}$/;

export class EventHandler {
    constructor(app) {
        this.app = app;
    }

    async handleKind0(event) {
        try {
            const profileData = JSON.parse(event.content);
            if (event.pubkey === window.keys.pub) {
                this.app.settingsView?.displayProfile(profileData);
            } else {
                await this.app.db.updateFriendProfile(event.pubkey, profileData.name, profileData.picture);
                if (this.app.mainContent.currentView instanceof this.app.FriendsView && (await this.app.db.getFriend(event.pubkey))) {
                    await this.app.friendsView.loadFriends();
                }
            }
        } catch (error) {
            console.error("Error processing Kind 0 event:", error);
        }
    }

    async handleKind3(event) {
        try {
            let contacts = [];
            try {
                const content = JSON.parse(event.content);
                if (Array.isArray(content)) {
                    contacts = content;
                } else if (typeof content === 'object' && content !== null) {
                    contacts = Object.keys(content);
                }
            } catch (e) {
                console.warn("Error parsing content:", e);
            }

            const pTags = event.tags.filter(tag => tag[0] === 'p').map(tag => tag[1]);
            contacts = contacts.concat(pTags);

            contacts = [...new Set(contacts)];

            for (const pubkey of contacts) {
                if (pubkeyRegex.test(pubkey) && pubkey !== window.keys.pub) {
                    await this.app.db.addFriend(pubkey);
                }
            }
            if (event.pubkey === window.keys.pub) {
                await this.app.friendsView?.loadFriends();
            }
        } catch (error) {
            console.error("Error processing kind 3 event:", error);
        }
    }

    async handleKind5(event) {
        try {
            const eventIdsToDelete = event.tags.filter(tag => tag[0] === 'e').map(tag => tag[1]);
            for (const eventId of eventIdsToDelete) {
                try {
                    await this.app.db.delete(eventId);
                } catch (error) {
                    console.error(`Failed to delete object with id ${eventId}: `, error);
                }
            }

            if (this.app.mainContent.currentView instanceof this.app.ContentView) {
                await this.app.renderList();
            }
        } catch (error) {
            console.error("Error handling kind 5 event:", error);
        }
    }

    async handleObjectEvent(event) {
        try {
            if (!event.content || event.content.trim()[0] !== "{") return;
            const data = JSON.parse(event.content);
            if (!data.id) return;

            const existingObj = await this.app.db.get(data.id);
            const nobj = {
                ...existingObj,
                id: data.id,
                name: data.name,
                content: DOMPurify.sanitize(data.content),
                tags: this.extractTagsFromEvent(event),
                createdAt: existingObj?.createdAt || (event.created_at * 1000),
                updatedAt: event.created_at * 1000,
            };
            await this.app.db.save(nobj);
        } catch (error) {
            console.error("Parsing error", error);
        }
    }

    extractTagsFromEvent(event) {
        const tags = [];
        for (const tag of event.tags) {
            if (tag.length >= 2) {
                const tagName = tag[0];
                const tagValue = tag[1];

                if (tagName === 't') {
                    tags.push({ name: tagValue, condition: 'is', value: '' })
                } else {
                    let condition = 'is';
                    let value = tagValue;

                if ((tagName === 'p' || tagName === 'e') && tag.length >= 2) {
                        condition = 'references';
                    }
                    tags.push({ name: tagName, condition, value });
                }
            }
        }
        return tags;
    }
}