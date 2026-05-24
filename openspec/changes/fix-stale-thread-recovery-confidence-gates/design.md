## Context

This design calibrates the proposal against the issue text and current code facts.

The issue evidence currently available from the public GitHub page is:

- Windows 11;
- large context usage;
- conversation canvas becomes blank while work may still be running;
- after app restart, opening the same session remains blank;
- the app may automatically create new `agent2` / `agent3` sessions;
- another tool can still read the session progress.

The code evidence is separate:

- `useThreadActions.ts` catches `thread not found`, searches replacement candidates, hydrates the replacement, and calls `rememberThreadAlias(...)`.
- `threadStorage.ts` persists and canonicalizes thread aliases.
- `streamLatencyDiagnostics.ts` already has both `candidateMitigationProfile` and `mitigationProfile`, and the render path can consume candidate profiles.

Additional 2026-05-24 field calibration from local `hnms-osp` data:

- the affected Claude JSONL files loaded successfully through the daemon `load_claude_session` path;
- the session catalog returned separate `claude:{sessionId}` rows for the affected conversations;
- the reproducible corruption path was not a backend parse failure, but a frontend identity violation where an active finalized thread could be renamed after receiving a different `sessionId`;
- once that rename was persisted as a thread alias, future selection canonicalized old sessions into the new one, causing apparent flashing or only one session opening correctly.
- a separate sidebar count mismatch came from treating catalog `partialSource` as a pagination cursor. `partialSource=claude-scan-cap-reached` means degraded scan confidence, while `nextCursor=null` means there is no next page to load.

The design therefore avoids claiming one proven root cause. It defines layered guards that address the observed symptom and the most plausible recovery risks.

## Design Goals

- Keep old session state explainable when large-context reopen fails.
- Prevent unverified fresh continuation from looking like successful recovery.
- Persist stale-thread aliases only after high-confidence verification.
- Make Windows Claude stream visibility diagnostics earlier and less ambiguous.
- Preserve existing manual recovery and first-turn draft replacement contracts.

## 1. Large-context blank-session guard

### 1.1 Readable-state priority

Session reopen should resolve into one of four explicit states:

- `recovered`: original or canonical session loaded and rendered;
- `degraded-readable`: current load failed, but last-good readable snapshot or partial history can be shown;
- `fresh-continuation`: a new session was created intentionally and visibly;
- `failed`: recovery failed and user action is required.

The UI should not settle to an empty canvas without one of these classifications.

### 1.2 Fresh continuation is not recovery

If the app creates a new `agentN` session after stale reopen failure, it must not be treated as recovered old context unless there is a verified rebind. The continuation must carry a reason code such as:

- `large-context-reopen-failed`
- `history-hydrate-failed`
- `unverified-stale-thread`
- `user-requested-fresh-continuation`

### 1.3 Diagnostics

Add or reuse bounded diagnostics so triage can distinguish:

- history load failure;
- hydrate failure;
- render surface blanking after loaded items exist;
- fresh continuation creation;
- alias rebind decision.

## 2. Stale-thread recovery confidence gate

### 2.1 Decision object

Introduce an internal `ThreadRecoveryDecision` value around recovery candidate selection:

- `oldThreadId`
- `candidateThreadId`
- `strategy`: `replacement | new-discovery | history-match | fresh-continuation`
- `confidence`
- `scoreGap`
- `featureSignals`
- `reasonCode`: `matched | ambiguous | no-candidate | low-confidence | verified | fresh-only`
- `isPersistent`

The decision object is not a storage schema migration by itself. It is a runtime contract used to decide whether alias persistence is allowed.

### 2.2 Candidate scoring

Existing selection should remain compatible, but scoring should expose why a candidate won:

- exact or near title/name match;
- source/provider/engine consistency;
- timestamp/activity-window coherence;
- message-history boundary match when stale items exist;
- uniqueness and score gap.

Recommended gate:

- `history-match` with unique message boundary match can be high confidence;
- `replacement` based only on name/source/provider should require a clear `scoreGap`;
- `new-discovery` should not become durable alias unless it also satisfies time or history evidence;
- single candidate alone is not enough for durable alias if stale local activity is durable and non-empty.

### 2.3 Persistence rule

Only decisions with `isPersistent=true` may call `rememberThreadAlias(...)`.

Low-confidence or ambiguous decisions may still:

- show a recoverable/degraded UI;
- allow explicit user recovery;
- use temporary in-memory continuity for the current session;
- create a fresh continuation if user-visible.

They must not write durable alias.

### 2.4 Rollback rule

If a persisted alias later fails to load or fails a lightweight consistency check, the system may clear the alias mapping and surface a degraded/fresh-continuation state. Alias rollback must not delete the source thread history or the replacement thread.

### 2.5 Finalized native identity boundary

Native session IDs with finalized prefixes are immutable UI identities:

- `claude:{sessionId}`;
- `gemini:{sessionId}`;
- `opencode:{sessionId}`.

They must never be used as alias sources. A `thread_session_id_updated` event where `threadId` is already finalized and differs from the event's finalized target must be treated as `finalized-mismatch` and ignored for rename purposes.

Allowed binding remains limited to pending or fork placeholders:

