# Netention: Semantic Operating System (Pseudocode, v1)

**Netention** operates as a reactive, tag-driven environment where NObjects encapsulate content and behavior, orchestrated by an Ontology and synchronized via decentralized networking. This pseudocode outlines the core modules, their interactions, and the tag reaction system.

_Pseudocode sketch of app, envisioned as a "semantic operating system" where NObjects and tag-driven reactivity form the foundation. This pseudocode is structured for implementation readiness, providing a clear, high-level blueprint for a complete prototype. It captures the unified, intuitive, and empowering design we’ve refined, focusing on modularity and tag reactions to minimize complexity._

---

## Core Data Structures

### NObject
```pseudocode
CLASS NObject
    PROPERTIES
        id: string                // Unique identifier (e.g., UUID)
        content: Y.Text           // Collaborative text content
        tags: Y.Map<string, Tag>  // Reactive semantic tags
        meta: Y.Map<string, any>  // Metadata (e.g., { createdAt: timestamp })

    CONSTRUCTOR(id: string)
        this.id = id
        this.content = NEW Y.Text()
        this.tags = NEW Y.Map()
        this.meta = NEW Y.Map()
        this.meta.set("createdAt", NOW())

    METHOD observeTags()
        tags.observeDeep((events) =>
            FOR EACH event IN events
                type = event.path[0]
                tag = tags.get(type)
                IF ontology[type].onChange EXISTS
                    ontology[type].onChange(this, tag)
                END IF
            END FOR
        )
```

### Tag
```pseudocode
STRUCT Tag
    type: string              // Tag type (e.g., "public")
    value: any                // Tag value (e.g., true, "2025-02-21")
    condition: string?        // Optional condition (e.g., "before")
```

### Ontology
```pseudocode
GLOBAL ontology: MAP<string, TagSpec>

STRUCT TagSpec
    conditions: string[]?              // Allowed conditions (e.g., ["is", "before"])
    render: FUNCTION(tag: Tag) -> UI   // Renders tag UI
    validate: FUNCTION(value: any) -> boolean?  // Validates value
    suggest: FUNCTION(text: string) -> string[]? // Suggests tags
    onChange: FUNCTION(nobject: NObject, tag: Tag)? // Reaction to tag change
```

---

## Core Modules

### Data (Data.psc)
```pseudocode
MODULE Data
    GLOBAL store: IndexedDB("NetentionDB")

    FUNCTION createNObject(id: string) -> NObject
        nobject = NEW NObject(id)
        store.put("nobjects", nobject, id)
        RETURN nobject

    FUNCTION getNObject(id: string) -> NObject
        RETURN store.get("nobjects", id)

    FUNCTION saveNObject(nobject: NObject)
        store.put("nobjects", nobject, nobject.id)

    FUNCTION listNObjects() -> NObject[]
        RETURN store.getAll("nobjects")

    FUNCTION deleteNObject(id: string)
        store.delete("nobjects", id)
```

### Net (Net.psc)
```pseudocode
MODULE Net
    GLOBAL nostrPool: NostrConnection(["wss://relay.damus.io"])
    GLOBAL user: { pubkey: string, privkey: string }

    FUNCTION publish(nobject: NObject)
        event = {
            kind: 30000,
            content: JSON.stringify(nobject),
            tags: [],
            pubkey: user.pubkey,
            created_at: NOW()
        }
        event.id = hash(event)
        event.sig = sign(event, user.privkey)
        nostrPool.publish(event)

    FUNCTION subscribe(filters: object, callback: FUNCTION(event))
        nostrPool.subscribe(filters, (event) =>
            IF event.kind = 30000
                nobject = parse(event.content)
                saveNObject(nobject)
                callback(nobject)
            END IF
        )

    FUNCTION addFriend(npub: string)
        subscribe({ kinds: [0, 30000], authors: [decodeNpub(npub)] }, (nobject) =>
            // Handle friend’s profile or content
        )
```

