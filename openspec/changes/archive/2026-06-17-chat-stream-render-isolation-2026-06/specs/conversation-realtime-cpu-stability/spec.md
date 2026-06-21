# conversation-realtime-cpu-stability Specification (Delta)

## Purpose

TBD - extended by chat-stream-render-isolation-2026-06. Update Purpose after archive.

## ADDED Requirements

### Requirement: Reducer Fast Path MUST Cover Streaming Completion And Upsert

The thread reducer MUST apply the same incremental derivation guard to `completeAgentMessage` and `upsertItem` as it does to the existing 5 guarded cases (`appendAgentDelta` / `appendReasoningSummary` / `appendReasoningSummaryBoundary` / `appendReasoningContent` / `appendToolOutput`). When `INCREMENTAL_DERIVATION_ENABLED` is true and the merged item is reference-equal to the existing one, the reducer MUST return the prior state object reference.

> Note (review pass 2026-06-16):`appendAgentDelta` already has this guard in `useThreadsReducer.ts:1068-1072`; this requirement covers the remaining streaming cases only.

#### Scenario: equivalent assistant completion returns prior state reference

- **WHEN** a `completeAgentMessage` action arrives with text that, when merged into the existing assistant item via `mergeCompletedAgentText`, produces an item that is reference-equal to the existing item
- **THEN** the reducer MUST return the prior `state` object reference
- **AND** the reducer MUST NOT invoke `prepareThreadItems` on the thread items array
- **AND** the `prepareThreadItemsCallCount` counter MUST NOT increment for that action

#### Scenario: non-equivalent assistant completion still updates state

- **WHEN** a `completeAgentMessage` action arrives with text that changes the existing assistant item
- **THEN** the reducer MUST return a new state with the updated `itemsByThread[threadId]`
- **AND** the reducer MUST invoke `fastPathForAppendAgentDelta` (or equivalent helper) to produce the new array
- **AND** downstream `useThreadSelectors` consumers MUST observe the updated items

#### Scenario: assistant upsert fast path

- **WHEN** a `upsertItem` action arrives for an item whose merged form is reference-equal to the existing item
- **THEN** the reducer MUST return the prior `state` object reference
- **AND** the reducer MUST NOT invoke `prepareThreadItems`
- **AND** `prepareThreadItemsCallCount` MUST NOT increment

### Requirement: Workspace-Scoped In-Flight Refs MUST Cleanup On Eviction

All thread-scoped in-flight refs (`pendingMemoryCaptureRef` / `pendingAssistantCompletionRef` / `recentThreadErrorsRef` / `pendingInterruptsRef` / `interruptedThreadsRef` / `handledClaudeExitPlanToolIdsRef`) MUST be keyed by `(workspaceId, threadId)`. The LRU eviction path MUST remove entries for evicted threads and MUST emit a `chat-stream/evict-thread` renderer diagnostic.

> Note (review pass 2026-06-16):Only the 6 core refs in this list are in scope; 5 additional `Record<string, T>` refs (`loadedThreadLastRefreshAtRef` / `historyLoadingThreadByWorkspaceRef` / `codexCompactionInFlightByThreadRef` / `sharedSessionLastSignatureByThreadRef` / `sharedSessionSyncTimerByThreadRef`) are follow-up 11.6.

#### Scenario: workspace-scoped ref stores entries per thread

- **WHEN** any of the 6 in-flight refs receives a write for `(workspaceId, threadId)`
- **THEN** the entry MUST be stored under `ref[workspaceId][threadId]`
- **AND** writes for a different `(workspaceId, threadId)` MUST NOT collide

#### Scenario: LRU eviction removes workspace-scoped entries

- **WHEN** the LRU eviction path evicts `threadId` from `loadedThreadsRef`
- **THEN** `cleanupThreadScopedRefs(workspaceId, threadId)` MUST be invoked BEFORE `dispatch({ type: "evictThreadItems" })`
- **AND** all 6 workspace-scoped refs MUST have their `(workspaceId, threadId)` entry removed
- **AND** `cleanupThreadTransientState(workspaceId, threadId)` MUST clean `turnDiagnosticsRef` / `quarantinedCodexTurnsRef` / `assistantSnapshotIngressLengthRef`
- **AND** `appendRendererDiagnostic("chat-stream/evict-thread", { workspaceId, threadId, evictedCount, cleanedRefCount })` MUST be invoked

#### Scenario: orphan ref detection after eviction

