# Design / 设计

## Context / 背景

Workspace file tree already has partial capability: backend responses expose `limit_hit` / `scan_state`, frontend `useWorkspaceFiles` caches snapshots, and `FileTreePanel` has virtual rows plus lazy directory loading entry points. This change turns those scattered behaviors into a durable bounded listing contract and bridges it with search hydration via a guarded shared file index.

This is not a file tree redesign. It is a contract and evidence upgrade for large workspace listing.

## Architecture / 架构

```text
Tauri command: list_workspace_files / directory children
  -> budget metadata
  -> sourceVersion
  -> payload estimate
  -> partial/full state

useWorkspaceFiles
  -> snapshot cache keyed by workspace/root/signature/options
  -> sourceVersion stale guard
  -> watcher invalidation

FileTreePanel
  -> visible-first render
  -> unknown/truncated subtree UI
  -> on-demand subtree loading

Shared File Index Adapter
  -> path tokens
  -> directory tokens
  -> sourceVersion/freshness
  -> search hydration fallback if unavailable

runtime-performance-evidence-gates
  -> duration/item-count/payload/cacheState/partial evidence
```

## Decisions / 关键决策

### Decision 1: Keep existing partial semantics and add metadata

Existing `scan_state` and `limit_hit` are useful and should not be discarded. The first implementation layer should add budget metadata around them rather than replace the whole backend response.

New metadata should include:

| Field | Purpose |
|---|---|
| `sourceVersion` | stale response rejection and shared index identity |
| `budget.depth` | initial listing depth or equivalent visible-first bound |
| `budget.maxEntries` | item-count cap |
| `returnedEntries` | actual count |
| `payloadBytes` | estimated bridge payload size |
| `cacheState` | hit/miss/disabled/unsupported |
| `scanState` | partial/complete |

### Decision 2: Directory expand is subtree-first

Expanding a directory should request the requested subtree or one page of that subtree. Full-tree refresh remains a compatibility fallback, but it must be recorded in diagnostics when used.

This preserves user-visible behavior while making regressions detectable.

### Decision 3: Unknown is not empty

Partial file tree UI must distinguish:

- known empty directory;
- loading directory;
- truncated directory;
- stale directory needing refresh;
- unsupported fallback.

This prevents budgeted listing from looking like data loss.

### Decision 4: Shared file index is guarded, not assumed

File tree and search should consume the same source version when a fresh shared index is available. If `search-index-and-bounded-hydration` has not completed normalized index work, this change should expose an adapter/fallback and classify evidence as `unsupported` or `manual-only`, not claim measured reuse.

### Decision 5: Watcher invalidation has mtime fallback

Watcher changed paths should invalidate affected subtrees and shared index entries. Because watcher misses are possible, mtime/signature-based refresh and manual refresh must remain available.

## Data Contract / 数据合同

Initial listing response SHOULD be backward-compatible and additive. Existing file/directory arrays remain consumable. New metadata is optional during migration but required for budget evidence once the command is migrated.

Subtree response should include:

- requested relative directory path;
- sourceVersion used for scan;
- returned entries;
- partial/truncated state;
- cursor/page metadata if large subtree pagination is enabled;
- payload estimate and duration evidence.

## Diagnostics Contract / 诊断合同

File listing evidence includes command/surface id, workspace id, duration, returned item count, payload estimate, cache state, partial/full state, sourceVersion hash, and evidence class.

Diagnostics MUST NOT include file contents. Path handling should prefer relative paths or hashed identifiers when exported outside local debug context.

## Rollout Plan / 实施顺序

1. Add budget/sourceVersion/payload diagnostics to existing listing path.
2. Harden frontend stale guard and partial UI labels.
3. Convert directory expand to requested-subtree-only for migrated path.
4. Add watcher invalidation and mtime fallback tests.
5. Add shared file index adapter with fallback classification.
6. Extend runtime evidence gate.

## Validation Matrix / 验证矩阵

| Area | Evidence |
|---|---|
| Backend listing budget | Rust unit tests for partial/metadata/subtree |
| Frontend partial UI | FileTreePanel tests |
| Stale guard | sourceVersion stale response test |
| Watcher invalidation | create/modify/delete/rename tests |
| Long-list proxy | `npm run perf:long-list:baseline` |
| Browser scroll qualifier | `npm run perf:long-list:browser-scroll` |
| Evidence gate | `npm run check:runtime-evidence-gates` |
| Type/lint | `npm run typecheck`, `npm run lint` |
| OpenSpec | `openspec validate workspace-tree-and-large-file-listing-budget --strict --no-interactive` |

## Rollback / 回滚

- Metadata-only additions can remain if backward-compatible.
- Subtree loading can fall back to full listing behind diagnostics if partial UI breaks.
- Shared index adapter can be disabled without removing file tree budget evidence.

## Risks / 风险

- Budget thresholds may be too strict for medium workspaces; keep debug opt-out and diagnostics.
- Shared index sourceVersion bugs can show stale files in search/tree.
- Browser-level long-list evidence may be unsupported locally; preserve qualifier.
