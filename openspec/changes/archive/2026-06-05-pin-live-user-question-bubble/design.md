## Design

### Existing Render Contract

The implementation uses the history sticky header as the shared presentation primitive for both history browsing and live processing:

- `buildHistoryStickyCandidates(...)` derives ordinary user-message candidates from normalized message facts.
- `resolveActiveStickyHeaderCandidate(...)` keeps the sticky id stable while refreshing visible text from the latest live snapshot.
- `buildLiveTailWorkingSet(...)` bounds live presentation work while preserving the latest ordinary user question as sticky candidate.
- `buildRenderedItemsWindow(...)` keeps the sticky candidate renderable enough for boundary calculation when the tail window would otherwise trim it.
- `MessagesTimeline` renders the compact sticky header and collapse/peek affordance.

### Handoff Model

Sticky ownership is driven by physical scroll position rather than by eager latest-message selection. When the user scrolls back during realtime processing, the sticky header hands off only after a user section reaches the viewport boundary.

### Display-Only Boundary

The sticky header is presentation state. It does not mutate `ConversationItem`, copy text, runtime events, history loader payloads, or storage.

### Chosen Scope

No production change is required unless focused validation exposes drift. This change closes the task by tying the existing implementation and tests back to OpenSpec.

### Risk

Low. The existing focused tests cover the high-risk render cases and this change does not add runtime or data-layer behavior.
