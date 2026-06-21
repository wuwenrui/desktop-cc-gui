## 1. Behavior Lock Tests Before Implementation

These tasks MUST happen before changing lifecycle routing. They protect existing correct behavior and prevent "fix one bug, break good paths".

- [x] 1.1 Lock Codex explicit `runtime/ended` routing in `src/features/app/hooks/useAppServerEvents.runtime-ended.test.tsx`.
  - Preserve affected thread/turn mapping.
  - Preserve `affectedActiveTurns` fallback.
  - Preserve shared-session native thread rebinding.
  - Expected current result: pass.
- [x] 1.2 Replace unsafe active-thread lifecycle assertion with semantic single-session fallback coverage.
  - Existing unsafe shape: no-owner `runtime/ended` uses `getActiveCodexThreadId`.
  - Desired semantic lock: exactly one processing Codex thread can still be settled by bounded fallback.
  - Expected current result: pass after test is expressed through current public behavior; after implementation it must pass through the new unique-processing resolver.
- [x] 1.3 Lock benign manual shutdown behavior.
  - `manual_shutdown` with no active lease, no pending request, and no affected owner context MUST remain non-mutating.
  - Expected current result: pass.
- [x] 1.4 Lock Codex normalized late-event non-revival in `src/features/threads/hooks/useThreads.integration.test.tsx`.
  - Preserve existing "does not revive processing from late normalized realtime updates after turn completion" behavior.
  - Expected current result: pass.
- [x] 1.5 Lock Claude Code single-channel and batch behavior.
  - Run or extend `src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`.
  - Preserve Claude agent delta and turn completion when batch flag is on.
  - Expected current result: pass.
- [x] 1.6 Lock multi-engine realtime compatibility.
  - Cover `src/features/threads/adapters/realtimeAdapters.test.ts`.
  - Cover `src/features/threads/contracts/realtimeEventBatcher.test.ts`.
  - Cover `src/features/threads/contracts/realtimeHistoryParity.test.ts`.
  - Expected current result: pass.
- [x] 1.7 Lock provider/shared-session compatibility.
  - Preserve provider metadata tests in thread reducer/helpers where applicable.
  - Preserve `src/features/shared-session/runtime/sharedSessionBridge.test.ts` unique pending binding behavior.
  - Expected current result: pass.

## 2. Pollution Regression Tests

These tests prove the bug. They MAY fail before implementation and MUST pass after implementation.

- [x] 2.1 Add ambiguous `runtime/ended` regression for parallel Codex sessions.
  - Two Codex threads are processing in the same workspace.
  - Event has active lease or pending request but no `affectedThreadIds`, `affectedTurnIds`, or `affectedActiveTurns`.
  - Assert active/visible Codex thread does not receive `onTurnError` by guess.
  - Priority: P0.
- [x] 2.2 Add completed-session revival regression for raw/fallback progress.
  - Codex thread A completes.
  - Codex thread B remains processing.
  - Late no-owner progress/start event arrives.
  - Assert A remains non-processing and old turn is not mutated.
  - Priority: P0.
- [x] 2.3 Add ambiguous progress-only regression.
  - Multiple Codex processing candidates exist.
  - No-owner `token_count`, reasoning, heartbeat-compatible, request-user-input, or equivalent progress event arrives.
  - Assert no guessed thread receives liveness progress evidence.
  - Priority: P0.
- [x] 2.4 Add same-provider Codex concurrency regression.
  - Two Codex threads share a provider profile/runtime.
  - No-owner lifecycle-sensitive event arrives.
  - Assert provider/runtime sharing alone does not select an owner.
  - Priority: P0.
- [x] 2.5 Add different-provider Codex concurrency regression.
  - Two Codex threads use different provider profiles.
  - No-owner event arrives while one provider/thread is active in UI.
  - Assert global active provider or active thread does not select an owner.
  - Priority: P1.
- [x] 2.6 Add Codex + Claude concurrent safety regression.
  - Claude and Codex threads run in parallel.
  - Codex ambiguous event cannot mutate Claude.
  - Explicit Claude event still routes normally.
  - Priority: P1.

## 3. Ownership Resolver

- [x] 3.1 Add a Codex event ownership helper for raw app-server events.
  - Input: workspace id, method, params, shared-session binding, risk classification, bounded fallback resolver.
  - Output: explicit / boundedFallback / ambiguous / unresolved.
  - Priority: P0.
- [x] 3.2 Add resolver unit tests.
  - explicit owner from payload.
  - explicit owner from `affectedActiveTurns`.
  - explicit shared native binding.
  - unique processing fallback.
  - ambiguous multiple candidates.
  - unresolved zero candidate.
  - Priority: P0.
