## Context

The previous Project Map context implementation added optional `ProjectMapRelation` types, frontend relation serialization, context packs, explain packs, and minimal impact analysis. However, the Tauri Project Map storage contract still rejects `relations/latest.json` and the read response does not expose relation snapshots. Project Map impact analysis also currently depends on an optional prop rather than a real workspace changed-file source.

This change closes the loop by extending the existing Project Map storage snapshot contract and by adapting the existing git status service into a Project Map impact input. The work stays intentionally small: no new relation extraction, no renderer rewrite, and no auto-update hook.

## Goals / Non-Goals

**Goals:**

- Allow `relations/latest.json` as a safe Project Map snapshot file.
- Include relation snapshots in `project_map_read` responses.
- Keep relation data optional and legacy datasets compatible.
- Load changed file paths from `getGitStatus(activeWorkspace.id)` when Project Map is opened for a persistence-backed workspace.
- Surface impact source metadata in the Project Map panel.

**Non-Goals:**

- No post-commit or SessionStart auto-refresh.
- No new backend command for Project Map impact.
- No new dependency.
- No generation of relation records beyond preserving records that already exist.
- No Agent Task patch-file bridge in this change; only leave the prop/adapter shape open for future sources.

## Decisions

### Decision 1: Extend the existing Project Map snapshot contract

`src-tauri/src/project_map.rs` already owns Project Map file path validation and read response assembly. The least invasive path is to add `relations/latest.json` to the existing safe path whitelist and expose `relations` as an optional JSON value in `ProjectMapReadResponse`.

Alternatives considered:

- Add a separate relation read/write command: rejected because it splits one Project Map snapshot into multiple APIs.
- Store relations under `evidence/latest.json`: rejected because relation graph is a different concern from evidence records.

### Decision 2: Use `getGitStatus` as the first real changed-file provider

The frontend already has a typed `getGitStatus(workspaceId)` service returning `files`, `stagedFiles`, and `unstagedFiles`. Project Map can derive unique changed paths from that service without adding a new Git API.

Alternatives considered:

- Use `getGitDiffs`: heavier and unnecessary because impact only needs file paths.
- Add a new backend command for changed paths only: premature until multiple impact sources exist.

### Decision 3: Keep manual `changedFilePaths` prop as an override/future bridge

`ProjectMapPanel` keeps the existing optional `changedFilePaths` prop. When provided, it wins. When omitted and an active workspace exists, the panel loads git status paths.

Alternatives considered:

- Always fetch git status: noisy for controlled/test datasets and non-persistence views.
- Remove the prop and only use git: blocks future agent patch-file bridge.

## Risks / Trade-offs

- [Risk] Git status can fail outside a git repository -> Mitigation: treat failure as empty impact source and show no overlay rather than breaking Project Map.
- [Risk] Relation snapshots may contain dangling endpoints -> Mitigation: existing frontend sanitizer drops relation records whose endpoints are absent.
- [Risk] Backend write whitelist expands storage surface -> Mitigation: only allow `relations/latest.json`, same constrained pattern as runs/evidence/candidates.
- [Risk] Polling git status on every render -> Mitigation: fetch only in an effect keyed by active workspace id and manual override signature.

## Migration Plan

1. Extend backend read/write whitelist and response shape.
2. Add frontend impact source utility for git status path extraction.
3. Wire ProjectMapPanel to load git impact files when appropriate.
4. Mark tasks complete and run OpenSpec/typecheck validation.

Rollback strategy:

- Remove `relations` from backend response and whitelist.
- Remove ProjectMapPanel git status effect and impact source metadata.
- Existing datasets without relations are unaffected.