### Ontology (Ontology.psc)
```pseudocode
MODULE Ontology
    GLOBAL ontology: MAP<string, TagSpec> = {
        "public": {
            render: (tag) => UI.checkbox(tag.value, (v) => tag.value = v),
            validate: (v) => typeof v = "boolean",
            onChange: (nobject, tag) =>
                IF tag.value
                    Net.publish(nobject)
                END IF
        },
        "task": {
            render: (tag) => UI.form({
                due: UI.datetime(tag.value.due, (v) => tag.value.due = v),
                priority: UI.select(tag.value.priority, ["Low", "High"], (v) => tag.value.priority = v)
            }),
            validate: (v) => v.due IS date AND v.priority IN ["Low", "High"],
            onChange: (nobject, tag) =>
                IF parseDate(tag.value.due) < NOW()
                    nobject.tags.set("expired", { type: "expired", value: true })
                END IF
        },
        "notify": {
            render: (tag) => UI.textInput(tag.value, (v) => tag.value = v),
            onChange: (_, tag) => UI.notify(tag.value)
        },
        "friend": {
            render: (tag) => UI.text(tag.value),
            validate: (v) => v STARTS WITH "npub",
            onChange: (_, tag) => Net.addFriend(tag.value)
        }
        // Add more from tag table...
    }

    FUNCTION addTagType(type: string, spec: TagSpec)
        ontology.set(type, spec)

    FUNCTION suggestTags(text: string) -> string[]
        RETURN flatten(
            FOR EACH type, spec IN ontology
                IF spec.suggest EXISTS AND spec.suggest(text).length > 0
                    RETURN spec.suggest(text)
                END IF
            END FOR
        )
```

### UI (UI.psc)
```pseudocode
MODULE UI
    GLOBAL currentView: string = "all"
    GLOBAL nobjects: NObject[] = []

    FUNCTION init()
        nobjects = Data.listNObjects()
        renderApp()
        Net.subscribe({ kinds: [30000] }, (nobject) =>
            Data.saveNObject(nobject)
            renderApp()
        )

    FUNCTION renderApp()
        UI.clear()
        UI.render(
            Sidebar(nobjects, setView, addTag),
            MainView(currentView, nobjects)
        )

    FUNCTION Sidebar(nobjects, setView, addTag)
        UI.render(
            UI.button("All", setView("all")),
            UI.button("Tasks", setView("tasks")),
            UI.button("Friends", setView("friends")),
            UI.list(
                FOR EACH n IN nobjects
                    UI.item(n.id, n.content.toString(), () => setView("edit:" + n.id))
                END FOR
            ),
            UI.palette(
                FOR EACH type IN ontology.keys()
                    UI.button(type, () => addTag(getCurrentNObject(), type, ontology[type].defaultValue))
                END FOR
            )
        )

    FUNCTION MainView(view: string, nobjects: NObject[])
        IF view = "all"
            RETURN renderNObjects(nobjects)
        ELSE IF view = "tasks"
            RETURN renderNObjects(filter(nobjects, (n) => n.tags.has("task")))
        ELSE IF view = "friends"
            RETURN renderNObjects(filter(nobjects, (n) => n.tags.has("friend")))
        ELSE IF view STARTS WITH "edit:"
            id = view.split(":")[1]
            RETURN renderNObject(getNObject(id))
        END IF

    FUNCTION renderNObjects(nobjects: NObject[])
        RETURN UI.list(
            FOR EACH n IN nobjects
                renderNObject(n)
            END FOR
        )

    FUNCTION renderNObject(nobject: NObject)
        RETURN UI.div(
            UI.editableText(nobject.content, (text) => nobject.content.insert(0, text)),
            UI.tags(
                FOR EACH type, tag IN nobject.tags
                    ontology[type].render(tag)
                END FOR
            )
        )

    FUNCTION notify(message: string)
        UI.showToast(message, 3000ms)

    FUNCTION getCurrentNObject() -> NObject
        RETURN nobjects.find(n => n.id = currentView.split(":")[1]) OR nobjects[0]
```

---

## Main Program Flow

```pseudocode
PROGRAM Netention
    INITIALIZE
        Data.init()
        Net.init(user.generateKeys())
        UI.init()

    LOOP
        // Handle user input via UI events
        // Tag changes trigger reactions via NObject.observeTags()
        // Nostr events update nobjects via Net.subscribe()
        UI.renderApp()
    END LOOP
```