- [x] 3.3 Implement event risk classification.
  - terminal: `runtime/ended`, `turn/error`, `turn/completed`, `turn/stalled`.
  - processing-start: `turn/started`, running/processing status, item start that can revive processing.
  - progress-only: heartbeat, token usage, reasoning, tool output, request-user-input, generated image progress.
  - diagnostic-only: no-owner parse/status/runtime diagnostics.
  - Priority: P0.
- [x] 3.4 Add bounded fallback resolver in `useThreads.ts`.
  - Reads `threadsByWorkspaceRef.current` and `threadStatusByIdRef.current`.
  - Returns exactly one processing Codex thread id in workspace or `null`.
  - Covers zero/one/multiple candidates.
  - Priority: P0.
- [x] 3.5 Re-document `getActiveCodexThreadId`.
  - It MUST NOT be used as lifecycle terminal, processing-start, or liveness mutation owner.
  - Keep only non-lifecycle compatibility paths if still needed.
  - Priority: P0.

## 4. Lifecycle Mutation Gate

- [x] 4.1 Route `runtime/ended` through ownership resolver.
  - Explicit affected mapping first.
  - Benign manual shutdown remains no-op.
  - Unique processing fallback allowed.
  - Ambiguous/unresolved records diagnostics only and does not call `onTurnError`.
  - Depends on: 3.1, 3.4.
- [x] 4.2 Preserve explicit shared-session native rebinding.
  - Affected native thread id still maps to shared thread id.
  - Pending unique shared binding remains supported for `thread/started`.
  - Ambiguous shared bindings remain non-mutating.
  - Depends on: 4.1.
- [x] 4.3 Gate processing-start mutation paths.
  - Keep `turn/started` explicit-owner requirement.
  - Ensure raw item/status paths cannot `markProcessing(true)` for a settled turn without verified successor identity.
  - Depends on: 3.1, 3.3.
- [x] 4.4 Gate progress-only fallback paths.
  - `token_count`, reasoning deltas, request-user-input, heartbeat-compatible progress, tool/generated-image progress.
  - Explicit owner preferred.
  - Unique processing fallback allowed only for non-terminal current thread.
  - Ambiguous/unresolved diagnostics only.
  - Depends on: 3.1, 3.4.
- [x] 4.5 Extend settled-turn quarantine semantics from normalized realtime to raw app-server fallback.
  - Reuse `shouldSkipCodexTurnEvent`, `isRealtimeTurnTerminalExact`, and existing quarantine diagnostics.
  - Do not add a second lifecycle store.
  - Depends on: 4.3, 4.4.
- [x] 4.6 Keep non-Codex engines outside Codex-specific gate.
  - Claude/Gemini/OpenCode explicit events continue through existing adapters/handlers.
  - Shared helper extraction must not change non-Codex lifecycle semantics without tests.
  - Depends on: 4.1-4.5.

## 5. Validation

- [x] 5.1 Run focused Codex app-server tests:
  - `npx vitest run src/features/app/hooks/useAppServerEvents.runtime-ended.test.tsx`
  - `npx vitest run src/features/app/hooks/useAppServerEvents.realtime-contract.test.tsx`
  - `npx vitest run src/features/app/hooks/useAppServerEvents.request-user-input.test.tsx`
  - `npx vitest run src/features/app/hooks/useAppServerEvents.tokenUsage.test.tsx`
- [x] 5.2 Run focused thread lifecycle tests:
  - `npx vitest run src/features/threads/hooks/useThreads.integration.test.tsx`
  - Any new ownership resolver helper test file.
- [x] 5.3 Run Claude/multi-engine regression tests:
  - `npx vitest run src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx`
  - `npx vitest run src/features/threads/adapters/realtimeAdapters.test.ts`
  - `npx vitest run src/features/threads/contracts/realtimeEventBatcher.test.ts src/features/threads/contracts/realtimeHistoryParity.test.ts`
- [x] 5.4 Run provider/shared-session focused tests affected by the implementation.
  - `npx vitest run src/features/shared-session/runtime/sharedSessionBridge.test.ts`
  - Provider metadata reducer/helper tests touched by the implementation.
- [x] 5.5 Run typecheck:
  - `npm run typecheck`
- [x] 5.6 Validate OpenSpec:
  - `openspec validate "fix-codex-parallel-runtime-ended-isolation" --type change --strict --no-interactive`

## 6. Follow-Up Boundaries