- **WHEN** an LRU eviction completes
- **THEN** `pendingMemoryCaptureRef[workspaceId]?.[threadId]` MUST be undefined
- **AND** `turnDiagnosticsRef.current.get(threadId)` MUST be undefined
- **AND** `quarantinedCodexTurnsRef.current.has(key)` MUST be false
- **AND** the test gate `S-CHAT-103/workspaceScopedRefEvictions` MUST report `0`

### Requirement: Streaming Timeline MUST Stay Virtualized

The `MessagesTimeline` virtualizer MUST remain enabled during streaming when `TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED` is true. The `shouldVirtualizeTimelineRows` gate MUST NOT short-circuit on `isThinking === true` for `rowCount >= 200`.

> Note (review pass 2026-06-16):`hasHighRenderDensity` short-circuit at `messagesTimelineVirtualization.ts:13-16` (renderWeight >= 96 AND renderWeight > rowCount * 2) MUST be preserved; this requirement only removes the `!isThinking` guard on the main branch.

#### Scenario: long conversation virtualizes during streaming

- **WHEN** `timelineProjectionRows.length >= 200` and `isThinking === true`
- **THEN** `shouldVirtualizeTimelineRows` MUST return `true`
- **AND** `useVirtualizer` MUST report `enabled: true` with `count: timelineProjectionRows.length`
- **AND** `data-timeline-virtualized="true"` MUST be present on the rendered `messages-full` element
- **AND** the rendered DOM MUST contain at most `overscan * 2 + 1` row nodes (24 * 2 + 1 = 49 for streaming overscan)

#### Scenario: virtualizer stability guard remains active

- **WHEN** streaming virtualizer is enabled and `classifyTimelineVirtualizerStability` reports `active-live-row-missing`
- **THEN** the existing bounded remeasure (cooldown 750ms) MUST trigger
- **AND** the diagnostic cooldown MUST NOT spam (5s throttle preserved)

### Requirement: Streaming Complexity Cache MUST Use Delta Scan

The streaming markdown complexity analyzer MUST expose a delta helper `analyzeStreamingMarkdownComplexityDelta(prev, prevText, deltaText)` that returns `prev` for empty `deltaText` and incrementally computes complexity for non-empty `deltaText`. The `MessageRow` component MUST use the delta helper in place of the full scan for streaming assistant messages.

> Note (review pass 2026-06-16):5 edge cases MUST be covered — empty delta, length jump, inside fence, cross multi-line, Chinese text.

#### Scenario: empty delta returns prev

- **WHEN** `analyzeStreamingMarkdownComplexityDelta(prev, prevText, "")` is called
- **THEN** the function MUST return `prev` reference (no allocation)
- **AND** `analyzeStreamingMarkdownComplexityCallCount` MUST NOT increment

#### Scenario: length jump increments call count once

- **WHEN** `analyzeStreamingMarkdownComplexityDelta(prev, prevText, deltaText)` is called with `deltaText.length > 0`
- **THEN** the function MUST return a new complexity object
- **AND** `analyzeStreamingMarkdownComplexityCallCount` MUST increment by 1 (not by `deltaText.length`)

#### Scenario: inside fence state preserved across delta

- **WHEN** `prev` has `insideCodeFence === true` and `deltaText` continues inside the fence
- **THEN** the returned complexity MUST count `fencedCodeLineCount` correctly
- **AND** the function MUST NOT close the fence prematurely

#### Scenario: cross multi-line delta

- **WHEN** `deltaText` contains 2+ newlines
- **THEN** the returned complexity MUST count `lineCount` correctly
- **AND** heading / list-item / fence boundaries MUST be detected across the multi-line delta

#### Scenario: Chinese text delta

- **WHEN** `deltaText` contains Chinese characters and mixed punctuation
- **THEN** the returned complexity MUST count `lineCount` correctly
- **AND** no character corruption MUST occur in `trimmedText`

### Requirement: App Server Event Subscription MUST Remain Stable Across Handler Object Changes

The `useAppServerEvents` hook MUST keep its existing `useAppServerEvents(handlers, options)` public signature. It MUST use the latest `handlers` callbacks without re-subscribing the underlying app-server event channel when the `handlers` object identity changes across renders.

> Note (review pass 2026-06-16):Current code already uses `handlersRef.current` inside a subscription effect with empty dependencies. The earlier multi-handlers proposal was unnecessary public API churn and is explicitly out of scope for this change.

#### Scenario: handler identity change does not resubscribe

- **WHEN** `useAppServerEvents(handlersA, options)` is mounted and the component rerenders with a different `handlersB` object reference
- **THEN** the underlying `subscribeAppServerEvents` registration MUST remain registered exactly once
- **AND** the next event MUST dispatch through `handlersB`
- **AND** unmount MUST unsubscribe exactly once