---

## Implementation Notes

### Tag Reactions
- **Observation:** `NObject.observeTags()` centralizes all reactivity—each tag change invokes its Ontology handler.
- **Default Values:** Add `defaultValue` to `TagSpec` for initial tag creation (e.g., `"public": { value: false }`).

### UI Components
- **Sidebar:** Combines navigation and tag palette; clicking a tag type adds it to the current NObject.
- **MainView:** Switches views based on tag filters or edit mode; renders NObjects dynamically.
- **EditableText:** Binds to `nobject.content` with Yjs for real-time sync.

### Networking
- **Nostr:** Publishes NObjects as kind `30000`; subscribes to updates and friend events.
- **Local Sync:** IndexedDB ensures offline capability; Nostr syncs when online.

### Extensibility
- **Custom Tags:** Users call `Ontology.addTagType("meeting", { render: ..., onChange: ... })` via a UI form.
- **Discovery:** Experiment with tags like `"script"` for user-defined logic.

---

## UX Highlights

- **Intuitive:** Type `#public` or click a palette button—same result, instant share.
- **Predictable:** `"task"` always adds a due date field; `"notify"` always pops a message.
- **Consistent:** All NObjects render the same way—text + tags—no mode switching.
- **Fun:** Add `"emoji": "🌟"` and see your NObject sparkle!

---

## Next Steps for Prototype

1. **Setup:** Vite + Preact + TypeScript; install `yjs`, `idb`, `nostr-tools`.
2. **NObject:** Implement with Yjs and tag observer.
3. **Ontology:** Seed with core tags from table; add extension method.
4. **Data:** IndexedDB CRUD for NObjects.
5. **Net:** Basic Nostr publish/subscribe.
6. **UI:** Sidebar, MainView, and tag rendering.
7. **Test:** Add tags, verify reactions, sync across instances.

---

This pseudocode turns Netention into a **semantic OS** where tags are the user’s language, NObjects are their canvas, and reactions are the magic. It’s lean, unified, and ready to code—open to your wildest tag ideas! What do you think—any tags to tweak or add?


-----------
-----------

# Netention (Pseudocode, v2)

Netention operates as a reactive system where **NObjects** (semantic entities) and **Tags** drive all behavior through an **Ontology**. The pseudocode is structured into core components, with tag reactions as the central mechanism.

Below is a pseudocode sketch for **Netention**, our "semantic operating system," designed to prepare for a complete prototype implementation. This pseudocode captures the refined tag-driven, reactive architecture we've developed, focusing on clarity, modularity, and the core functionality outlined in the tag table and metalinguistic abstractions. It’s written in a high-level, implementation-agnostic style to guide coding in TypeScript/Preact while leaving room for specific library details (e.g., Yjs, Nostr).

---

## Core Structures

### NObject
```
STRUCT NObject
    id: STRING              // Unique identifier
    content: TEXT           // Collaborative text (Y.Text equivalent)
    tags: MAP<STRING, Tag>  // Reactive tags
    meta: MAP<STRING, ANY>  // Metadata (e.g., createdAt)

    FUNCTION constructor(id: STRING)
        SET this.id = id
        SET this.content = new TEXT("")
        SET this.tags = new MAP()
        SET this.meta = new MAP()
        SET this.meta["createdAt"] = CURRENT_TIMESTAMP
        OBSERVE this.tags WITH handleTagChange
END STRUCT

STRUCT Tag
    type: STRING            // Tag type (e.g., "public")
    value: ANY              // Value (e.g., true, "2025-02-21")
    condition: STRING?      // Optional condition (e.g., "before")
END STRUCT
```

