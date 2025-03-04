# Netention

Organize, prioritize, and grow thoughts into actionable results: real-time communication, matching, planning, and analysis.

### NObjects

- **Shared Objects:** Create, prioritize, and manage data collaboratively as `NObject`s.
- **Semantic Richness:** `NObject`s describe thoughts and ideas using semantic Tags.
- **Privacy by Default:** All `NObject`s are private unless explicitly shared.

### Search and Match

- **Persistent Queries:** `NObject`s can act as ongoing search interests when describing 'imaginary' things.
- **Semantic Matching:** `NObject`s capture meaning and intent: unambiguously, efficiently, and precisely.
- **Notifications:** Matches are received and linked via your matching NObject, enabling contact and discussion.

### Notes

- Semantic note-taking application.
- Create, list, update, delete Note NObjects.

### Friends

- Buddy List with secure Direct Messaging and Status.

### Settings

- Profile editor, Network settings, etc.

### Feed

- Public network content (Nostr messages, etc.).
- Analyzed, annotated, categorized, matched, etc.

### Networking

#### Decentralized

    - Nostr public p2p communication.

#### Realtime

    - WebRTC direct communication.
      - Yjs synchronizes incremental updates (CRDT), persists data in IndexedDB, and supports offline editing.
      - Bootstrap: WebRTC signaling servers, or Nostr.

#### Secure

    - End-to-end encryption protects private data.
    - Crypto-signing ensures `NObject` integrity and provenance.

----

## Code Guidelines

- **Clarity:** Write clear, self-documenting ES6+ code.
- **Comments:** Explain complex logic or design decisions.
- **Modern JavaScript:** Use the latest JavaScript language features and APIs.
- **DRY (Don't Repeat Yourself):** Deduplicate and unify redundant declarations.
- **Test Clarity:** Use descriptive test names.
- **Concise Tests:** Combine related test cases.
- **Ontology Driven:** Maximally leverage Ontology and Tag semantics to drive application functionality (elegant dogfooding).

## UI Design Principles

- **Progressive Disclosure:** Hide complexity until it's needed for a clean and intuitive UI.
- **Consistency and Familiarity:** Use established UI patterns and common icons for ease of learning and use.
- **Visual Hierarchy:** Use whitespace, font sizes, and visual cues to guide the user's eye and create a clear structure.
- **Minimize Cognitive Load:** Reduce clutter, simplify interactions, and provide clear feedback for a fluent user experience.
