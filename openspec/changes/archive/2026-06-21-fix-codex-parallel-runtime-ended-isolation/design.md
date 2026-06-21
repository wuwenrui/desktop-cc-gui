## Context

Codex conversation lifecycle is already thread-scoped after state mutation. The weak point is before mutation: raw app-server events are sometimes routed through active Codex thread fallback when owner fields are missing.

Observed failure model:

```text
Parallel Codex sessions A and B
  -> raw event from A lacks owner context
  -> dispatcher falls back to active/visible Codex thread B
  -> B receives terminal/progress/start mutation
  -> completed session can revive loading, or active session can be settled incorrectly
```

This aligns with the user-visible symptoms:

- 单个 Codex 会话正常，因为 active fallback 常常等于真实 owner。
- 两个并行 Codex 会话异常，因为 active fallback becomes a guessed owner。
- 已完成会话重新 loading，因为 late/ambiguous progress/start event can still enter liveness mutation paths.
- 卡 loading，因为 terminal settlement can be consumed by the wrong thread, leaving the real owner unsettled.

> Deep reasoning summary: The bug is not missing variable isolation. It is missing event ownership proof. State isolation only works after the event has already been assigned to the correct owner.

Additional reproduced evidence from the 2026-06-19 parallel Codex test:

- Runtime pool ledger reached `graceful-idle` with `turnLeaseCount=0` and `streamLeaseCount=0`.
- Session radar recorded both Codex sessions in `recentCompleted`.
- Thread diagnostics recorded `turn/completed` and `turn-settlement:settled` for both affected `threadId + turnId` pairs.
- The remaining user-visible failure was sidebar/composer `isProcessing` staying or returning to `true`.

This narrows the hot path to frontend lifecycle revival after settlement. Terminal settlement must quarantine the exact Codex turn, and processing-start handlers such as `turn/started` must reject duplicate events for that quarantined identity without blocking verified successor turns.

Additional reproduced evidence after lifecycle hardening:

- Two parallel Codex conversations can correctly finish, but during tab switching the active conversation curtain may briefly show the previous tab's content.
- The final curtain content recovers after render catches up, which means persistent reducer state is not the owner of this symptom.
- The residual path is render-layer deferred state: `threadId` switches immediately, while `useDeferredValue` can still expose the previous thread's stable snapshot for a short window.

This adds a second invariant: deferred render/presentation snapshots are useful for same-thread streaming performance, but they must be scoped by `workspaceId + threadId` before they can be reused.

## Current Code Map

- `src/features/app/hooks/useAppServerEvents.ts`
  - Broad raw app-server dispatcher.
  - `runtime/ended` currently uses `getActiveCodexThreadId` when no `affectedThreadIds` / `affectedActiveTurns` exist, then calls `onTurnError`.
  - `item/tool/requestUserInput`, `token_count`, reasoning deltas, generated image fallback, and `codex/parseError` also use active Codex fallback in some no-thread-id cases.
  - `turn/started` and `processing/heartbeat` already require explicit thread id, which is the right direction.
- `src/features/threads/hooks/useThreadEventHandlers.ts`
  - Mature liveness primitives already exist: `turnDiagnosticsRef`, `quarantinedCodexTurnsRef`, `shouldSkipCodexTurnEvent`, `isRealtimeTurnTerminalExact`, three-evidence settlement.
  - Normalized late-event protection exists; raw fallback needs equivalent owner-aware protection.
- `src/features/threads/hooks/useThreads.ts`
  - Owns `threadsByWorkspaceRef`, `threadStatusByIdRef`, active thread refs, and app-server handler wiring.
  - This is the right place to provide a bounded fallback resolver such as "exactly one processing Codex thread in this workspace".
- `src-tauri/src/backend/app_server_event_helpers.rs`
  - `runtime/ended` already emits affected thread/turn context when backend has it.
  - Frontend should treat these explicit fields as the primary owner source.
