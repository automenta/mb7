# Netention
Organize, prioritize, and grow thoughts into actionable results: real-time communication, matching, planning, and
analysis.

### NObjects
- **Shared Objects:** Create, prioritize, and manage data collaboratively as `NObject`s.
- **Thought Evolution:** `NObject`s describe thoughts and ideas using semantic Tags
- **Privacy by Default:** All `NObject`s are private unless explicitly shared.

### Search and Match
- **Persistent Queries:** `NObject`s can act as ongoing search interests when describing 'imaginary' things
- **Semantic Matching:** `NObject`s capture meaning and intent: unambiguously, efficiently, and precisely
- **Notifications:** Matches are received, linked via your matching NObject, enabling contact and discussion

### Notes
- Semantic note-taking application
- Create, list, update, delete Note NObjects

### Friends
- Buddy List w/ secure Direct Messaging, Status

### Settings
- Profile editor, Network settings, etc...

### Feed
- Public network content (Nostr messages, etc...)
- Analyzed, annotated, categorized, matched, etc...

### Networking
#### Decentralized
    - Nostr public p2p communication
#### Realtime
    - WebRTC direct communication
      - Yjs synchronizes incremental updates (CRDT), persists data in IndexedDB, and supports offline editing
      - Bootstrap: WebRTC signaling servers, or Nostr
#### Secure
    - End-to-end encryption protects private data.
    - Crypto-signing ensures `NObject` integrity and provenance.

----

## Code
- Clear, complete, clean, compact, efficient, self-documenting ES6+ code.
- Comments explain complex logic or design decisions
- Use the latest JavaScript language features and APIs
- Deduplicate and unify redundant declarations
- Use descriptive test names
- Combine related test cases
- Maximally leverage Ontology and Tag semantics to drive application functionality (elegant dogfooding)

## UI Design
- *Progressive Disclosure*: This was a recurring theme. Hiding complexity until it's needed (e.g., the "Edit Details"
  button, collapsible sections) is vital for a clean and intuitive UI.
- *Consistency and Familiarity*: Using established UI patterns (like email-style replies, inline editing, common icons)
  makes the application easier to learn and use. Leveraging existing mental models is key.
- *Visual Hierarchy*: Using whitespace, font sizes, and subtle visual cues (like indentation and color) to guide the
  user's eye and create a clear visual hierarchy is critical, especially in text-based representations.
- *Minimizing Cognitive Load*: Reducing clutter, simplifying interactions, and providing clear feedback all contribute
  to a lower cognitive load, making the application feel more fluent and less overwhelming.