- [x] 6.1 If diagnostics show backend lifecycle events often lack owner context under concurrency, open a separate backend proposal to enrich lifecycle payloads with `threadId`, `turnId`, and `runtimeGeneration`.
- [x] 6.2 If Claude/Gemini/OpenCode later show the same active-selection fallback problem, open a separate cross-engine ownership proposal instead of broadening this Codex-focused fix silently.
- [x] 6.3 If progress-only compatibility becomes too strict, keep terminal/processing-start protection and narrow progress-only gating with additional measured evidence rather than reverting the whole resolver.

## 7. React Update-Depth Guard For Degraded Startup Recovery

- [x] 7.1 Prevent `useModels` active-workspace auto refresh from retrying forever after an empty or degraded `model/list` result.
  - Empty catalog, degraded catalog, and failed catalog attempt are all terminal auto-refresh attempts for the current workspace until an explicit refresh or workspace switch.
  - This fixes React #185 startup loops where runtime-ended/concurrent Codex state makes `model/list` return an empty fallback.
- [x] 7.2 Add `useModels` regression coverage for empty catalog and failed catalog attempts.
  - Assert automatic active-workspace refresh is issued once, not on every render.
- [x] 7.3 Add no-op guards for repeated thread-list loading/paging/cursor reducer updates.
  - Same-value writes return the existing reducer state reference to avoid startup restore amplification.

## 8. Turnless Late Event Revival Guard

- [x] 8.1 Add failed-before/pass-after coverage for turnless late raw Codex item updates.
  - A completed Codex turn is quarantined.
  - A subsequent raw `item/updated` snapshot carries `threadId` but no `turnId`.
  - Assert the snapshot does not enter item handlers and cannot revive `isProcessing`.
- [x] 8.2 Preserve newer active-turn compatibility.
  - If a newer Codex turn has started on the same thread, turnless compatibility snapshots still pass through that active owner.
- [x] 8.3 Extend `shouldSkipCodexTurnEvent` to quarantine turnless late Codex events only when there is no verified successor.
  - Skip when the active lifecycle turn is already quarantined.
  - Skip when the thread has a settled quarantined Codex turn and is no longer processing with no active successor.
  - Do not skip non-Codex events or active newer Codex turns.

## 9. Late Duplicate Turn-Start Revival Guard

- [x] 9.1 Add failed-before/pass-after coverage for duplicate Codex `turn/started` after terminal settlement.
  - A Codex turn starts, completes, and is quarantined.
  - The same `turn/started` event arrives late.
  - Assert `markProcessing(true)`, `setActiveTurnId(turnId)`, and realtime active-turn noting are not called again.
- [x] 9.2 Add parallel Codex isolation coverage for settled-turn duplicate start.
  - Codex thread A and B are both processing.
  - A completes while B remains processing.
  - A emits a late duplicate `turn/started`.
  - Assert A remains non-processing with no active turn, and B remains processing until its own terminal event.
- [x] 9.3 Narrow the processing-start guard to exact quarantined turn identity.
  - Same settled `threadId + turnId` is skipped.
  - A verified successor turn for the same thread still starts normally.
  - Non-Codex engines remain outside this Codex-specific quarantine.
- [x] 9.4 Run focused validation for the revival patch.
  - `npx vitest run src/features/threads/hooks/useThreadEventHandlers.test.ts`
  - `npx vitest run src/features/threads/hooks/useThreads.integration.test.tsx`
  - `npx vitest run src/features/threads/hooks/useThreadItemEvents.test.ts`
  - `npx vitest run src/features/app/hooks/useAppServerEvents.runtime-ended.test.tsx`
  - `npx vitest run src/features/app/hooks/useAppServerEvents.test.tsx`
  - `npm run typecheck`
  - `npm run lint`

## 10. Transition Lifecycle Mutation Guard

- [x] 10.1 Keep Codex normalized realtime lifecycle mutations outside React transition scheduling.
  - `markProcessing(true)` for non-terminal normalized realtime events runs before `scheduleRealtimeDispatch`.
  - Transitioned content dispatches still re-check terminal quarantine before reducer mutation.
  - Queued transition callbacks MUST NOT call `markProcessing(true)` again after terminal settlement.
- [x] 10.2 Add focused regression coverage.
  - A transitioned normalized realtime event marks processing immediately.
  - If the turn is marked terminal before the queued callback runs, the callback does not revive processing and does not dispatch stale content.
  - If the turn remains active, the queued callback dispatches content without a second processing mark.

## 11. Same-Tick Owner Fallback Guard

