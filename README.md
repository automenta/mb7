# Netention

Organize, prioritize, and grow thoughts into actionable results with real-time communication, matching, and analysis.

## Features

### Objects

- **Shared Objects:** Create, prioritize, and manage data collaboratively as `NObject`s.
- **Thought Evolution:** `NObject`s describe thoughts and ideas.
- **Privacy by Default:** All `NObject`s are private unless explicitly shared.

### Search and Match

- **Persistent Queries:** `NObject`s can act as ongoing search interests.
- **Semantic Matching:** `NObject`s capture meaning and intent.
- **Tags:** Descriptive `NObject` typed `Tags` (suggested by schemas).
- **Notifications:** The app receives matches to shared `NObject`s as replies.

### P2P Network

- **Decentralized:**
    - Nostr for public p2p communication
    - WebRTC for direct peer-to-peer communication.
- **Synchronized:**
    - `yjs` CRDT enables incremental updates and offline editing.
    - WebRTC allows direct peer-to-peer communication. (Yjs/WebRTC setup)
- **Secure:**
    - End-to-end encryption protects private data.
    - Crypto-signing ensures `NObject` integrity and provenance.

### Code

- Clear, complete, clean, compact, efficient, self-documenting ES6+ code.
- Comments explain complex logic or design decisions
- Use the latest JavaScript language features and APIs
- Deduplicate and unify redundant declarations
- Use descriptive test names
- Combine related test cases

### UI Design

- *Progressive Disclosure*: This was a recurring theme. Hiding complexity until it's needed (e.g., the "Edit Details"
  button, collapsible sections) is vital for a clean and intuitive UI.
- *Consistency and Familiarity*: Using established UI patterns (like email-style replies, inline editing, common icons)
  makes the application easier to learn and use. Leveraging existing mental models is key.
- *Visual Hierarchy*: Using whitespace, font sizes, and subtle visual cues (like indentation and color) to guide the
  user's eye and create a clear visual hierarchy is critical, especially in text-based representations.
- *Minimizing Cognitive Load*: Reducing clutter, simplifying interactions, and providing clear feedback all contribute
  to a lower cognitive load, making the application feel more fluent and less overwhelming.