- `claude-pending-* -> claude:{sessionId}`;
- `gemini-pending-* -> gemini:{sessionId}`;
- `opencode-pending-* -> opencode:{sessionId}`;
- approved Claude fork placeholders that have not yet become finalized.

Persisted alias normalization must also drop historical finalized-native source aliases so older corrupted local state does not survive an app restart.

### 2.6 Catalog pagination boundary

The sidebar must keep catalog health and pagination separate:

- `nextCursor` is the only signal that “load older” can fetch another catalog page;
- `partialSource` / source status reason describes degraded completeness and must not synthesize a cursor;
- when `partialSource` is present with `nextCursor=null`, the UI may record diagnostics or seed last-good continuity, but it must not render “load older” for that source.

This prevents a scan-cap degraded source from repeatedly requesting the catalog root page and making the visible session count appear unstable.

### 2.7 Sidebar full-catalog fact source

Startup hydration previously used `first-page` for the active workspace so the chat surface became usable quickly. Field evidence from `hnms-osp` shows this trade-off is wrong for project session lists: users compare Sidebar against Strict project sessions and expect the same active session universe, not a temporary subset that later mutates.

The Sidebar project session list MUST therefore use `full-catalog` as its fact source from startup onward.

The orchestration boundary is:

- `listThreadsForWorkspace` returns progress metadata when a request was discarded by the per-workspace latest-request guard;
- a stale-discarded `full-catalog` result MUST NOT mark `fullyHydratedThreadListWorkspaceIdsRef`;
- active workspace and its projection owners are prioritized for `full-catalog` before unrelated idle workspace prewarm;
- hard errors may still settle an attempt to avoid a retry storm, but stale discards remain retryable because no state was applied.
- `loadActiveProjectCatalogSessions` MUST consume catalog `nextCursor` internally until there is no next page, or until it reaches a bounded degraded condition such as timeout, cursor loop, or page cap;
- when a bounded degraded condition is reached, the applied rows are marked partial/degraded and the cursor is not exposed as a normal Sidebar load-older path.

This keeps the Sidebar count/order aligned with Strict project sessions without an intermediate first-page projection.

### 2.8 Tracked refresh mode boundary

`listThreadsForWorkspaceTracked` is a shared orchestration wrapper, not only a startup primitive. Callers include:

- startup active workspace hydration;
- idle/background prewarm;
- Sidebar quick reload and reload;
- workspace rename/worktree flows that refresh session rows after metadata changes.

No caller may request `first-page` for the Sidebar project session list. Any untagged tracked refresh MUST default to `on-demand full-catalog`, even when the workspace is currently active. Otherwise a later manual or business refresh can overwrite the already-correct Sidebar catalog with a subset.

The implementation boundary is:

- `ensureWorkspaceThreadListLoaded` stamps `active-workspace / full-catalog` for startup auto hydration;
- `prewarmFullCatalogForWorkspace` and `prewarmSessionRadarForWorkspace` explicitly stamp background kinds;
- direct `listThreadsForWorkspaceTracked(workspace)` calls default to `on-demand / full-catalog`;
- tests must cover active workspace startup and direct tracked refresh so regressions cannot reintroduce active subset downgrades.

## 3. Windows Claude stream visibility calibration

### 3.1 Current fact

`candidateMitigationProfile` is already consumed by `resolveActiveThreadStreamMitigation`. The new work should not describe candidate as completely inactive.

### 3.2 Desired behavior

The diagnostics path should separately record:

- candidate profile selected;
- candidate reason;
- first visible render latency;
- active mitigation escalation;
- visible-output stall after first assistant text delta.
- non-text runtime progress, such as `commandExecution`, `fileChange`, and tool output deltas.

This keeps triage precise: slow first token, backend forwarding stall, backend tool execution, frontend render stall, and mitigation activation remain separate categories.

### 3.2A Non-text runtime progress boundary

Claude Code may legitimately spend minutes inside a command/tool step before the next assistant text delta. In that state the backend is not silent: it emits execution item snapshots or tool output deltas.

The frontend MUST treat those events as progress evidence:

- clear first-delta pending warning timers for the active turn;
- keep first assistant text latency unset until assistant text actually arrives;
- avoid activating visible-output stall recovery before assistant text ingress;
- retain the command/activity label as user-visible processing context.

### 3.3 Configuration

Thresholds should be configurable through the existing project-approved feature/debug config path rather than hard-coded scattered constants:

- `firstVisibleLatencyMs`
- `renderAmplificationMs`
- `visibleOutputStallMs`
- `preemptiveCandidateEnabled`

Defaults must preserve current non-Windows and non-Claude behavior.

## Trade-offs

### Option A: Only harden alias recovery

This is insufficient for issue #604 because blank canvas can happen before or outside stale-thread alias persistence.

### Option B: Only add last-good blank recovery

This improves the user symptom but leaves a durable alias pollution risk that can make subsequent opens worse.

### Option C: Layered guard (chosen)

This approach treats issue #604 as a user-visible blank-session problem first, then hardens alias persistence and Windows stream visibility as related recovery risks.

## Rollback

- Alias gates can be relaxed by lowering confidence thresholds or disabling persistence gating.
- Fresh-continuation explanation is additive and can be hidden behind existing recovery UI if needed.
- Stream visibility calibration can fall back to existing `render-amplification` and `visible-output-stall-after-first-delta` behavior.
