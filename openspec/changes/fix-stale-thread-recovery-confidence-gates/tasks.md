## 1. Proposal Calibration

- [x] 1.1 Reclassify issue #604 as large-context blank-session recovery, not solely stale alias recovery.
- [x] 1.2 Correct stream mitigation wording: candidate profiles already participate in render resolution.
- [x] 1.3 Fix affected file paths for `streamLatencyDiagnostics.ts`.
- [x] 1.4 Add OpenSpec deltas so strict validation can parse this change.

## 2. Large-Context Blank Session Recovery

- [x] 2.1 Identify the exact blank-session boundary: history load failure, hydrate failure, render blanking, or fresh continuation.
- [x] 2.2 Add classified reopen outcomes: `recovered`, `degraded-readable`, `fresh-continuation`, `failed`.
- [x] 2.3 Preserve or recover last-good readable surface when large-context reopen fails.
- [x] 2.4 Ensure automatic `agentN` / fresh-session creation is visible and reason-coded.
- [x] 2.5 Add diagnostics for blank session, degraded history, and fresh continuation creation.

## 3. Stale Thread Recovery Confidence Gates

- [x] 3.1 Define `ThreadRecoveryDecision` and recovery reason codes.
- [x] 3.2 Extend replacement scoring with score gap, time coherence, source/provider consistency, and history boundary evidence.
- [x] 3.3 Gate `rememberThreadAlias(...)` behind high-confidence, non-ambiguous decisions.
- [x] 3.4 Keep low-confidence recovery as temporary/degraded/user-visible, not durable alias.
- [x] 3.5 Add alias rollback for later failed load or consistency mismatch.
- [x] 3.6 Add focused tests for low-confidence no-persist, ambiguous no-persist, verified persist, and rollback.

## 3A. Finalized Native Session Isolation

- [x] 3A.1 Reproduce `hnms-osp` Claude session structures through local daemon inspection instead of assuming parser failure.
- [x] 3A.2 Verify affected Claude JSONL files load successfully through `load_claude_session`.
- [x] 3A.3 Block `thread_session_id_updated` from renaming active finalized `claude:{old}` to `claude:{new}`.
- [x] 3A.4 Filter persisted `threadAliases` so finalized native sources (`claude:`, `gemini:`, `opencode:`) cannot canonicalize to another session.
- [x] 3A.5 Preserve pending-to-finalized binding (`claude-pending-* -> claude:{sessionId}`).
- [x] 3A.6 Add regression tests for active finalized mismatch and finalized native alias filtering.

## 3B. Catalog Partial/Pagination Boundary

- [x] 3B.1 Diagnose sidebar count mismatch where `partialSource=claude-scan-cap-reached` displayed “加载更早的...” without a real next page.
- [x] 3B.2 Stop converting catalog `partialSource` into a synthetic catalog cursor when `nextCursor` is null.
- [x] 3B.3 Preserve real catalog pagination when `nextCursor` is present.
- [x] 3B.4 Add regression tests for partial-without-cursor and real-cursor preservation.

## 3C. Active Sidebar Full-Catalog Fact Source

- [x] 3C.1 Diagnose Sidebar / Strict project session mismatch where active startup stayed on first-page while Strict catalog returned 200 active rows.
- [x] 3C.2 Return stale-discard metadata from `listThreadsForWorkspace` when latest-request guard drops a result.
- [x] 3C.3 Do not mark stale-discarded `full-catalog` hydration as fully hydrated.
- [x] 3C.4 Prioritize active workspace full-catalog hydration before unrelated idle prewarm.
- [x] 3C.5 Add hydration tests for active priority and stale full-catalog retry.
- [x] 3C.6 Remove active startup `first-page` Sidebar writes; startup active hydration now uses `full-catalog`.
- [x] 3C.7 Make active project `full-catalog` consume all catalog pages internally instead of returning the backend first-page cursor as Sidebar state.
- [x] 3C.8 Add regression coverage for multi-page active project catalog hydration.

## 3D. Manual Tracked Refresh Must Stay Full-Catalog

- [x] 3D.1 Diagnose follow-up Sidebar instability where direct `listThreadsForWorkspaceTracked(activeWorkspace)` downgraded manual/business refreshes to startup `first-page`.
- [x] 3D.2 Change untagged tracked refresh defaults to `on-demand` / `full-catalog`.
- [x] 3D.3 Keep startup active hydration explicitly stamped as `active-workspace` / `full-catalog`.
- [x] 3D.4 Add regression coverage for active workspace manual tracked refresh using `full-catalog`.

## 4. Windows Claude Stream Visibility Calibration

- [x] 4.1 Record candidate profile selection separately from active mitigation escalation.
- [x] 4.2 Add first-visible latency evidence and keep it separate from first-token delay.
- [x] 4.3 Treat `commandExecution` / tool output as non-text runtime progress so backend-visible work does not trigger false first-token pending.
- [x] 4.4 Parameterize the relevant thresholds through an approved config/debug path.
- [x] 4.5 Preserve existing non-Windows and non-Claude behavior.
- [x] 4.6 Add stream diagnostics tests for candidate selection, active escalation, no-text-delta first-token classification, and command-progress no-false-stall.

## 5. Validation

- [x] 5.1 Run `openspec validate fix-stale-thread-recovery-confidence-gates --strict --no-interactive` after spec deltas are added.
- [x] 5.2 Run focused frontend tests for thread recovery and stream diagnostics.
- [x] 5.3 Run finalized native isolation tests:
  - `npx vitest run src/features/threads/utils/threadStorage.test.ts src/features/threads/hooks/useThreadTurnEvents.test.tsx`
  - `npx vitest run src/features/threads/hooks/useThreadMessaging.test.tsx`
- [x] 5.4 Run `npm run typecheck`.
- [x] 5.5 Run catalog pagination tests:
  - `npx vitest run src/features/threads/hooks/useThreadActions.threadList.test.ts src/features/threads/hooks/useThreadActions.test.tsx`
- [x] 5.6 Run hydration convergence tests:
  - `npx vitest run src/app-shell-parts/useWorkspaceThreadListHydration.test.tsx src/app-shell-parts/workspaceThreadListLoadGuard.test.ts`
- [x] 5.7 Record Windows + Claude manual smoke qualifier for large-context reopen, command-progress waiting, slow visible text, Sidebar/Strict count alignment, and manual tracked refresh stability.
  - **Current status**: 2026-05-24 local manual QA on the maintainer machine is temporarily passing for the affected flows, but no Windows machine is available. Do not mark this as Windows-covered until a Windows dev build or external CI/manual evidence is recorded. Closeout note: `openspec/docs/session-management-refactor-closeout-2026-05-24.md`.
