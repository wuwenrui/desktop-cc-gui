## Context

The current file tree hook calls `getWorkspaceFiles()` on active workspace load. That service maps to `list_workspace_files`, which intentionally returns a broad workspace snapshot for file references, global search, Spec Hub, Project Map, and other compatibility paths. Even after the scan moved into `spawn_blocking`, the visible file tree path still creates heavy disk, CPU, allocation, and tree-build pressure during workspace switches.

The application already has a one-level directory-child command for progressive expansion. The file tree should use that bounded model as its regular data source instead of treating the full workspace snapshot as a required startup or switch-time hydration step.

## Decisions

### Decision 1: Directory-first file tree model

`useWorkspaceFiles` will load `getWorkspaceDirectoryChildren(workspaceId, "")` for initial/manual visible file tree refresh. The empty path is a directory-child-only sentinel for the workspace root. It is not valid for file read/write commands.

### Decision 2: No automatic full snapshot hydration for file tree

`useWorkspaceFiles` will not automatically call `getWorkspaceFiles()` for initial load, manual refresh, polling, or workspace switching. Keeping full hydration in the background still competes for disk and CPU, and frequent workspace switching can stack expensive scans even when the loading indicator is no longer waiting on them.

The full snapshot command remains available for explicit compatibility callers, but it is no longer part of the folder-opening UI's normal control flow.

If the root directory-child query fails before any cached/root snapshot exists, the hook may run a single legacy `getWorkspaceFiles()` fallback for compatibility with older daemon processes or not-yet-restarted backends. This is an error recovery path, not the normal folder-opening strategy.

### Decision 3: Shallow polling

Periodic polling should stay shallow. Re-running full recursive scans every polling interval recreates the slow-path pressure this change is trying to avoid.

### Decision 4: No new command name

The directory-child command already means "return direct children for a directory." A root sentinel extends that contract without adding another RPC method or frontend service wrapper surface.

### Decision 5: Root query avoids synchronous gitignore decoration

The root directory-child query is optimized for first paint and workspace switching. It returns direct children and directory metadata but defers root-level gitignore marker computation, because `status_should_ignore` can become a hidden Git status scan on large repositories. Nested lazy expansion may still return gitignored markers for the requested directory.

### Decision 6: Cache bounded root snapshots per workspace

`useWorkspaceFiles` keeps a small in-memory cache of recent root directory-child snapshots. When the user switches back to a workspace, the hook restores the cached root snapshot before paint instead of showing a loading-only state or stale files from the previous workspace. The cache is bounded to recent workspaces and stores only the shallow root response, not a recursive tree.

Root directory-child requests are also tracked per workspace while in flight. Switching A -> B -> A before A's first root request resolves reuses the pending A request instead of issuing a duplicate RPC.

### Decision 7: Compatibility fallback must not poison the root cache

The legacy `getWorkspaceFiles()` fallback may return a complete recursive snapshot. It can be applied to the active UI to keep older daemon/backend combinations usable, but the root snapshot cache must store only a root-only projection of that fallback response. This preserves the cache's memory and switch-back performance contract.

## Error Handling

- Root child query failures still produce `loadError` and may use the existing initial retry path.
- Root child query failures may first attempt a one-shot legacy full snapshot fallback when no visible root data exists.
- Stale workspace responses remain guarded by the active workspace id before mutating hook state.
- Post-unmount responses must not mutate hook state.
- Stale successful root responses may populate the root snapshot cache, but they must not mutate visible state until that workspace becomes active again.
- Stale failures must not overwrite the active workspace error state or increase its polling backoff.
- Directory-child path traversal validation remains unchanged for non-empty paths.

## Compatibility

- Full snapshot callers keep using `getWorkspaceFiles()` unchanged.
- Root-first behavior is internal to file tree loading and detached explorer loading through `useWorkspaceFiles`.
- The root sentinel is an exact empty string for directory-child queries. Whitespace-only paths remain invalid, and file paths still reject empty strings.
- Existing response arrays remain authoritative for consumers that do not understand `directory_entries`.
- Existing daemon and Web service bridge code continues to forward `list_workspace_directory_children`; no web-only method fork is introduced.
- File tree users may see gitignore dimming after lazy directory expansion or explicit full-snapshot consumers update their own state, but root first paint must not synchronously pay for full gitignore decoration.

## Testing

- Hook tests cover root-first initial load, absence of automatic full scans, retry, stale workspace switch, cache restore, in-flight request reuse, and disabled initial load.
- Rust tests cover empty directory path resolving to workspace root in both desktop and daemon scanner implementations.
- Rust tests cover root child queries deferring gitignore markers while nested directory-child queries still preserve them.
- OpenSpec strict validation covers proposal/design/spec/tasks consistency.

## Rollback

Revert the hook to call `getWorkspaceFiles()` for initial visible load and restore empty directory path rejection. Since the full snapshot command is preserved, rollback is localized to the root-sentinel and hook orchestration changes.
