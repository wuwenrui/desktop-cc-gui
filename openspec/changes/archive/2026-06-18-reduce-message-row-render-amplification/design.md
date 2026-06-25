## Context

Previous work (`reduce-streaming-reducer-commit-lag`) fixed two earlier bottlenecks:

- live assistant `appendAgentMessageDelta` now dispatches urgently after batch flush
- lightweight Codex Markdown streaming now reports current assistant visible text even when Markdown rendered callbacks lag

The user then hot-started the app and ran another streaming turn. The new runtime facts were:

- `turnTraceSummaryCount=0`
- `stream-latency/visible-output-stall-after-first-delta=0`
- `stream-latency/mitigation-activated=0`
- `firstVisibleTextAfterDeltaMs=103`
- `lastVisibleTextAfterDeltaMs`: p50 about 120ms, p90 about 154ms, max 191ms
- one `stream-latency/render-amplification`
- `lastRenderLagMs=4955` once
- `perf.messages.row-render-budget` had 711 entries
- old completed rows had high render counts during the live turn, e.g. user row 234, assistant rows 216/196/164

This shifts the next actionable bottleneck to row render amplification: unchanged history rows are still crossing render boundaries during live updates.

## Current Code Anchors

- `src/features/messages/components/MessagesRows.tsx`
  - `MessageRow` is wrapped in `memo(..., areMessageRowPropsEqual)`.
  - `areMessageItemsEqual` already compares semantic item fields instead of object identity.
  - `areMessageRowPropsEqual` also compares props such as `presentationProfile`, `streamMitigationProfile`, callbacks, copied state, retry message, and suppression flags.
  - each render emits content-safe `appendMessageRowRenderBudgetDiagnostic`.
- `src/features/messages/components/MessagesTimeline.tsx`
  - maps timeline entries to `MessageRow`.
  - passes live-only props such as `streamMitigationProfile` and `onAssistantVisibleTextRender` to every row.
- `src/features/messages/hooks/useFileLinkOpener.ts`
  - builds `openFileLink` / `showFileLinkMenu` callbacks from `openTargets`, `selectedOpenAppId`, `workspacePath`, and `onOpenWorkspaceFile`.
  - if parent settings recreate `openTargets` arrays during live updates, these callback identities can invalidate every completed `MessageRow` because file-link handlers are legitimate completed-row props.
- `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
  - passes runtime reconnect callbacks as inline async functions.
  - those callback identities can change during live updates, but ordinary message rows do not consume them unless `showRuntimeReconnectCard` is active.

## Design

### Step 1: Reproduce comparator miss with a focused test

Add a test that renders an unchanged completed row and a live assistant row, then rerenders only the live row text. The test should assert:

- completed row diagnostics count remains unchanged
- live row diagnostics increments
- copy/file/recovery props remain wired

The test should use real `MessageRow` / timeline code as much as possible and mock only heavy children such as Markdown if needed.

### Step 2: Identify the unstable prop

Inspect failing test output and `areMessageRowPropsEqual` inputs. Candidate causes:

- live-only props (`streamMitigationProfile`, `onAssistantVisibleTextRender`) passed to non-streaming rows
- parent callbacks recreated across live updates
- `presentationProfile` object identity drift
- retry / suppression data structures causing per-row changes

### Step 3: Apply the narrowest safe fix

Preferred fix order:

1. Normalize live-only props before they reach non-live rows in `MessagesTimeline`.
2. If parent normalization is insufficient, adjust `areMessageRowPropsEqual` so non-streaming rows ignore props that cannot affect their render.
3. Stabilize legitimate but globally shared callbacks at their hook boundary when they can safely read latest config through refs, e.g. `useFileLinkOpener`.
4. Narrow runtime reconnect callback comparison to rows where the reconnect card can render.
5. Avoid splitting `MessageRow` unless the first four options cannot express the contract safely.

### Step 4: Preserve diagnostics

Do not remove `appendMessageRowRenderBudgetDiagnostic`. The current diagnostic is content-safe and useful; the goal is to make it quiet through fewer renders, not by suppressing evidence.

## Risks / Trade-offs

- [Risk] Ignoring a prop in comparator may hide legitimate row updates.
  - Mitigation: only ignore live-only props for `isStreaming=false` rows, and keep tests for recovery/copy/file-link behavior.
- [Risk] Parent prop normalization may miss future live-only props.
  - Mitigation: add explicit spec language and tests around completed row stability during live updates.
- [Risk] Stable file-link handler identities might capture stale settings.
  - Mitigation: store latest file-link config in a ref and add a hook test proving handlers keep identity while actions use the latest open target.
- [Risk] Ignoring reconnect callbacks on ordinary rows might hide reconnect UI updates.
  - Mitigation: still compare reconnect callbacks, retry message, and reconnect state whenever either render has `showRuntimeReconnectCard=true`.
- [Risk] Render count tests can be brittle.
  - Mitigation: assert relative behavior through diagnostics calls keyed by item id, not exact whole-tree render counts.

## Rollback

Revert the row prop/comparator change and the focused regression test. Diagnostics remain available to confirm whether amplification returns.
