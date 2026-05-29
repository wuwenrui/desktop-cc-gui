## 1. Specification

- [x] 1.1 Create proposal/design/spec/tasks artifacts for assistant message tail actions.
- [x] 1.2 Run strict OpenSpec validation for the new change.

## 2. Frontend Implementation

- [x] 2.1 Compute assistant-message action targets from the existing conversation items without coupling to the live text hot path.
- [x] 2.2 Render compact assistant tail actions in the timeline, with copy on historical replies and branch actions limited to the latest final assistant reply.
- [x] 2.3 Wire fork through the shared composer fork flow and rewind through existing anchored rewind callbacks.
- [x] 2.4 Add i18n labels and scoped CSS for the action icon group.
- [x] 2.5 Route message-tail rewind through the existing composer confirmation dialog before execution.
- [x] 2.6 Route message-tail fork through the shared confirmation dialog before execution.

## 3. Verification

- [x] 3.1 Add focused React tests for action visibility and copy behavior.
- [x] 3.2 Run focused message, layout, and app-shell adapter test suites.
- [x] 3.3 Run `npm run typecheck`.