#### Scenario: multi-handlers public shape is not introduced

- **WHEN** this change is implemented
- **THEN** `useAppServerEvents` MUST NOT require or document a `{ turnLifecycle, itemStream, runtimeEvent, approvalFlow }` public shape
- **AND** existing single-handlers callers MUST require no migration

### Requirement: LRU Item Cache Cap MUST Be Adaptive To In-Flight Count

`THREAD_ITEM_CACHE_MAX` MUST be computed as `Math.max(12, inFlightCount * 2 + 6)`, where `inFlightCount` is the number of threads with `isProcessing === true` in `state.threadStatusById`. The 0 in-flight case MUST remain 12 (backward compatible).

#### Scenario: zero in-flight threads preserves 12 cap

- **WHEN** `inFlightCount === 0`
- **THEN** `computeThreadItemCacheMax(0)` MUST return `12`
- **AND** the LRU eviction behavior MUST match the pre-change constant

#### Scenario: high in-flight count expands cap

- **WHEN** `inFlightCount === 8` (e.g. 4 codex sandbox + 4 claude worktree)
- **THEN** `computeThreadItemCacheMax(8)` MUST return `22`
- **AND** the LRU eviction MUST retain at least 22 loaded threads
- **AND** no in-flight thread MUST be evicted

### Requirement: Transient RAF / Timer Refs MUST Cleanup On Thread Switch

The 7 transient RAF / timer refs in `Messages.tsx` (`scrollThrottleRef` / `assistantFinalizingTimerRef` / `anchorUpdateRafRef` / `historyStickyUpdateRafRef` / `copyTimeoutRef` / `planPanelFocusRafRef` / `planPanelFocusTimeoutRef`) MUST be cleared when the active thread changes inside the mounted `Messages` surface. The cleanup MUST be owned by `Messages`, because those refs are local to `Messages`.

> Note (review pass 2026-06-16):This requirement implements Option C from `design.md §6.7` (Messages-internal cleanup). The `previousActiveThreadIdRef` variant is rejected because `ref.current` changes do not trigger React renders/effects.

#### Scenario: thread switch clears previous thread timers

- **WHEN** `setActiveThreadId(threadIdB)` is called while `threadIdA` is active
- **THEN** the mounted `Messages` component MUST observe its active thread prop changing from `threadIdA` to `threadIdB`
- **AND** its local cleanup helper MUST clear all 7 RAF/timer refs for `threadIdA` (`ref.current === null` or timer cleared)
- **AND** `appendRendererDiagnostic("chat-stream/transient-timer-cleanup", { threadId: threadIdA, cleanedCount: 7 })` MUST be invoked

#### Scenario: no useThreads timer registry

- **WHEN** this change is implemented
- **THEN** `useThreads` MUST NOT expose `registerTransientTimer` or `previousActiveThreadIdRef` for `Messages` timer cleanup
- **AND** inactive thread eviction timer ownership MUST remain out of scope unless a separate runtime ownership design is added

### Requirement: In-Flight Refs MUST Honor 30-Minute TTL

`turnDiagnosticsRef` / `quarantinedCodexTurnsRef` / `assistantSnapshotIngressLengthRef` MUST support cleanup of stale settled entries. A periodic cleanup sweep MUST run on a 60-second interval, hosted in `useThreadEventHandlers.ts`, because that hook owns these refs.

> Note (review pass 2026-06-16):`CodexQuarantinedTurn` has `settledAt`; `TurnDiagnosticState` does not. For `turnDiagnosticsRef`, settled timestamp MUST be derived from `completedAt ?? errorAt ?? assistantCompletedAt`. `assistantSnapshotIngressLengthRef` has no timestamp and MUST be cleaned by thread-prefix when its corresponding thread diagnostic is removed or by explicit thread cleanup.

#### Scenario: 30-minute stale entry cleanup

- **WHEN** an entry in `turnDiagnosticsRef` has `completedAt`, `errorAt`, or `assistantCompletedAt` older than 30 minutes
- **THEN** the periodic cleanup sweep MUST remove the entry
- **AND** the cleanup MUST remove matching `assistantSnapshotIngressLengthRef` entries with keys prefixed by `${threadId}\0`
- **AND** the cleanup MUST NOT remove entries with a settled timestamp newer than 30 minutes
- **AND** the test gate `S-CHAT-103/workspaceScopedRefEvictions` MUST continue to report `0` orphans

#### Scenario: in-flight entry is not cleaned up