- `src/features/messages/components/Messages.tsx`
  - Owns `renderSourceItems`, `deferredRenderSourceItems`, `presentationRenderedItems`, `deferredPresentationRenderedItems`, and `timelinePresentationItems`.
  - `useDeferredValue` smooths large streaming updates, but an unscoped deferred value can temporarily outlive the conversation tab that produced it.
- `src/features/messages/components/messagesLiveWindow.ts`
  - `resolveStreamingPresentationItems` preserves a stable presentation snapshot and appends current live rows.
  - It must reject a stable snapshot from a different conversation scope before merging rows.

## Design Principles

1. Test locks before behavior changes.
   - First preserve what is currently correct.
   - Then add failing pollution regressions.
   - Only then modify event routing.

2. Owner proof before mutation.
   - UI selection is navigation state.
   - Lifecycle owner is runtime/thread/turn identity.
   - A selected tab MUST NOT be treated as event ownership.

3. Risk-based compatibility.
   - Terminal and processing-start events are dangerous.
   - Progress-only events can retain unique processing fallback.
   - Diagnostic events can remain visible without state mutation.

4. Reuse existing liveness machinery.
   - Extend quarantine/late-event checks.
   - Do not add a second lifecycle store.
   - Do not rewrite conversation assembly.

5. Codex-specific hardening must not become cross-engine regression.
   - Claude Code, Gemini, and OpenCode normalized semantics stay unchanged unless explicit tests demand shared helper behavior.

6. Stable render snapshots are conversation-scoped.
   - Same-thread deferred snapshots are performance tools.
   - Cross-thread deferred snapshots are stale owner data.
   - A tab switch must invalidate the previous thread's render/presentation snapshot immediately.

## Test-First Migration Strategy

### Phase 0: Behavior Lock Tests

These tests must pass on the current implementation and after the fix. They document existing useful behavior, not the bug.

- Codex explicit `runtime/ended` affected routing:
  - preserves `affectedThreadIds`, `affectedTurnIds`, `affectedActiveTurns`.
  - preserves shared-session native rebinding from native thread id to shared thread id.
- Codex single-session compatibility:
  - a single processing Codex thread can still receive a safe no-owner runtime/progress fallback.
  - legacy `token_count`, request-user-input, and reasoning compatibility remain attached when there is a safe unique owner.
- Claude Code compatibility:
  - `useAppServerEvents.batch-consumer.test.tsx` legacy single-channel agent delta and turn completion still route with batch flag on.
  - Claude normalized context usage and `turn/completed` semantics remain intact.
- Multi-engine compatibility:
  - `realtimeAdapters.test.ts` remains green for Codex/Claude/Gemini/OpenCode.
  - `realtimeEventBatcher.test.ts` remains lossless and engine-agnostic.
  - `realtimeHistoryParity.test.ts` remains aligned across realtime/history loaders.
- Provider/shared-session compatibility:
  - provider metadata preservation tests continue to pass.
  - `sharedSessionBridge.test.ts` uniqueness rules for pending native bindings remain valid.

Important: if an existing unit test asserts the unsafe implementation detail "active Codex thread is lifecycle owner", replace that assertion with a user-facing semantic lock before implementing the fix. Example: "unique processing Codex fallback settles the only live thread" is acceptable; "currently active thread is always the owner" is not.

### Phase 1: Pollution Regression Tests

These tests are expected to expose the bug before implementation and pass after the fix.

- Ambiguous terminal event:
  - two Codex threads are processing in one workspace.
  - `runtime/ended` has `hadActiveLease=true` or `pendingRequestCount>0`, but no affected owner fields.
  - active/visible thread MUST NOT receive `onTurnError`.
- Completed session revival:
  - Codex thread A completes turn `turn-a`.
  - Codex thread B remains processing.
  - late raw progress/start event with no owner MUST NOT mark A processing again.
- Ambiguous liveness progress:
  - progress-only no-owner event arrives while multiple Codex candidates exist.
  - no guessed thread receives liveness progress evidence.