### Ontology
```
STRUCT Ontology
    MAP<STRING, TagSpec>    // Tag type definitions

    STRUCT TagSpec
        conditions: LIST<STRING>?      // e.g., ["is", "before"]
        render: FUNCTION(Tag) -> UI    // Returns UI element
        validate: FUNCTION(ANY) -> BOOL? // Optional validation
        suggest: FUNCTION(TEXT) -> LIST<STRING>? // Optional autosuggest
        onChange: FUNCTION(NObject, Tag)? // Reaction to tag changes
    END STRUCT
END STRUCT

GLOBAL ontology: Ontology = {
    "public": {
        render: (tag) -> CHECKBOX(checked=tag.value),
        validate: (value) -> IS_BOOLEAN(value),
        onChange: (nobject, tag) -> IF tag.value THEN Net.publish(nobject)
    },
    "task": {
        render: (tag) -> 
            DIV(
                INPUT(type="datetime-local", value=tag.value.due),
                SELECT(options=["Low", "High"], value=tag.value.priority)
            ),
        validate: (value) -> HAS(value, "due") AND IN(value.priority, ["Low", "High"]),
        onChange: (nobject, tag) -> 
            IF PARSE_DATE(tag.value.due) < NOW THEN 
                nobject.tags.SET("expired", {type="expired", value=true})
    },
    "notify": {
        render: (tag) -> INPUT(type="text", value=tag.value),
        onChange: (_, tag) -> UI.notify(tag.value)
    },
    // ... Additional tags from table ...
}
```

---

## Core Functions

### Data Management
```
MODULE Data
    GLOBAL store: DATABASE = IndexedDB("Netention")

    FUNCTION create(id: STRING) -> NObject
        LET nobject = new NObject(id)
        store.PUT("nobjects", nobject.id, nobject)
        RETURN nobject

    FUNCTION get(id: STRING) -> NObject
        RETURN store.GET("nobjects", id)

    FUNCTION list() -> LIST<NObject>
        RETURN store.GET_ALL("nobjects")

    FUNCTION save(nobject: NObject)
        store.PUT("nobjects", nobject.id, nobject)

    FUNCTION delete(id: STRING)
        store.DELETE("nobjects", id)
        Net.publishDeletion(id)  // Signal via Nostr
END MODULE
```

### Network (Nostr Integration)
```
MODULE Net
    GLOBAL relays: LIST<STRING> = ["wss://relay.damus.io"]
    GLOBAL pool: NOSTR_POOL = connect(relays)

    FUNCTION publish(nobject: NObject)
        LET event = {
            kind: 30000,
            content: SERIALIZE(nobject),
            tags: [],
            pubkey: LOCAL_USER.pubkey,
            created_at: CURRENT_TIMESTAMP
        }
        pool.PUBLISH(event)

    FUNCTION subscribe(filters: OBJECT, callback: FUNCTION)
        pool.SUBSCRIBE(filters, callback)

    FUNCTION addFriend(npub: STRING)
        LET filters = { kinds: [0, 30000], authors: [npub] }
        subscribe(filters, (event) -> handleNostrEvent(event))

    FUNCTION handleNostrEvent(event)
        IF event.kind = 30000 THEN
            LET nobject = DESERIALIZE(event.content)
            Data.save(nobject)
        ELSE IF event.kind = 0 THEN
            // Update profile NObject
        ELSE IF event.kind = 5 THEN
            Data.delete(event.tags[0][1])  // Deletion event

    FUNCTION publishDeletion(id: STRING)
        LET event = { kind: 5, tags: [["e", id]], pubkey: LOCAL_USER.pubkey }
        pool.PUBLISH(event)
END MODULE
```

