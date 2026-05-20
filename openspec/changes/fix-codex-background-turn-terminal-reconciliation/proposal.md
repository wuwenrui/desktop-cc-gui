## Why

Codex multi-session runs can leave a background or frequently switched thread in `isProcessing=true` after the visible assistant answer has already finished. The prior fix only covers the case where `turn/completed` arrives after assistant ingress but is deferred by stale collaboration blockers; it does not cover terminal events that are missing, delayed, or routed through the wrong active-thread fallback during background session switching.

## 目标与边界

- Goal: make Codex background turns settle through thread-owned terminal identity and bounded reconciliation, even when the user has switched to another highlighted session before the final assistant evidence arrives.
- Scope: frontend Codex realtime routing, per-thread terminal diagnostics, delayed history reconciliation, and activation-time recovery for threads already marked processing.
- Compatibility boundary: preserve existing Claude, Gemini, OpenCode, shared-session, and no-output Codex deferral semantics.
- Safety boundary: `completeAgentMessage` or assistant snapshot evidence MUST NOT directly mark the turn successful; it MAY only start a short, thread-scoped reconciliation path when the event can be associated with the same Codex thread/turn.

## What Changes

- Add Codex terminal ownership rules so terminal/progress/reconcile decisions use event-owned `threadId` / `turnId` evidence instead of the currently highlighted thread.
- Add a bounded assistant-complete follow-up reconcile for Codex turns that have visible assistant completion evidence but no matching `turn/completed` within a short window.
- Add a lightweight activation-time reconcile when the user switches back to a Codex thread that is still marked processing but already has assistant completion evidence or suspected terminal drift.
- Preserve existing stalled/no-progress windows, collaboration child-agent deferral, and terminal history reconciliation idempotency.
- Add focused regression coverage for background A / foreground B multi-session routing so A settles without mutating B.

## 非目标

- No global rewrite of the thread reducer, conversation assembler, runtime manager, or EventBus contract.
- No broad timeout reduction for long Codex tasks.
- No automatic success settlement from assistant text alone.
- No behavior change for non-Codex engines or Codex turns with no assistant/output evidence.
- No new dependency or backend schema migration unless implementation proves an existing frontend identity field is unavailable.

## 技术方案对比

| Option | Approach | Trade-off |
| --- | --- | --- |
| A | Keep waiting only for `turn/completed` | Minimal change, but reproduces the stuck spinner when terminal is missed or routed away from the background thread. |
| B | Treat `completeAgentMessage` as terminal | Clears the spinner quickly, but can falsely end turns that still have tool execution or child-agent work. |
| C | Use event-owned identity plus bounded thread-scoped reconcile | Slightly more stateful, but compatible: assistant completion becomes reconciliation evidence, not terminal success. |

Selected approach: Option C. It fixes the observed multi-session timing failure without weakening authoritative terminal semantics.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `codex-realtime-canvas-message-idempotency`: Codex terminal reconciliation MUST be keyed by event-owned thread/turn identity and MUST support bounded assistant-complete follow-up reconciliation when terminal completion is absent.
- `codex-stalled-recovery-contract`: Codex processing threads with terminal drift evidence MUST be eligible for lightweight recovery reconciliation on activation without changing the long-running no-progress/stalled windows.

## Impact

- Frontend hooks:
  - `src/features/app/hooks/useAppServerEvents.ts`
  - `src/features/threads/hooks/useThreadEventHandlers.ts`
  - `src/features/threads/hooks/useThreadItemEvents.ts`
  - `src/features/threads/hooks/useThreadRealtimeHistoryReconcile.ts`
  - `src/features/threads/hooks/useThreads.ts`
- Tests: focused Vitest coverage for Codex background terminal ownership and activation-time reconciliation.
- Dependencies: none.
- APIs: no external API or persistence format change expected.

## 验收标准

- Given Codex thread A is processing in the background and thread B is highlighted, completion evidence for A MUST NOT settle or mutate B.
- Given A receives assistant completion evidence but no matching `turn/completed`, the client MUST schedule at most one bounded reconcile for A and clear processing only when the authoritative history/terminal path confirms completion.
- Given a Codex thread is switched back into view while processing is stale and terminal drift evidence exists, the client MUST perform one lightweight reconcile instead of skipping recovery solely because `isProcessing=true`.
- Given a Codex turn has no assistant completion/terminal drift evidence, existing long-running and no-output behavior MUST remain unchanged.
- Existing `turn/completed` plus assistant ingress stale-child bypass MUST remain valid.