- [x] 11.1 Add a synchronous Codex processing owner registry for fallback routing.
  - Owner fallback MUST NOT depend only on React state refs refreshed by `useEffect`.
  - `onThreadStarted` records workspace/thread ownership synchronously.
  - `markProcessing(true/false)` updates the Codex processing owner registry synchronously.
- [x] 11.2 Add same-tick regression coverage.
  - A Codex thread that starts and is queried for fallback owner in the same React `act` tick MUST be visible as the unique processing owner.
  - This protects `turn/started -> ownerless terminal/progress` batches from missing the new owner before post-render ref sync.
- [x] 11.3 Enforce event risk policy in the ownership resolver.
  - `diagnostic-only` events require explicit owner context and cannot consume bounded fallback.
  - `codex/parseError` is classified as terminal because it may settle a turn.
  - `codex/raw` generated-image compatibility is classified as progress-only, preserving unique-processing fallback without using active UI selection.

## 12. Turnless Terminal Quarantine Guard

- [x] 12.1 Add failed-before/pass-after coverage for terminal events that lack `turnId`.
  - A Codex turn starts and produces a final assistant answer.
  - A terminal error/runtime-ended style settlement arrives with `turnId=""`.
  - A later turnless raw `item/updated` snapshot for the same thread arrives.
  - Assert the thread remains non-processing and the final answer is not mutated by the late snapshot.
- [x] 12.2 Resolve empty terminal `turnId` to the current active lifecycle turn before terminal mutation.
  - `turn/completed`, `turn/error`, and `turn/stalled` tracked handlers use the incoming `turnId` when present.
  - If incoming `turnId` is absent, they use the thread lifecycle active turn or diagnostic turn as the settlement identity.
  - The resolved identity is passed to realtime terminal tracking, Codex settled-turn quarantine, and downstream settlement handlers.

## 13. Conversation Curtain Thread-Scope Render Guard

- [x] 13.1 Add failed-before/pass-after coverage for tab switching between parallel Codex conversations.
  - A Codex conversation A owns a stable deferred presentation snapshot.
  - The user switches to Codex conversation B while B is still processing.
  - Assert `MessagesTimeline` for B never receives A's grouped entries or final text.
- [x] 13.2 Scope deferred render and presentation snapshots by `workspaceId + threadId`.
  - `Messages` wraps deferred `renderSourceItems` and `presentationRenderedItems` with a render scope key.
  - If the deferred snapshot scope differs from the current conversation scope, the current items are used immediately.
  - Same-thread streaming still preserves stable parent snapshot behavior.
- [x] 13.3 Add pure helper coverage for cross-thread presentation snapshot mismatch.
  - `resolveStreamingPresentationItems` keeps same-thread stable snapshot behavior.
  - When deferred/current scope keys differ, it returns current items instead of appending B live items to A history.

## 14. Background Codex Residue Reconciliation Guard

- [x] 14.1 Add failed-before/pass-after coverage for background Codex busy residue cleanup.
  - Active tab points to conversation B.
  - Background Codex conversation A reaches no-progress watchdog and scoped backend reconciliation returns `runtime-ended`.
  - Assert A clears `isProcessing` and active turn state without requiring A to be the active tab.
- [x] 14.2 Relax three-evidence reconciliation foreground coupling.
  - Reconciliation is scoped to the inspected `workspaceId + threadId + turnId`, not to current visible tab.
  - Cleanup still requires backend response to match workspace, engine, thread, and turn scope.
  - Active UI selection remains display/navigation state, not lifecycle owner proof.

## 15. Assistant Message Completion Is Not Terminal Guard

- [x] 15.1 Add failed-before/pass-after coverage for Codex assistant message completion without terminal event.
  - A Codex turn starts and receives `onAgentMessageCompleted`.
  - No `turn/completed`, `turn/error`, `turn/stalled`, `runtime-ended`, or scoped reconciliation terminal status arrives.
  - Assert the frontend does not clear `isProcessing`, does not clear active turn state, and does not mark the realtime turn terminal.
- [x] 15.2 Remove the final-assistant grace settlement path.
  - Assistant message completion remains content/stream evidence only.
  - It MUST NOT flush an already-deferred `turn/completed` while active child/tool blockers remain.
  - It MUST NOT create a standalone timer that settles a Codex turn.
- [x] 15.3 Preserve hardening paths that still have terminal authority.
  - `turn/completed`, `runtime/ended`, `turn/error`, `turn/stalled`, settled-turn quarantine, and scoped backend reconciliation remain active.
  - Deferred `turn/completed` only flushes after blockers become terminal or scoped reconciliation returns a matching terminal owner.
  - The fix only reverts the unsafe assumption that message block completion equals turn completion.
