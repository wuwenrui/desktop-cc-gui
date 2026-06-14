## 1. P0 Hotfix Implementation

- [x] 1.1 [P0] Update `src/features/app/hooks/useAppServerEvents.ts` so batch-enabled mode subscribes to both `subscribeAppServerEventBatch` and legacy `subscribeAppServerEvents`; input: existing batch branch; output: both routes call existing dispatchers; validation: focused tests receive legacy single-channel events while batch flag is on.
- [x] 1.2 [P0] Preserve batch queue/chunk cancellation semantics when adding the legacy subscription; input: existing `activeBatchDispatchCancel` cleanup; output: cleanup unsubscribes batch, unsubscribes single, clears queued batches, and cancels active batch dispatch; validation: test cleanup call counts and no leaked callbacks after unmount.
- [x] 1.3 [P0] Keep single-channel events on `dispatchAppServerEvent(...)` and batch payloads on `dispatchAppServerEventBatch(...)`; input: current dispatcher refs; output: no duplicated route implementation; validation: no new dispatcher function or duplicate handler tree is introduced.

## 2. Regression Tests

- [x] 2.1 [P0] Update `src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx` to replace the old "ONE channel" batch assertion with mixed-channel compatibility; input: existing mocked `subscribeAppServerEventBatch` / `subscribeAppServerEvents`; output: batch mode expects both subscriptions; validation: test passes.
- [x] 2.2 [P0] Add focused coverage that a legacy single-channel `item/agentMessage/delta` routes to `onAgentMessageDelta` while batch mode is enabled; input: mock legacy listener; output: handler receives workspace/thread/item/delta payload; validation: test assertion.
- [x] 2.3 [P0] Add focused coverage that a legacy single-channel `turn/completed` routes to `onTurnCompleted` while batch mode is enabled; input: mock legacy listener; output: turn settlement handler receives workspace/thread/turn ids; validation: test assertion.
- [x] 2.4 [P1] Keep existing batch behavior tests for non-coalescible deltas, status coalescing, and chunked large batches; input: existing batch test cases; output: no loss of batch-route performance guarantees; validation: focused suite passes unchanged or with compatibility wording updates.

## 3. Verification

- [x] 3.1 [P0] Run `npx vitest run src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`; input: updated hook/tests; output: focused route regression suite passes; validation: command exits 0.
- [x] 3.2 [P0] Run `npm run typecheck`; input: updated TypeScript; output: no TS errors; validation: command exits 0.
- [x] 3.3 [P1] Run `openspec validate fix-app-server-event-channel-compat --strict --no-interactive`; input: proposal/design/specs/tasks; output: change remains valid; validation: command exits 0.
- [x] 3.4 [P1] Run `git diff --name-only` and confirm implementation files are limited to `useAppServerEvents.ts`, focused tests, and this OpenSpec change unless a documented blocker requires more; input: working tree; output: scoped diff; validation: no unrelated file edits are introduced.

## 4. Manual Smoke

- [x] 4.1 [P0] With default `ccgui.perf.appServerEventBatch` behavior, send a short Claude Code prompt in the desktop app; input: active Claude workspace; output: live assistant delta or terminal completion is visible; validation: user confirmed the Claude Code conversation returned normally.
- [x] 4.2 [P1] If local emergency workaround was used, remove or reset `localStorage["ccgui.perf.appServerEventBatch"]` and repeat the Claude prompt; input: batch flag default/on state; output: conversation still returns; validation: manual smoke confirms the fix does not rely on keeping batch disabled.

## 5. Follow-Up Debt

- [x] 5.1 [P2] Decide whether to open a separate change to migrate Claude/OpenCode/Gemini direct `app.emit("app-server-event", ...)` forwarders to `EventSink`; input: current direct emit sites in `src-tauri/src/engine/commands.rs`; output: follow-up decision or new OpenSpec change; validation: documented in session notes.
- [x] 5.2 [P2] Evaluate whether `AppServerEvent` needs stable event identity before any future double-channel migration; input: event shapes across raw, normalized, terminal, and batch payloads; output: dedupe design decision; validation: no naive text-delta dedupe is introduced in this hotfix.
- [x] 5.3 [P2] Consider adding runtime diagnostics counters for `app-server-event` vs `app-server-event-batch` receipt; input: stream latency diagnostics surfaces; output: follow-up proposal if needed; validation: not required for P0 fix.
