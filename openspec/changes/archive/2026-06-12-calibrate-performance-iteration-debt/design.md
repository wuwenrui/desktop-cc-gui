## Context

2026-06 performance iteration 已经落地多条 substrate：

- renderer side: `eventBackpressure`、listener owner registry、focus refresh wave、row-level thread status subscription、Markdown precompute、Composer/message row render diagnostics。
- backend side: `ScanCache<K,V>`、`PayloadBudgetMetadata`、blocking helper、workspace listing budget metadata。
- runtime side: provider-scoped Codex `CODEX_HOME` / runtime key、batch app-server event sink、file watcher debounce。

当前问题不是“完全没做”，而是 closeout 与代码事实之间仍有 drift：

- `workspace-tree-and-large-file-listing-budget` 宣称消费 Step 3 substrate，但 `workspaces/files.rs` 仍以 `ScanCacheState::Unsupported` 返回 listing cache state。
- `frontend-prop-chain-stability-2026-06` 的 tasks 同时出现 “2-session no visible jank” 与 “卡顿有减轻但仍存在” 的 contradictory language。
- AppShell domain boundary 已建立，但仍有 flat adapter 和 large physical files；这应是 structural debt，不应被 archive wording 吞掉。
- Codex provider-scoped runtime 已完成 provider/config/process isolation，但 per-thread process isolation 不是当前 spec requirement。

## Goals / Non-Goals

**Goals:**

- Wire workspace file listing / directory-child listing to the existing backend `ScanCache` where safe.
- Keep DTO compatibility while correcting `payloadBudget.cacheState` from `unsupported` to `hit` / `miss` / `invalidated` when cache is active.
- Calibrate OpenSpec evidence language for performance changes, especially residual jank and missing profiler artifact fields.
- Document large-file modularization debt as follow-up, not as a hidden failure of the current performance fix.

**Non-Goals:**

- No broad AppShell or message renderer rewrite.
- No deletion of compatibility fallback paths.
- No per-thread Codex app-server process isolation.
- No new cache dependency or external storage layer.
- No conversion of manual-only or proxy evidence into measured evidence.

## Decisions

### Decision 1: Use existing `ScanCache`, not a new workspace file cache

Implementation will reuse `src-tauri/src/backend_budget.rs::ScanCache` and `ScanCacheKeySignature`.

Alternative A: keep `ScanCacheState::Unsupported`.
- Pros: zero behavior risk.
- Cons: leaves a concrete old-path gap and makes Step 4 substrate consumption false.

Alternative B: introduce a specialized file-tree cache.
- Pros: could encode file-tree-specific invalidation deeply.
- Cons: duplicates substrate and increases drift.

Decision: reuse existing `ScanCache` with file-tree-specific key/signature helpers.

### Decision 2: Cache only bounded response payloads, preserve progressive scan behavior

The cache entry should store `WorkspaceFilesResponse` after the existing bounded scan logic has produced files, directories, directory metadata, `scan_state`, `limit_hit`, `sourceVersion`, and `payloadBudget`.

Key dimensions:

- workspace root canonical or normalized path identity;
- listing mode: initial / directory-child;
- requested relative path for subtree listing;
- budget: max files / max entries;
- source signature: bounded mtime/count signature for root or requested directory.

This keeps existing progressive behavior intact: cache does not make the backend return a full tree, and it does not remove partial states.

### Decision 3: Source signature is conservative and content-safe

The source signature must not serialize full paths or file content into diagnostics. It can use stable hashes of bounded metadata such as:

- root/requested directory metadata modified time;
- returned direct-entry count where cheap;
- budget and listing mode;
- existing response-derived `sourceVersion` as response identity.

If a safe signature cannot be derived, the path can report `unsupported` with a bounded reason.

2026-06-13 calibration: initial listing cache validation MUST NOT use a full recursive file walk before cache lookup. The corrected design validates an existing cached response from bounded metadata derived from the previous response shape:

- workspace root metadata;
- known directory metadata from the cached `directories` set;
- relevant `.gitignore` / `.git/info/exclude` metadata.

This preserves freshness for path membership changes without turning cache hit validation into another expensive full file scan. `cacheState=disabled` is not part of the current DTO enum, so unavailable cache paths should continue to use `unsupported` plus bounded diagnostics.

### Decision 4: Evidence calibration is documentation-first unless generated artifacts must change

The implementation will update active OpenSpec artifacts and evidence docs where language is contradictory. It should not regenerate all perf artifacts unless code changes alter the structured evidence fields.

This avoids creating noisy `docs/perf/**` churn while still fixing archive readiness.

### Decision 5: Codex isolation wording remains contractual, not code-changing