- Same-provider provider runtime sharing:
  - two same-provider Codex conversations run concurrently.
  - fallback MUST NOT infer owner from provider profile or shared runtime alone.
- Multi-engine concurrent safety:
  - Claude thread and Codex thread run concurrently.
  - Codex ambiguous event cannot mutate Claude state, and Codex gate cannot suppress explicit Claude events.

### Phase 2: Ownership Resolver

Add a small helper module near app-server event handling, for example:

```ts
type CodexEventRisk =
  | "terminal"
  | "processing-start"
  | "progress-only"
  | "diagnostic-only";

type CodexEventOwnershipResolution =
  | {
      kind: "explicit";
      workspaceId: string;
      threadId: string;
      turnId: string | null;
      runtimeGeneration: string | null;
      source:
        | "payload"
        | "affected-thread"
        | "affected-active-turn"
        | "shared-native-binding";
    }
  | {
      kind: "boundedFallback";
      workspaceId: string;
      threadId: string;
      turnId: null;
      runtimeGeneration: null;
      source: "single-processing-codex-thread";
    }
  | {
      kind: "ambiguous";
      workspaceId: string;
      candidateThreadIds: string[];
      reason: string;
    }
  | {
      kind: "unresolved";
      workspaceId: string;
      reason: string;
    };
```

Input:

- method / params
- workspace id
- risk classification
- optional shared-session binding
- bounded fallback resolver supplied by `useThreads`

Output:

- resolution only; dispatch stays in `useAppServerEvents.ts`.

### Phase 3: Bounded Fallback Resolver

`useThreads.ts` should expose a resolver to app-server handlers, for example:

```ts
getSingleProcessingCodexThreadId(workspaceId: string): string | null
```

Rules:

- Read from refs, not render-time stale closures:
  - `threadsByWorkspaceRef.current`
  - `threadStatusByIdRef.current`
- Candidate must belong to workspace.
- Candidate must be Codex, including compatibility threads whose engine can be inferred as Codex.
- Candidate must currently be processing.
- Return a thread id only when candidate count is exactly one.
- Return `null` for zero or multiple candidates.

This is intentionally narrower than active-thread fallback. It says "there is only one live Codex owner candidate", not "the user is looking at this tab".

### Phase 4: Mutation Gate Integration

#### Terminal events

`runtime/ended`:

- Use explicit affected mapping first.
- Use shared-session native binding when affected native thread id maps to shared thread id.
- If no explicit owner and event is benign manual shutdown, keep current no-op behavior.
- If no explicit owner and event is not benign, allow bounded fallback only when exactly one processing Codex thread exists.
- If ambiguous/unresolved, emit diagnostics and do not call `onTurnError`.

`turn/error`, `turn/completed`, `turn/stalled`:

- Explicit thread id remains required.
- If future variants add no-owner terminal fallback, they must use the same resolver.

#### Processing-start events

`turn/started`:

- Keep explicit owner requirement.
- Shared-session pending binding rebinding remains supported.
- Do not add active-thread fallback.

Raw item/status events that can cause `markProcessing(true)`:

- Require explicit owner or verified successor.
- Do not revive settled/quarantined turn.

#### Progress-only events

`processing/heartbeat`, `token_count`, reasoning deltas, tool output, request-user-input, generated image events:

- Prefer explicit thread/turn owner.
- Allow bounded fallback only when exactly one processing Codex candidate exists.
- If the target turn is terminal/quarantined, skip mutation or record stale diagnostics.
- If no turn id exists, progress-only event may update non-terminal current thread only when owner is unique; it MUST NOT set processing true for a settled thread.

#### Diagnostic-only events

`codex/parseError` without explicit owner should not terminate active thread by guess. It can emit owner-resolution diagnostics. If explicit owner exists, preserve existing error behavior.

### Phase 5: Quarantine And Late-Event Reuse

Do not create a parallel liveness store. Instead:

- Extend existing `shouldSkipCodexTurnEvent` / terminal exact checks where raw events enter tracked handlers.
- Ensure raw/fallback events and normalized events share the same settled-turn semantics.
- Keep verified successor turn allowed:
  - old terminal turn remains quarantined.
  - new turn identity can process normally.

### Phase 6: Conversation Curtain Render Scope Guard

This phase addresses the reproduced tab-switch curtain contamination after lifecycle settlement is already correct.

Implementation shape:

- Build a stable `renderScopeKey` from `workspaceId + threadId` inside `Messages`.
- Wrap deferred candidates as `{ scopeKey, items }` before passing them through `useDeferredValue`.
- When `deferred.scopeKey !== current.scopeKey`, render current thread items immediately instead of reusing the old deferred snapshot.
- Pass scope metadata into `resolveStreamingPresentationItems`.
- In `resolveStreamingPresentationItems`, return current items directly on scope mismatch; only merge deferred snapshot and current live rows when both scopes match.

Validation shape:

- `Messages.streaming-presentation.test.tsx` must include a failed-before/pass-after tab-switch regression:
  - render thread A with stable presentation content.
  - switch to thread B while React deferred value still exposes A.
  - assert B's `MessagesTimeline` does not receive A grouped entries.
- `messagesLiveWindow.test.ts` must cover the pure helper contract:
  - scope mismatch returns current items.
  - scope match preserves same-thread stable snapshot behavior.
- Existing live behavior and Windows render mitigation tests must remain green.

### Phase 7: Background Codex Residue Reconciliation

This phase addresses the remaining low-frequency "content finished but sidebar/composer still running" case after owner gating and render snapshot scoping.

Failure model:

```text
Codex A and Codex B run in parallel
  -> A misses or drops an ownerless terminal event because owner cannot be proven
  -> B remains the active tab
  -> A's no-progress watchdog fires in the background
  -> foreground-only reconciliation skips A
  -> A keeps processing residue until user interaction or another terminal signal
```

Design:

- Treat no-progress reconciliation as a scoped status query for the inspected `workspaceId + threadId + turnId`.
- Do not require the inspected thread to be the active tab before asking backend for authoritative terminal status.
- Keep cleanup strict: backend response must match workspace, engine, thread, and turn scope; a newer active turn still rejects cleanup.
- Keep active UI selection out of lifecycle ownership. It is neither proof for mutation nor a reason to block scoped background cleanup.

Validation:

- Add a failed-before/pass-after test where active tab is B, background Codex A receives `runtime-ended` from scoped reconciliation, and A clears `isProcessing`.
- Preserve the existing running-status and newer-successor-turn rejection tests.

### Phase 8: Rejected Final Assistant Completion Grace Settlement

This phase records a rejected fix attempt. It tried to address the active-tab case where assistant content is visible, but Codex never delivers or delays `turn/completed` long enough for the UI to remain in `正在生成响应...`.

Failure model:

```text
Codex turn starts
  -> assistant message block completes and is visible
  -> turn/completed is missing or delayed
  -> frontend treats message completion as terminal evidence
  -> frontend settles the turn after a short grace timer
  -> later tool/explore events are cut off because the turn was prematurely quarantined
```

Design:

- `onAgentMessageCompleted` / normalized `completeAgentMessage` MUST be treated as message-block completion, not turn-terminal proof.
- Frontend MUST NOT create standalone terminal settlement timers from assistant message completion.
- Assistant completion may still record stream evidence, but MUST NOT flush an existing deferred `turn/completed` while active execution blockers remain.
- Missing terminal events should be handled through owner-gated `runtime/ended`, `turn/error`, `turn/stalled`, explicit `turn/completed`, or scoped backend reconciliation.
- If those terminal signals are absent, the root fix is backend owner/terminal payload enrichment, not frontend inference from message text.

Validation:

