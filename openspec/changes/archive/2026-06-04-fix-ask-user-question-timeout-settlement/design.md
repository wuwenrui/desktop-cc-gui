## Context

`useThreadUserInput` owns frontend orchestration for answering or dismissing pending user-input requests. It marks the thread processing optimistically before calling `respondToUserInputRequest`, then removes the pending request after successful settlement.

The problematic edge case is backend-first settlement: Claude times out or cancels the question, then the frontend user clicks dismiss/skip or submits an empty response. The runtime response can reject because the request is already unknown or the workspace/runtime is disconnected. That rejection is not equivalent to a normal submit failure; the request is already obsolete and must be removed locally.

## Design Goals

- Make stale timeout/cancel settlement fail-closed for UI residue: remove obsolete pending request and clear optimistic processing.
- Keep normal submit failures retryable.
- Avoid broad string matching that hides real failures.
- Preserve existing response channel and submitted audit item behavior.

## Decisions

### Decision 1: classify only narrow stale-settled errors

The stale classifier recognizes high-confidence already-settled signals:

- error message contains `unknown request_id for askuserquestion`
- empty response plus `workspace not connected`

The second branch is intentionally limited to empty responses because it represents skip/dismiss or timeout cancellation, not a user-provided answer that failed to submit.

### Decision 2: cleanup happens inside catch before returning

On any response failure after optimistic processing was set, the hook first clears processing for the state thread. If the error is classified stale, it then dispatches `removeUserInputRequest` and returns without throwing. If it is not stale, it rethrows so the UI can preserve the request and expose retry/error behavior.

### Decision 3: no backend/API shape change

This change is frontend settlement behavior. It does not alter `respondToUserInputRequest`, request payload structure, or runtime timeout policy.

## Risks

- Over-classifying stale errors could hide real submission failures. Mitigation: require either an explicit unknown request id signal or an empty response plus workspace disconnected.
- Under-classifying stale errors can leave a stuck dialog. Mitigation: focused tests cover stale dismiss/timeout paths.
