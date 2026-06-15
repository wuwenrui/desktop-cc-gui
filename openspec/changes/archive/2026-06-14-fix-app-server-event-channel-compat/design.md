## Context

`app-server-event-batch` was introduced to reduce IPC pressure during realtime streaming. The backend side is not yet fully migrated: some producers emit through `BatchedTauriEventSink`, while Claude/OpenCode/Gemini engine forwarders in `src-tauri/src/engine/commands.rs` still emit directly with `app.emit("app-server-event", payload)`.

The frontend currently treats the batch consumer as an exclusive mode: when `isAppServerEventBatchConsumerEnabled()` returns true, `useAppServerEvents` subscribes only to `app-server-event-batch` and stops listening to `app-server-event`. That creates a transport partition. Legacy engine forwarders keep emitting valid events, but the webview no longer receives them.

Constraints:

- Claude conversation streaming is a hot path; the immediate fix should avoid Rust engine lifecycle churn.
- Batch routing must keep chunking/coalescing for batch payloads.
- Legacy single-channel events must route through the same `dispatchAppServerEvent` path to avoid parallel behavior drift.
- Existing dirty work in `src/app-shell-parts/appShellDomainContexts.test.ts` is unrelated and must not be touched.

## Goals / Non-Goals

**Goals:**

- Restore Claude Code realtime and terminal event delivery while batch mode is enabled.
- Preserve batch-channel behavior for producers already using `BatchedTauriEventSink`.
- Keep implementation local to `useAppServerEvents` and its focused tests.
- Make mixed-channel compatibility explicit in tests and OpenSpec.
- Keep rollback simple.

**Non-Goals:**

- Do not change Claude CLI launch, stream parsing, or `ClaudeSession::send_message`.
- Do not migrate all backend engine forwarders to `EventSink` in the immediate hotfix.
- Do not add event deduplication unless implementation evidence shows duplicate logical events are possible today.
- Do not disable app-server event batching globally as the durable fix.
- Do not change reducer semantics for message merge, turn settlement, approvals, or request-user-input.

## Decisions

### Decision 1: Subscribe to both channels while batch mode is enabled

When `isAppServerEventBatchConsumerEnabled()` returns true, `useAppServerEvents` will subscribe to:

- `subscribeAppServerEventBatch(...)` for batched payloads
- `subscribeAppServerEvents(...)` for legacy single-channel payloads

Both subscriptions will use the same handler refs and dispatcher options. Single-channel payloads will continue to call `dispatchAppServerEvent(...)`; batch payloads will continue to call `dispatchAppServerEventBatch(...)`.

Alternatives considered:

- Turn off batch by default. This is acceptable as a manual emergency workaround but loses the performance path and leaves the contract ambiguous.
- Move all backend producers to `EventSink` first. This is architecturally cleaner but higher risk during a live outage because it touches Rust engine forwarders and multiple engines.

Rationale:

- The immediate bug is frontend non-subscription, not malformed backend events.
- Mixed-channel subscription matches the actual migration state.
- The change is small, testable, and reversible.

### Decision 2: Keep one dispatcher contract

The single-channel and batch-channel routes must converge on the existing dispatcher functions:

- `dispatchAppServerEvent(...)`
- `dispatchAppServerEventBatch(...)`

No second handler tree should be introduced for legacy events.

Alternatives considered:

- Add a separate `dispatchLegacyAppServerEvent(...)`. This would make behavior drift likely and duplicate already complex routing logic.

Rationale:

- Current routing already handles shared-session rebinding, approval/request-user-input, normalized realtime adapters, turn settlement, token usage, runtime-ended, and tool deltas.
- A second route would increase the chance that Claude is fixed while another event class regresses.

### Decision 3: Do not add frontend dedupe in the hotfix

The current Rust `BatchedTauriEventSink` does not double-emit to `app-server-event`; it emits only `app-server-event-batch`. The direct engine forwarders emit only `app-server-event`. Therefore, today's mixed-channel state does not create duplicate logical events.

Alternatives considered:

- Add event-id dedupe now. This would require defining stable event identity across raw, normalized, batch, and terminal event shapes. That is useful later but unnecessary for the immediate bug.

Rationale:

- Deduplication without a stable event id risks dropping legitimate repeated deltas.
- Text deltas are append-only and may have identical content chunks; naive dedupe is dangerous.
- The spec delta already requires dedupe or producer-side avoidance if future migrations temporarily double-emit.

### Decision 4: Update tests to encode compatibility, not exclusivity

The existing batch-consumer tests assert “subscribe to ONE channel” when batch is enabled. That assertion captured the old calibration but is now the broken contract. The tests should instead assert:

- batch mode subscribes to batch route
- batch mode also handles legacy single-channel route
- cleanup unregisters both subscriptions
- batch route still chunks large batches and preserves non-coalescible deltas
- legacy single-channel `item/agentMessage/delta` and `turn/completed` are routed under batch mode

Alternatives considered:

- Keep exclusivity tests and fix backend only. This delays the hotfix and still leaves any missed direct producer broken.

Rationale:

- Tests must describe the compatibility phase, not an idealized fully migrated end state.

## Risks / Trade-offs

- [Risk] Future producer double-emits the same logical event on both channels during migration → Mitigation: producer migration tasks must either remove direct emit before adding `EventSink`, or introduce stable event identity dedupe with explicit tests.
- [Risk] Two subscriptions increase listener count → Mitigation: only one extra app-level subscription; batch and single events both route through existing lightweight dispatcher refs.
- [Risk] Cleanup leaks one subscription → Mitigation: update focused tests to assert both unsubscribe functions are called when batch mode is enabled.
- [Risk] Batch route completion state and single-event route interleave → Mitigation: this is already possible across independent backend producers; both routes share the same dispatcher and reducer ordering remains event-arrival based.
- [Risk] Compatibility hotfix hides backend migration debt → Mitigation: keep `EventSink` migration as explicit follow-up, not part of this hotfix.

## Migration Plan

1. Update `useAppServerEvents` batch-enabled branch:
   - Keep existing batch queue/chunk dispatcher.
   - Add a legacy single-channel subscription.
   - Return cleanup that unsubscribes both routes and cancels active batch dispatch.
2. Update `useAppServerEvents.batch-consumer.test.tsx`:
   - Replace “ONE channel” batch assertion with mixed-channel compatibility assertion.
   - Add coverage for legacy `item/agentMessage/delta` under batch mode.
   - Add coverage for legacy `turn/completed` under batch mode.
   - Verify cleanup calls both unsubscribers.
3. Run focused tests and typecheck.
4. Manual smoke: with default batch flag enabled, send a Claude Code prompt and confirm live text or terminal completion appears.

Rollback:

- Revert the `useAppServerEvents` subscription change and tests.
- Emergency local workaround remains:

```js
localStorage.setItem("ccgui.perf.appServerEventBatch", "0")
```

## Open Questions

- Should a follow-up change migrate Claude/OpenCode/Gemini direct emits to `EventSink` in one pass, or engine by engine?
- Do we need a stable `eventId` field in `AppServerEvent` before future double-channel migration work?
- Should runtime evidence include per-channel receive counters (`app-server-event` vs `app-server-event-batch`) to make transport drift visible earlier?