Current code already uses provider-scoped runtime keys for managed providers and legacy workspace key for disk provider compatibility. This change only clarifies the requirement boundary:

- completed: provider-scoped process/config/runtime identity;
- out of scope: one app-server process per thread.

### Decision 6: Daemon workspace listing must not remain a legacy branch

`src-tauri/src/bin/cc_gui_daemon/workspace_io.rs` carries a compatibility copy of workspace file listing. Because Web Service / remote daemon mode can route through this path, the cache evidence contract must be additive there too:

- same `listingBudget`, `sourceVersion`, and `payloadBudget` shape;
- same `hit` / `miss` / `invalidated` cache states for safe workspace listing;
- external absolute/spec listing may remain `unsupported` because this change scopes cache to workspace file-tree listing.

### Decision 7: Extract shared workspace listing core, keep adapters thin

Review found that fixing desktop and daemon separately still leaves a structural drift vector: both modules carry file-tree DTOs, special directory rules, budget metadata, cache signatures, and scanner loops. This change now closes that debt by extracting those pieces into `src-tauri/src/shared/workspace_listing.rs`.

The extraction boundary is intentionally narrow:

- shared core owns workspace file-tree DTOs, `list_workspace_files_inner`, `list_workspace_directory_children_inner`, directory-entry builders, cache validation, source-version generation, and listing response metadata;
- desktop `workspaces/files.rs` remains responsible for file read/write, preview handles, text search, external absolute listing, external spec tree, and workspace item mutations;
- daemon `workspace_io.rs` remains responsible for daemon-specific file read/write and external listing adapters, but delegates workspace file-tree listing to the shared core.

This reduces drift without forcing a broad workspace IO rewrite.

## Implementation Sketch

1. Add a shared workspace listing core in `src-tauri/src/shared/workspace_listing.rs` using `OnceLock<ScanCache<WorkspaceListingCacheKey, WorkspaceFilesResponse>>` or equivalent module-local static.
2. Define a small `WorkspaceListingCacheKey` enum/struct for initial listing and directory-child listing.
3. Build cheap `ScanCacheKeySignature` values without recursive pre-walk; for initial listing, derive validation from the cached response's known directories and ignore-file metadata.
4. Wrap the existing listing construction in `ScanCache` with lock-free compute sections, then rewrite response metadata to reflect the resulting cache evidence.
5. Add Rust tests for miss → hit and invalidated signature behavior for initial listing and directory-child listing.
6. Apply the same additive evidence contract through the shared workspace listing core so desktop and `cc_gui_daemon` return equivalent listing metadata.
7. Make desktop/daemon adapters delegate to the shared core and keep adapter-specific read/write/external listing logic local.
8. Update OpenSpec/evidence closeout wording for contradictory performance state.
9. Run strict OpenSpec validation and focused code tests.

## Risks / Trade-offs

- [Risk] Cache returns stale file tree after filesystem changes → Mitigation: validate cached responses from root/directory/gitignore metadata and keep frontend active-request / subtree `sourceVersion` stale-response guards.
- [Risk] Cache validation becomes as expensive as the original scan → Mitigation: never run a full recursive file walk only to decide hit/miss; use cached-response metadata validation.
- [Risk] Daemon compatibility branch drifts from desktop path → Mitigation: add daemon response metadata/cache tests and keep changes additive for older clients.
- [Risk] Shared extraction accidentally pulls adapter-specific file IO into a common module → Mitigation: keep shared core limited to workspace listing DTO/scanner/cache; leave read/write/external adapters in existing modules.
- [Risk] Cache hides partial scan state → Mitigation: cache the bounded response including `scan_state`, `limit_hit`, and directory metadata exactly as produced.
- [Risk] Static cache leaks across tests or workspaces → Mitigation: key by workspace root + mode + path + budget + signature, and add tests that distinguish roots/signatures.
- [Risk] More docs than code → Mitigation: keep implementation focused on the known old-path gap; structural large-file debt becomes explicit follow-up.
- [Risk] Evidence wording update appears to downgrade completed work → Mitigation: classify as task-complete but not archive-ready where evidence is missing, preserving the value of completed implementation.

## Migration Plan

1. Land OpenSpec artifacts.
2. Implement cache wiring behind existing response shape; no frontend breaking change.
3. Run focused Rust tests for workspace file listing cache.
4. Run focused TypeScript tests only if DTO mapping changes.
5. Validate OpenSpec strict.
6. If cache behavior regresses, rollback by changing workspace listing cache state back to disabled/unsupported while retaining the spec calibration text.

## Open Questions

- Should workspace listing cache be process-global only, or should future work attach it to `AppState` for explicit lifecycle management?
- Should follow-up large-file modularization be one change per file family, or a grouped “performance structural debt” epic with separate implementation tasks?
