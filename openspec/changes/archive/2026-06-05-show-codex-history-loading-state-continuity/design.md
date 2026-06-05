## Design

### Existing Implementation

The current implementation already carries a bounded presentation state:

- `useThreadHistoryLoadingState()` owns `historyLoadingByThreadId` as transient UI state.
- `useThreads.setActiveThreadId(...)` marks unloaded non-pending Codex history selections as loading before lazy resume/local history restore.
- Loading is cleared when the selected thread changes, when resume settles, or when the selected target is already loaded/processing.
- `Messages` passes `isHistoryLoading` into the timeline projection.
- `buildTimelineProjectionRows(...)` chooses the `historyLoading` empty-state row when the surface has no effective items and no visible user-input request.
- `MessagesTimeline` renders a scoped `role="status"` restoring surface instead of the generic empty-thread placeholder.

### Contract Boundary

The loading state is presentation-only. It does not mutate `ConversationItem`, local history facts, runtime events, storage, or durable transcript parity.

### Chosen Scope

No production change is planned unless validation shows the current behavior drifted. This is a closure/change-continuity task for an already implemented basic UX fix.

### Risk

Low. The focused tests already cover the user-visible message surface and the thread-selection loading lifecycle.
