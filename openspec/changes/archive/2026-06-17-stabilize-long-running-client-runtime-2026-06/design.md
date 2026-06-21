# Design: Stabilize Long Running Client Runtime 2026-06

## Architecture Overview

This change treats long-running client jank as a bounded-resource problem:

```text
Engine Runtime
  -> child process registry / Drop fallback / diagnostics

React Module Surfaces
  -> virtualized visible rows / lazy projection / bounded LRU

Markdown Render Pipeline
  -> live lightweight path / final worker precompute / stale result guard

Evidence Gates
  -> measured | proxy | manual-only | unsupported
```

`chat-stream-render-isolation-2026-06` is the reference design for local render isolation. This change generalizes the discipline but keeps scope narrow: P0 process lifecycle parity, P1 long-list/module switching, P1 worker/render lifecycle diagnostics.

## 1. Engine Process Lifecycle Parity

### Current Fact

`ClaudeSession` already has a non-blocking `Drop` fallback:

```rust
impl Drop for ClaudeSession {
    fn drop(&mut self) {
        let Ok(mut active) = self.active_processes.try_lock() else {
            log::warn!(...);
            return;
        };
        for (turn_id, mut child) in active.drain() {
            let _ = child.start_kill();
        }
    }
}
```

`OpenCodeSession` and `GeminiSession` also store `active_processes: Mutex<HashMap<String, Child>>`, but lack parity.

### Decision

Implement small per-engine Drop blocks instead of introducing an async trait abstraction. Reason: `Drop` cannot await, and a trait would add lifetime/async complexity without reducing meaningful duplication.

Keep the first implementation close to the current map shape. If stale diagnostics need age/progress fields, wrap each handle in a small record at the insertion/removal boundary instead of adding a separate global registry:

```rust
struct ActiveEngineChildProcess {
    child: Child,
    started_at_ms: u64,
    last_progress_at_ms: Option<u64>,
    last_progress_source: Option<&'static str>,
}
```

If an engine cannot provide progress metadata without invasive parser changes, it MUST report age-only diagnostics with `progressEvidence="unsupported"`.

### Contract

- `Drop` MUST use `try_lock`.
- `Drop` MUST drain active children only when lock succeeds.
- `Drop` MUST call `start_kill()` best-effort.
- `Drop` MUST NOT wait on child exit.
- Lock failure MUST log warning and return.

### Diagnostics

Reuse `get_engine_active_process_diagnostics`.

Expected response shape remains compatible, but rows MUST include all supported local engines:

```ts
type EngineActiveProcessDiagnostics = {
  measured: boolean;
  sampledAtMs: number;
  totalActiveProcessCount: number;
  workspaces: Array<{
    workspaceId: string;
    engine: "claude" | "opencode" | "gemini";
    activeProcessIds: number[];
  }>;
  unsupportedReason?: string | null;
};
```

Remote backend mode returns `measured=false`.

### Stale Reconciler

Phase 1 is diagnostics-only:

- sample every 60s while local runtime is active.
- mark child as stale by registered age and, only where available, last known IO/progress.
- never infer "no progress" for engines that do not expose progress metadata; report `progressEvidence="unsupported"` instead.
- emit diagnostics but do not kill by default.

Kill policy is a follow-up toggle after false-positive review.

### Registry vs OS Process Liveness

`totalActiveProcessCount=0` means the runtime no longer holds child handles in the registered engine maps. It does not prove that the operating system has reaped every process after a best-effort `start_kill()`.

Evidence MUST therefore split:

- `registeredActiveProcessCountAfterClose`: command-level measured/proxy evidence from runtime registries.
- `sampledOsChildLivenessAfterClose`: platform/manual evidence using available OS process sampling, or `unsupported` when no stable sampler exists.

Release notes and archive readiness MUST NOT promote registry-zero evidence into an OS-liveness claim.

## 2. Long List / Module Switch Bounded Rendering

### Surfaces

Initial surfaces:

- `src/features/home/components/HomeChat.tsx` workspace picker.
- `src/features/app/components/ThreadList.tsx` session rows.
- `src/features/app/components/Sidebar.tsx` workspace/session groups where 100+ rows can mount.

### Decision

Use `@tanstack/react-virtual`, already present in the app, instead of adding a new dependency or custom virtualizer.

### Virtualization Gate

```ts
const LONG_LIST_VIRTUALIZATION_MIN_ROWS = 100;

function shouldVirtualizeClientList(rowCount: number) {
  return rowCount >= LONG_LIST_VIRTUALIZATION_MIN_ROWS;
}
```

### Row Identity

- Workspace row key: `workspace.id`
- Thread row key: `thread.id`
- Index key is forbidden.

### Sidebar Virtual Item Model

`Sidebar` is not a simple homogeneous list. It contains pinned rows, workspace cards, grouped workspaces, worktrees, session folders, separators, load-more rows, and empty states. The implementation MUST flatten only the scrollable, repeatable part into explicit virtual items before applying `@tanstack/react-virtual`.

Target model:

```ts
type SidebarVirtualItem =
  | { kind: "workspace-header"; key: string; workspaceId: string }
  | { kind: "thread-row"; key: string; workspaceId: string; threadId: string }
  | { kind: "pinned-thread-row"; key: string; workspaceId: string; threadId: string }
  | { kind: "folder-row"; key: string; workspaceId: string; folderId: string }
  | { kind: "separator"; key: string }
  | { kind: "load-more"; key: string; workspaceId: string }
  | { kind: "empty-state"; key: string };
```

