## Context

`AskUserQuestion` backend waits up to 300 seconds. After timeout, Rust clears the pending request and resumes the original process. The frontend request card can still remain visible because the queue is client-side state. Existing cleanup already handles some stale dismiss errors, but timed-out Submit and card-local failure paths can still surface `提交失败` and keep an impossible request visible.

## Goals / Non-Goals

**Goals:**

- Treat timed-out user-input settlement as idempotent cleanup when runtime reports stale / unknown / timeout / workspace disconnected.
- Remove pending card state and clear optimistic processing residue for stale settlements.
- Preserve retry behavior for ordinary non-stale submit failures.

**Non-Goals:**

- Do not change the backend 300 second wait.
- Do not change `respond_to_server_request` payload shape.
- Do not redesign card layout or wording.

## Decisions

### Decision 1: Frontend stale settlement classifier

Use the existing `useThreadUserInput` settlement path as the source of truth for runtime response handling. Extend its classifier so stale errors can be handled consistently for both dismiss and timeout-aware submit flows.

Alternative considered: add a backend command to query request liveness before each submit. Rejected because it adds a race-prone extra round trip and still cannot guarantee liveness by the time the actual response arrives.

### Decision 2: Component-level timeout context

`RequestUserInputMessage` already owns the card countdown. It should pass timeout context into the settlement path when the local card is at `0:00`, then locally settle the card if the runtime response is stale.

Alternative considered: remove the client countdown and depend only on backend events. Rejected because the existing UI already communicates timeout to users, and removing it would broaden the behavior change.

## Risks / Trade-offs

- [Risk] Over-broad stale matching could hide real submit failures. → Mitigation: keep ordinary failure tests and only settle timeout-aware stale responses.
- [Risk] Local countdown can drift from backend timeout. → Mitigation: stale cleanup only activates after runtime returns a stale-like error; countdown alone does not remove successful or retryable requests.
- [Risk] Dismiss and submit have different user intent. → Mitigation: preserve `recordSubmittedItem` behavior and avoid adding submitted-answer audit items for stale cleanup.

## Migration Plan

No data migration. Rollback is a straight revert of frontend hook/component/test/spec changes.