- [x] 15.4 Sync proposal and code-spec documentation with the corrected authority model.
  - `proposal.md` records the post-fix calibration that assistant completion is content evidence only.
  - `design.md` risk/compatibility rows reject assistant-driven deferred flush.
  - `.trellis/spec/frontend/parallel-conversation-runtime-residuals.md` records the executable terminal authority matrix.

## 16. Deferred Completion Scoped Reconciliation

- [x] 16.1 Add failed-before/pass-after coverage for stale blocker deferred completion.
  - A Codex turn starts, an execution child/tool item remains running, and `turn/completed` arrives.
  - The frontend defers completion because local blockers are still active.
  - A scoped backend status query for the same `workspaceId + threadId + turnId` returns terminal.
  - Assert the deferred completion flushes and loading clears.
- [x] 16.2 Preserve conservative behavior for non-terminal or mismatched status.
  - `running` / `unknown` / query failure must keep the turn deferred.
  - Response workspace/engine/thread/turn mismatch must not clear loading.
  - A newer active turn must block late deferred-completion cleanup.
- [x] 16.3 Cover three parallel Codex sessions.
  - A/B/C are running.
  - Only A has deferred `turn/completed`.
  - A's scoped terminal response clears A only; B/C remain untouched.
- [x] 16.4 Keep backend wire contract unchanged.
  - Reuse `query_turn_reconciliation_status`.
  - Keep `requestSource: "three-evidence-reconciliation"`.
  - Use frontend diagnostics to distinguish `deferred-completion-reconciliation`.

## 17. Manual Runtime Reproduction Follow-Up

- [ ] 17.1 Capture diagnostic payloads from a real stuck 3-session Codex/Minimax parallel run.
  - Required labels:
    - `deferred-completion-reconciliation-query-requested`
    - `deferred-completion-reconciliation-query-resolved`
    - `deferred-completion-reconciliation-cleanup-skipped`
    - `three-evidence-reconciliation-cleanup-applied`
    - `three-evidence-reconciliation-cleanup-skipped`
    - `quarantined-codex-event-skipped`
    - `turn-completed-deferred`
  - Record `workspaceId`, `threadId`, `turnId`, provider label, active tab, active turn, and visible sidebar/composer state.
- [ ] 17.2 Determine the remaining failure class from evidence.
  - Class A: terminal authority never arrives at frontend.
  - Class B: backend status query reports `running` / `unknown` after the runtime is visibly ended.
  - Class C: terminal authority arrives but frontend rejects cleanup because of scope, active-turn, or diagnostic mismatch.
- [ ] 17.3 Open or continue the next fix only after 17.2 is known.
  - Do not reintroduce assistant-message-completion settlement.
  - Do not add active-tab fallback for lifecycle mutation.
  - If Class A/B is confirmed, prefer backend owner/terminal payload enrichment over more frontend inference.

## Archive decision 2026-06-21

- Code evidence reviewed for archive:
  - `src/features/app/hooks/codexEventOwnership.ts` classifies Codex event risk and resolves ownership only from explicit owner context or a unique processing Codex fallback.
  - `src/features/app/hooks/useAppServerEvents.ts` routes `runtime/ended` through explicit payload owner, `affectedThreadIds`, `affectedActiveTurns`, shared-session native binding, or unique-processing fallback; active thread selection is not used for lifecycle ownership.
  - `src/features/threads/hooks/useThreads.ts` records same-tick Codex processing owners before post-render ref synchronization.
  - `src/features/threads/hooks/useThreadEventHandlers.ts` quarantines settled Codex turns, blocks late turnless/duplicate events from reviving processing, preserves assistant-message-completion as non-terminal evidence, and flushes deferred completion only through scoped backend terminal reconciliation.
- Automated validation run for archive:
  - `npx vitest run src/features/app/hooks/codexEventOwnership.test.ts src/features/app/hooks/useAppServerEvents.runtime-ended.test.tsx src/features/threads/hooks/useThreads.integration.test.tsx src/features/threads/hooks/useThreadEventHandlers.test.ts` passed with 97 tests.
- Manual runtime caveat:
  - 17.1-17.3 remain intentionally unchecked because no live stuck 3-session Codex/Minimax reproduction payload was available in this session.
  - These follow-up items are diagnostic discovery for a possible next failure class, not required implementation for the current owner-gating fix.
  - Archive proceeds with this caveat; if the live 3-session failure recurs, open a new backend owner/terminal-payload enrichment change rather than weakening frontend ownership gates.