- Add failed-before/pass-after coverage where assistant message completion arrives without any terminal event; after the old grace window, processing must remain true and realtime terminal tracking must not be called.
- Add failed-before/pass-after coverage where assistant delta/completion and `turn/completed` have arrived but a child/tool blocker remains running; processing must stay deferred until the blocker becomes terminal or scoped reconciliation returns a matching terminal owner.
- Preserve background scoped reconciliation tests for real terminal backend status.

### Phase 9: Deferred Completion Scoped Reconciliation

This phase addresses the remaining stuck-loading case seen in three parallel Codex sessions: a turn has already emitted `turn/completed`, but frontend defers completion because an active child/tool blocker did not emit a terminal update.

Design:

- Keep assistant completion non-terminal.
- When `deferCodexTurnCompletionIfBlocked()` stores a deferred completion, immediately issue a scoped `query_turn_reconciliation_status` request for the same `workspaceId + threadId + turnId`.
- Reuse the existing `requestSource: "three-evidence-reconciliation"` wire value to avoid backend protocol expansion; distinguish this path with frontend diagnostic labels under `deferred-completion-reconciliation`.
- Flush the deferred completion with source `scoped-reconciliation-terminal` only when:
  - backend status is terminal (`completed`, `runtime-ended`, `failed`, or `stalled`);
  - response workspace/engine/thread/turn matches the deferred completion scope;
  - the current diagnostic still owns that same deferred completion;
  - no newer active turn has replaced the deferred turn.
- Keep deferred state when backend says `running` / `unknown` / `query-failed`, when scope mismatches, or when a newer active turn exists.

Validation:

- Add tests where scoped terminal status flushes a deferred completion despite stale running blockers.
- Add tests where scoped running status keeps the turn deferred.
- Add a three-parallel-Codex test proving only the matching deferred thread is cleared.

### Phase 10: Manual Reproduction Still Open

This phase records the 2026-06-20 post-implementation calibration. It is not a new frontend fix. It prevents the proposal from being archived under a false success claim.

Observed status:

- Automated contract coverage passes for owner gating, quarantine, deferred completion scoped reconciliation, and curtain scope guard.
- Manual 3-session Codex/Minimax parallel testing can still reproduce a conversation that appears content-complete but remains loading/running.

Interpretation:

- The frontend MUST NOT settle from assistant message completion to hide the symptom. That path already caused direct conversation cutoff.
- The current frontend implementation can only clear residue when it receives one of the accepted terminal authorities:
  - explicit `turn/completed`;
  - owner-gated `runtime/ended`, `turn/error`, or `turn/stalled`;
  - blocker terminal update after deferred completion;
  - scoped backend reconciliation terminal status for the same `workspaceId + threadId + turnId`.
- If production still gets stuck, the next investigation must distinguish:
  1. terminal authority never arrives at the frontend;
  2. scoped backend status returns `running` / `unknown` for a truly ended turn;
  3. terminal authority arrives but frontend cleanup guard rejects it due to scope / active turn / diagnostic mismatch.

Required evidence before the next code change:

- Capture diagnostic payloads for `deferred-completion-reconciliation-*`, `three-evidence-reconciliation-*`, `turn-completed-deferred`, and `quarantined-codex-event-skipped`.
- Capture the stuck thread's `workspaceId`, `threadId`, `turnId`, visible provider, active turn, and backend reconciliation response.
- Do not add another frontend inference path without a terminal-authority field or backend status proof.

## Compatibility Matrix