### UI Management
```
MODULE UI
    GLOBAL currentView: STRING = "all"
    GLOBAL notifications: LIST<STRING> = []

    FUNCTION renderApp()
        DISPLAY(
            Sidebar(),
            MainView(currentView)
        )

    FUNCTION Sidebar()
        RETURN DIV(
            BUTTON("All", onClick -> SET currentView = "all"),
            BUTTON("Tasks", onClick -> SET currentView = "tasks"),
            BUTTON("Friends", onClick -> SET currentView = "friends"),
            BUTTON("Add Tag", onClick -> showTagPalette()),
            LIST(Data.list(), (nobject) -> NObjectThumbnail(nobject))
        )

    FUNCTION MainView(view: STRING)
        LET nobjects = Data.list()
        IF view = "all" THEN
            RETURN LIST(nobjects, (n) -> NObjectView(n))
        ELSE IF view = "tasks" THEN
            RETURN LIST(FILTER(nobjects, n -> n.tags.HAS("task")), (n) -> NObjectView(n))
        ELSE IF view = "friends" THEN
            RETURN LIST(FILTER(nobjects, n -> n.tags.HAS("friend")), (n) -> NObjectView(n))

    FUNCTION NObjectView(nobject: NObject)
        RETURN DIV(
            CONTENT_EDITABLE(
                value=nobject.content,
                onInput -> nobject.content.SET(0, INPUT_TEXT)
            ),
            LIST(nobject.tags, (type, tag) -> 
                TagView(type, tag, (newValue) -> nobject.tags.SET(type, {type, value=newValue}))
            )
        )

    FUNCTION TagView(type: STRING, tag: Tag, onChange: FUNCTION)
        LET spec = ontology[type]
        RETURN spec ? spec.render(tag) WITH onChange : SPAN(type + ": " + tag.value)

    FUNCTION notify(message: STRING)
        ADD notifications, message
        DISPLAY_TOAST(message, duration=3000)
        REMOVE notifications, message AFTER 3000

    FUNCTION showTagPalette()
        LET types = KEYS(ontology)
        DISPLAY_MODAL(
            LIST(types, (type) -> 
                BUTTON(type, onClick -> addTagToSelectedNObject(type)))
        )

    FUNCTION addTagToSelectedNObject(type: STRING)
        LET nobject = SELECTED_NOBJECT  // Assume UI tracks selection
        LET defaultValue = GET_DEFAULT_VALUE(type)  // e.g., true for "public"
        nobject.tags.SET(type, {type, value=defaultValue})
END MODULE
```

### Tag Reactivity
```
FUNCTION handleTagChange(nobject: NObject, events: LIST<Event>)
    FOR EACH event IN events
        LET type = event.path[0]
        LET tag = nobject.tags.GET(type)
        LET spec = ontology[type]
        IF spec.onChange THEN
            spec.onChange(nobject, tag)
END FUNCTION
```

---

## Main Loop

```
FUNCTION main()
    INITIALIZE Database with IndexedDB
    INITIALIZE Net with Nostr relays
    LOAD initial NObjects from Data.list()
    SET Net.subscribe({kinds: [0, 30000, 5]}, Net.handleNostrEvent)
    UI.renderApp()

    // Event loop (pseudo)
    WHILE RUNNING
        LISTEN FOR UI events (e.g., content edits, tag changes)
        LISTEN FOR Net events (e.g., Nostr updates)
        UPDATE NObjects and UI reactively
END FUNCTION
```

---

## Implementation Notes

### Setup
```
INITIALIZE Preact with Vite
INSTALL yjs, idb, nostr-tools
CREATE main.ts TO CALL main()
```

### Tag-Driven Features
- **Publishing:** Handled by `"public"` tag’s `onChange`.
- **Tasks:** `"task"` tag filters into Task view; `"due"` and `"expired"` cascade.
- **Notifications:** `"notify"` tag triggers toast.
- **Friends:** `"friend"` tag subscribes to Nostr events.
- **Custom Styles:** `"style"` and `"emoji"` tags apply UI tweaks.

### UX Flow
```
USER opens app
    -> Sees all NObjects in "All" view
USER clicks "Add Tag" button
    -> Picks "task" from palette
    -> NObject gains "task" tag with UI (due date, priority)
USER sets "due" to tomorrow
    -> If overdue later, "expired" tag appears
USER toggles "public" to true
    -> NObject publishes to Nostr
USER types "#notify Hello" in content
    -> Autosuggest adds "notify" tag; toast shows "Hello"
```

---

## Metalinguistic Clarity

- **Tags as Verbs:** `"public"`, `"notify"`, `"share"` act—users command with tags.
- **NObject as Noun:** A universal container shaped by tag verbs.
- **Ontology as Grammar:** Defines the rules of tag expression and reaction.
- **Reactivity as Pulse:** Every tag beat drives the system forward.

This pseudocode sketches a **semantic OS** where users wield tags like brushes on an NObject canvas, painting functionality with minimal effort. It’s concise (~200-300 lines in pseudocode), ready for a TypeScript/Preact prototype, and brimming with potential for fun and power. Let’s prototype it—any tweaks before we code?
