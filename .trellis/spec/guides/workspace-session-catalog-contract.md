# Workspace Session Catalog Contract

本规范固化工作区会话列表的跨层 contract，适用于 `src-tauri/src/session_management.rs`、`src-tauri/src/engine/claude_history.rs`、`src/services/tauri/sessionManagement.ts`、`src/features/threads/hooks/useThreadActions*`、`src/features/settings/components/settings-view/**`、`src/features/workspaces/components/WorkspaceHome.tsx`。

## Scenario: Catalog Projection Is Membership Truth

### 1. Scope / Trigger

- Trigger：修改 workspace session listing、Claude/Codex/Gemini/OpenCode history scanner、Sidebar session merge、Session Management、Workspace Home session display、archive/folder/delete mutation。
- 目标：避免 Claude Code 会话因为 native scanner empty、exact `workspaceId` 二次过滤、或 project aggregate owner 漂移而从右侧工作区被吞。

### 2. Signatures

- `list_workspace_sessions_core(...) -> WorkspaceSessionCatalogPage`
- `build_workspace_scope_catalog_data(...) -> WorkspaceScopeCatalogData`
- `list_claude_session_source_facts_for_attribution_scopes_with_config(...) -> ClaudeSessionSourceFactList`
- `resolve_catalog_entry_attribution(...) -> SessionCatalogAttribution`
- `archive_workspace_sessions_core(...) -> WorkspaceSessionBatchMutationResponse`
- `unarchive_workspace_sessions_core(...) -> WorkspaceSessionBatchMutationResponse`
- `delete_workspace_sessions_core(...) -> WorkspaceSessionBatchMutationResponse`
- `assign_workspace_session_folders_core(...) -> WorkspaceSessionBatchMutationResponse`
- `useThreadActionsSessionCatalog(...).loadActiveProjectCatalogSessions`
- `buildWorkspaceSessionSelectionKey(entry)`

### 3. Contracts

- Backend catalog active strict projection MUST be the default membership truth for Sidebar and Session Management.
- Session Management may use a larger first-page catalog window than Sidebar. Current Settings catalog hook uses page size `9999` and does not expose user-visible pagination; Sidebar keeps its own startup/load-older catalog page size to avoid broadening startup pressure.
- Workspace Home MUST NOT derive an independent session membership set from `recentThreads`; if it later displays sessions, it MUST consume the same catalog projection or document an explicit display-window difference.
- Native engine list APIs such as `listClaudeSessions` MAY provide transcript restore, diagnostics, or continuity seed, but MUST NOT widen or shrink complete catalog membership.
- Frontend MUST NOT reapply exact `entry.workspaceId === selectedWorkspaceId` membership filtering on active strict projection rows. Project aggregate rows may have child/worktree `workspaceId`, and that owner must survive to UI state.
- `WorkspaceSessionSourceCompleteness` MUST preserve per-engine source status. `partial` / `degraded` / `uncertain_empty` cannot prove deletion; `authoritative_empty` only applies to the matching engine and requested scope.
- Metadata overlay is organization state only. `archive`, `folder`, and custom title metadata MUST NOT prove disk existence.
- Codex catalog source discovery MUST include managed provider homes under `codex-provider-homes/*/{sessions,archived_sessions}` in addition to disk/default and workspace Codex homes. Provider-home rows still MUST prove workspace ownership through source evidence such as `cwd`; provider id alone MUST NOT prove membership.
- Codex provider binding metadata MAY overlay `providerProfileId/source/name/availability` on an already discovered row. Metadata alone MUST NOT create an active strict catalog row. If a session is discovered from a provider home whose provider profile is no longer configured, the row MUST remain visible as managed provider history with `providerAvailability=unavailable`; it MUST NOT be rewritten to disk.
- Codex source completeness MUST distinguish disk/default/workspace roots from managed provider-home roots via `WorkspaceSessionCatalogSourceStatus.sourceKind` values such as `disk` and `provider-home`. Provider-home source diagnostics MUST degrade the Codex `provider-home` status and surface through `sourceStatuses[].diagnostics` instead of converting omitted provider-backed rows into authoritative deletion evidence. Frontend continuity may retain last-good provider-backed Codex rows while this Codex status is partial/degraded.
- Mutation writes MUST route by the row owner workspace and stable key, not by the currently selected aggregate workspace. Batch mutation results SHOULD expose `ownerWorkspaceId` and `stableSessionKey` for frontend reconciliation.
- Stable metadata key MUST be `engine + ownerWorkspaceId + canonicalSessionId`; new writes use stable key while reads may keep legacy bare `sessionId` compatibility.
- Source-fact cache is read-through acceleration only. It may cache bounded source facts, diagnostics, fingerprint, scanner/schema version, and cache metrics; it MUST NOT cache owner workspace, strict membership, archive/folder/custom title overlay, display window, selected state, or processing state.
- `.omx/**`, `.trellis/.developer`, `.trellis/.current-task`, client-local state, and other runtime artifacts MUST NOT be treated as long-term session catalog facts.

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| parent project aggregate includes child Claude row | row keeps child `workspaceId` and stable key | frontend exact-filter drops child row |
| worktree-only scope | only own worktree sessions appear | parent/sibling rows leak into strict membership |
| native Claude list empty but catalog has complete row | keep catalog row | native empty clears row |
| Claude scan uncertain/partial/degraded | preserve last-good continuity and expose source status | treat omission as authoritative deletion |
| cwd and Claude project dir conflict | unresolved diagnostic; no strict membership | guess parent/child owner |
| archive/move/delete child row from aggregate | write child owner metadata by stable key | write selected parent metadata |
| settings delete success | remove deleted ids from sidebar/list/cache/curtain derived state | degraded fallback revives deleted row or leaves deleted curtain loading |
| source-fact cache hit | rerun ownership resolver and metadata overlay | reuse cached owner/membership |
| cache missing/corrupt/deleted | direct scan and rebuild when possible | convert cache failure into authoritative empty |

### 5. Tests Required

- Rust tests for parent/child owner resolution, ambiguous sibling, cwd/project-dir conflict, source completeness, and metadata orphan behavior.
- Rust mutation tests for archive, unarchive, delete, and folder assignment routing by owner workspace and stable key.
- Rust cache tests for hit/miss/stale/schema mismatch/corrupt/deleted rebuild, plus cache exclusion of transcript body and organization overlay.
- Vitest coverage for Sidebar catalog normalization preserving child owner rows, Session Management stable selection keys, native empty not clearing catalog rows, and Workspace Home not deriving session membership from `recentThreads`.
- Contract validation: `openspec validate <change-id> --strict --no-interactive`, `cargo test --manifest-path src-tauri/Cargo.toml session_management claude_history`, focused Vitest for thread/settings session paths, `npm run typecheck`, and `npm run check:runtime-contracts`.

### 6. Wrong vs Correct

#### Wrong

```ts
const visible = response.data.filter(
  (entry) => (entry.workspaceId ?? selectedWorkspaceId) === selectedWorkspaceId,
);
```

#### Correct

```ts
const visible = response.data.map(normalizeProjectCatalogSession).filter(Boolean);
```

#### Wrong

```rust
let key = metadata_stable_key_for_session_id(&selected_workspace_id, &session_id);
metadata.archived_at_by_session_id.insert(key, archived_at);
```

#### Correct

```rust
let target = resolve_session_mutation_target(&scope_entries, &workspaces, &session_id)?;
metadata_for(&target.owner_workspace_id)
    .archived_at_by_session_id
    .insert(target.stable_session_key, archived_at);
```