| Surface | Must Preserve | Guard |
|---|---|---|
| Codex single session | start/progress/end works; unique fallback can settle the only live thread | behavior lock tests |
| Codex parallel same provider | no active-thread or provider-runtime ownership guess | pollution regression |
| Codex parallel different provider | no global active provider inference | provider-scoped regression |
| Shared-session Codex | native thread rebinding and affected mapping still route to shared thread | runtime-ended tests |
| Claude Code single session | legacy/batch/normalized route unchanged | batch-consumer + contract tests |
| Claude + Codex concurrent | Codex ambiguous event cannot mutate Claude; explicit Claude events still route | multi-engine regression |
| Gemini/OpenCode | adapters/batcher/history parity unchanged | existing contract tests |
| Conversation curtain tab switch | deferred render/presentation snapshot cannot cross `workspaceId + threadId`; same-thread streaming stabilization remains | message presentation + live window tests |
| Background Codex residue | scoped no-progress reconciliation can clean non-active stuck Codex turns | `useThreadEventHandlers` reconciliation tests |
| Missing Codex `turn/completed` | assistant message completion alone cannot settle | `useThreadEventHandlers` assistant completion negative tests |
| Deferred Codex `turn/completed` | scoped backend terminal response may flush stale local blockers; running/unknown/mismatch cannot | `useThreadEventHandlers` deferred reconciliation tests |
| Manual 3-session stuck loading | still open; requires diagnostic evidence before next fix | not archive-ready |

## Risks And Mitigations

- Risk: active fallback removal breaks single-session cleanup.
  - Mitigation: replace with unique processing fallback and lock it with tests.
- Risk: progress-only events lose visible updates when owner context is missing.
  - Mitigation: allow bounded fallback only when exactly one Codex candidate exists; emit diagnostics otherwise.
- Risk: resolver becomes too generic and touches every engine.
  - Mitigation: Codex-specific helper first; multi-engine tests verify no regressions.
- Risk: existing tests assert old unsafe internals.
  - Mitigation: convert those tests to semantic behavior locks before implementation.
- Risk: backend still omits owner fields often.
  - Mitigation: frontend diagnostics will surface ambiguous/unresolved counts; backend enrichment remains a follow-up proposal.
- Risk: scoping deferred snapshots disables useful same-thread streaming stabilization.
  - Mitigation: scope guard only invalidates snapshots when `workspaceId + threadId` changes; same-thread tests lock existing stable snapshot behavior.
- Risk: background reconciliation clears a still-running conversation.
  - Mitigation: cleanup still depends on authoritative scoped backend terminal status and rejects running/unknown status or newer active turn mismatch.
- Risk: assistant message completion is mistaken for turn completion.
  - Mitigation: message completion cannot create terminal settlement and cannot flush blocked deferred completion; it only records content/stream evidence.
- Risk: missing `turn/completed` still leaves a real stuck-loading case.
  - Mitigation: keep scoped backend reconciliation and owner-gated terminal events; open backend owner/terminal payload enrichment if the runtime still omits terminal authority.
- Risk: automated tests create false confidence while manual parallel runtime still reproduces.
  - Mitigation: keep this change unarchived, document the open manual reproduction, and require diagnostic payloads before the next code change.

## Rollback Plan

- Integration should be staged by risk class:
  1. terminal `runtime/ended`
  2. processing-start
  3. progress-only
  4. diagnostic-only cleanup
- If progress-only gating causes compatibility issues, keep terminal protection enabled and temporarily narrow progress gating to the highest-risk fallback paths.
- The helper module can remain in tree while individual call sites are reverted because resolver returns decisions and does not own state.
- If curtain scope guard causes render regressions, revert only the `Messages` / `messagesLiveWindow` scope wrapper while keeping lifecycle owner resolver and quarantine changes intact.
- If background residue reconciliation causes false cleanup, restore foreground-only reconciliation while preserving owner gates, then require backend owner enrichment before retrying background cleanup.
- If assistant completion is again proposed as terminal fallback, reject it unless backend adds an explicit terminal-authority field that distinguishes message-block completion from turn completion.

## Open Questions

- Should owner-resolution diagnostics go only to `onDebug`, or also surface in runtime notice panels for user-visible stuck-loading investigations?
- Should backend add a follow-up guarantee that all lifecycle-sensitive events include `threadId`, `turnId`, and `runtimeGeneration`?
- Should `getActiveCodexThreadId` be renamed to make display-only intent unambiguous?