- **WHEN** an entry in `turnDiagnosticsRef` has no `completedAt`, `errorAt`, or `assistantCompletedAt` (active turn)
- **THEN** the periodic cleanup MUST NOT remove the entry
- **AND** the entry MUST remain until the turn terminates

### Requirement: Codex/Claude/Gemini/Opencode Parallel Sessions MUST Not Cross-Contaminate

The 4 engine isolation paths MUST remain intact and not cross-contaminate under parallel streaming:

> New requirement added by review pass 2026-06-16 to clarify the engine isolation contract. Codex and Claude code threads use `isClaudeSessionBootstrapThreadId` (`claudeForkThread.ts`); Claude / Gemini / Opencode use `${engine}-pending-` prefix (`threadPendingResolution.ts:18`).

- **codex** threads: identified by `isClaudeSessionBootstrapThreadId(threadId)` from `claudeForkThread.ts`
- **claude** threads: identified by `claude-pending-` prefix in `isPendingThreadForEngine("claude", threadId)`
- **gemini** threads: identified by `gemini-pending-` prefix in `isPendingThreadForEngine("gemini", threadId)`
- **opencode** threads: identified by `opencode-pending-` prefix in `isPendingThreadForEngine("opencode", threadId)`

> Note (review pass 2026-06-16):There is **no `codex-pending-` prefix** in the codebase. The original proposal's evidence point citing `codex-pending-` was incorrect; this requirement reflects the actual isolation mechanism.

#### Scenario: 4 engines parallel streaming do not cross-contaminate

- **WHEN** a codex thread and a claude thread stream in parallel
- **THEN** codex's `turnDiagnosticsRef.get(codexThreadId)` MUST NOT contain claude's entries
- **AND** claude's `pendingInterruptsRef[claudeWorkspaceId]` MUST NOT contain codex threadIds
- **AND** `isClaudeSessionBootstrapThreadId` MUST continue to identify codex threads correctly
- **AND** `claude-pending-` / `gemini-pending-` / `opencode-pending-` prefixes MUST continue to identify their respective engine threads

#### Scenario: workspace-scope ref does not collide across workspaces

- **WHEN** `pendingMemoryCaptureRef` is written for `(workspaceA, threadA)` and `(workspaceB, threadA)`
- **THEN** both entries MUST coexist
- **AND** eviction of `threadA` from `workspaceA` MUST NOT affect `workspaceB`'s entry

### Requirement: Chat Stream Budgets MUST Be Enforced

`runtime-performance-evidence-gates` MUST expose 5 `chat.stream.*` budgets in `docs/perf/baseline.json`. The `target` and `hard fail` values for `S-CHAT-100/longConversationFrameP95` MUST be derived from a measured baseline (`baseline * 0.7` and `baseline * 1.4` respectively) — they MUST NOT be hardcoded.

> Note (review pass 2026-06-16):The 16ms / 32ms numbers in earlier drafts were guesses. The baseline measurement (`S-RS-VL2/visibleTextLagP95Streaming`, evidence `proxy`, 500 row + 2 thread parallel streaming 5min) is a prerequisite for sub-task 6.1.

- `S-CHAT-100/longConversationFrameP95`: target `<= baseline × 0.7`, hard fail `> baseline × 1.4`
- `S-CHAT-101/reducerFastPathHitRate`: target `>= 0.85`, hard fail `< 0.6`
- `S-CHAT-102/virtualizerActiveDuringStreaming`: target `true`, hard fail `false`
- `S-CHAT-103/workspaceScopedRefEvictions`: target `0`, hard fail `> 0`
- `S-CHAT-104/transientTimerCleanups`: target `100%`, hard fail `< 100%`

#### Scenario: long conversation frame P95 reported

- **WHEN** `npm run perf:realtime:boundary-guard` runs with a 500-row streaming fixture
- **THEN** `S-CHAT-100/longConversationFrameP95` MUST report a measured value
- **AND** the value MUST be `<= baseline × 0.7` for the fixture
- **AND** the evidence class MUST be `proxy` initially, `measured` after Tauri/WebView collection

#### Scenario: reducer fast path hit rate reported

- **WHEN** 100 assistant text deltas flow through the reducer
- **THEN** `S-CHAT-101/reducerFastPathHitRate` MUST report the fraction that returned prior state reference
- **AND** the value MUST be `>= 0.85` for typical streaming patterns

#### Scenario: budget violations are surfaced

- **WHEN** a budget hard fail is exceeded (e.g. `S-CHAT-102` returns `false`)
- **THEN** `npm run check:runtime-evidence-gates` MUST fail
- **AND** the failure message MUST identify which budget hard-failed
