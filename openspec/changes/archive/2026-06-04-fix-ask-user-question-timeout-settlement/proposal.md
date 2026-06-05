## Why

Claude `AskUserQuestion` can time out or be settled on the backend before the frontend dismiss/skip request reaches the runtime. In that stale path, the runtime may reject with an already-settled signal such as unknown request id or disconnected workspace. Treating that rejection like an ordinary submit failure leaves an unclosable pending user-input dialog and can preserve optimistic processing state.

The frontend needs a narrow settlement rule: stale timeout/cancel responses should clear the pending request and optimistic processing residue, while normal submit failures must remain retryable.

## What Changes

- Define stale `AskUserQuestion` timeout/cancel settlement behavior for frontend user-input handling.
- Preserve the ordinary failure path: non-stale submit errors keep the request visible for retry.
- Keep submitted-answer audit behavior unchanged for successful submits.
- Keep skip/dismiss behavior on the standard response channel with empty answers.

## Non-Goals

- Do not change backend timeout duration or request id generation.
- Do not change history replay parsing for answered `AskUserQuestion` records.
- Do not change Codex `RequestUserInput` payload shape.
- Do not introduce a second composer-side submission path.

## Capabilities

### Modified Capabilities

- `codex-chat-canvas-user-input-elicitation`: extend shared `AskUserQuestion` / `RequestUserInput` settlement semantics so stale timeout/cancel runtime responses close the local pending card without converting the stale settlement into a fatal submit failure.

## Acceptance Criteria

- When dismiss/skip reaches an already timed-out or already-settled request, the pending request is removed from local queue.
- The stale path clears optimistic processing residue for the affected thread.
- Ordinary non-stale submit failure keeps the request visible and retryable.
- Successful submit still records the submitted audit item and removes the request.
- Focused hook tests cover stale settlement and ordinary failure behavior.