Keys MUST be stable domain keys, e.g. `${workspaceId}:${threadId}` or `${workspaceId}:folder:${folderId}`. Group headers and non-scroll chrome can stay outside the virtualizer when they are bounded.

### Projection Boundary

Current risk: list render receives large maps such as `threadStatusById` and computes derived state across all threads when only visible rows matter.

Target:

```ts
type ThreadRowProjection = {
  threadId: string;
  isProcessing: boolean;
  hasUnread: boolean;
  backgroundActivityLabel: string | null;
};

function getThreadRowProjection(input: {
  workspaceId: string;
  threadId: string;
  statusVersion: string;
}): ThreadRowProjection;
```

Projection MUST be lazy:

- compute only for visible virtual rows.
- cache with bounded LRU max 200.
- cache key MUST include enough version/signature data to avoid stale status.

## 3. Streaming Render Isolation Extension

### Existing Work To Reuse

Do not repeat these from `chat-stream-render-isolation-2026-06`:

- reducer fast path for streaming completion/upsert.
- `MessagesTimeline` streaming virtualization.
- workspace-scoped 6 in-flight refs.
- `Messages` local transient timer cleanup.
- `chat-stream/*` diagnostics for eviction/timer cleanup/complexity cache.

### New Work

Extend `fastMarkdownRenderer` worker adapter lifecycle diagnostics:

```ts
type FastMarkdownWorkerDiagnostics = {
  hasWorker: boolean;
  pendingRequestCount: number;
  disposedCount: number;
  fallbackCount: number;
  staleResultDropCount: number;
  lastFallbackReason: string | null;
};
```

### Worker Request Contract

Every worker request MUST include:

- requestId
- documentKey
- contentHash
- optionsHash
- schemaVersion
- createdAtMs

Every response MUST be ignored if:

- requestId is no longer pending.
- worker was disposed.

The worker adapter owns request lifecycle only: pending count, dispose rejection, worker failure fallback, unknown request responses, and bounded diagnostic counters. It MUST NOT guess the latest visible Markdown source unless it is given an explicit latest-source registry.

The current latest-source protection belongs to the hook/caller layer:

- `useFastMarkdownRender` keeps a request ordinal and ignores obsolete promise resolutions.
- If adapter-level stale diagnostics are required, add an explicit `latestRequestByDocumentKey` / `contentHash` / `optionsHash` / `schemaVersion` contract first.
- Stale-drop counters MUST state whether they are adapter-level stale drops or hook-level stale visible-result drops.

### Live vs Final Markdown

- Live streaming fragments stay lightweight/progressive.
- Final large Markdown may precompute serializable metadata in worker.
- Worker output is not trusted DOM and does not replace React sanitization/rendering.

## 4. Evidence Model

This change adds proxy budgets first. Release-grade measured claims require real Tauri/WebView trace.

Proposed metrics:

| Metric | Evidence | Target |
|---|---|---|
| `S-LR-100/activeEngineProcessCountAfterClose` | measured/manual | 0 after 30s or explicit external source |
| `S-LR-101/sampledOsChildLivenessAfterClose` | manual/proxy/unsupported | 0 confirmed children or explicit unsupported/manual note |
| `S-LR-110/staleEngineChildCandidateCount` | proxy/measured | 0 unexpected stale candidates; age-only if progress unsupported |
| `S-LR-200/moduleSwitchP95Ms` | measured/proxy | <= baseline * 0.7 after implementation |
| `S-LR-210/visibleListRowCount` | proxy | <= virtualizer budget |
| `S-LR-300/markdownWorkerPendingRequests` | proxy | bounded, returns to 0 after dispose |
| `S-LR-310/streamingVisibleLagP95Ms` | proxy/measured | no regression vs chat-stream baseline |

No metric may include conversation content.

Each `S-LR-*` metric MUST either be emitted with evidence class and source path, or appear as an explicit unsupported/manual-only marker with rationale.

## 5. Rollback Strategy

- Process Drop fallback can be reverted per engine without changing command signatures.
- Stale reconciler starts diagnostics-only, so rollback is disabling diagnostics collection.
- Virtualization gate can be disabled by threshold/flag while preserving existing `.map` render path.
- Worker diagnostics can be reverted without removing existing worker fallback.

## 6. Implementation Order

1. Process lifecycle parity (OpenCode/Gemini Drop + diagnostics).
2. Registered-age stale diagnostics and OS-liveness evidence separation.
3. HomeChat workspace picker virtualization.
4. Sidebar virtual item model, then ThreadList/Sidebar visible-row virtualization and lazy projection.
5. Markdown worker pending diagnostics plus hook/caller stale-result evidence.
6. Evidence gates and long-run trace.

This order front-loads P0 safety and makes each P1 step independently testable.

Execution gates:

- Do not start broad Sidebar virtualization before `SidebarVirtualItem` is reviewed.
- Do not mark process lifecycle complete until registry diagnostics and OS-liveness evidence are split.
- Do not mark Markdown worker work complete if stale-result handling is only claimed inside the adapter without hook/caller latest-source evidence.
- Do not archive this change until every `S-LR-*` metric is emitted or explicitly marked unsupported/manual-only.
