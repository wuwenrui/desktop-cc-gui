## Context

Provider-scoped Codex launch intentionally moved managed provider sessions into app-local provider homes. That is correct for runtime isolation, but it means workspace session listing can no longer assume that all Codex history is under the default/workspace `CODEX_HOME` roots.

The current committed implementation has three relevant facts:

1. Managed provider homes are created under app-local `codex-provider-homes/<providerId>`.
2. `local_usage` Codex root resolution scans `sessions` and `archived_sessions` for default/workspace Codex homes, but does not enumerate managed provider homes.
3. Catalog provider binding is applied after an entry already exists. This preserves provider metadata for scanned sessions, but cannot create membership for a session that was never scanned.

The result is a split-brain behavior:

- creation-time frontend display is mostly correct because start responses and reducer merges carry provider metadata;
- continuation can often work for a known thread because thread provider binding can resolve runtime routing;
- refresh/restart sidebar membership is incomplete because provider-home history is not part of source discovery.

## Design Goals

- Make workspace Codex session membership complete for disk and managed provider homes.
- Keep the shared workspace session catalog as the membership truth for sidebar, Workspace Home, and Session Management.
- Preserve strict workspace scope and avoid cross-workspace leakage from shared provider homes.
- Keep provider metadata projection deterministic and explainable.
- Avoid treating live runtime state as the only proof of membership.
- Add regression tests around restart/no-runtime, because that is where creation-time in-memory overlays disappear.

## Proposed Architecture

```text
Workspace session catalog request
  -> resolve workspace/project scope
  -> resolve Codex source roots
     - disk/default roots
     - workspace override roots
     - managed provider home roots: codex-provider-homes/*/{sessions,archived_sessions}
  -> scan Codex summaries from all candidate roots
  -> attribute each candidate to workspace scope using cwd/owner evidence
  -> apply catalog metadata overlays
     - provider binding
     - folder assignment
     - archive/delete metadata
  -> project source status/completeness per engine/source kind
  -> return rows to sidebar/home/session management
```

Provider-home discovery should be a source expansion, not a membership shortcut. A provider home can contain sessions for multiple workspaces, so each scanned Codex summary still needs the normal workspace ownership filter before it enters strict project membership.

## Provider Home Root Resolution

The backend should add an explicit provider-home root resolver, conceptually:

```text
resolve_managed_codex_provider_session_roots()
  -> app_home/codex-provider-homes/*/sessions
  -> app_home/codex-provider-homes/*/archived_sessions
```

The resolver should dedupe roots with the same normalized key used by existing Codex root merging. It should tolerate missing provider-home directories and unreadable individual provider homes by exposing degraded source diagnostics rather than failing the whole workspace catalog when disk roots remain readable.

Provider identity can come from two sources:

- provider binding metadata for the session id, which is authoritative for already-bound sessions;
- provider-home path ownership as supporting evidence when a scanned session is found under `codex-provider-homes/<providerId>`.

If both exist and disagree, the catalog should prefer persisted binding for routing and expose a diagnostic or degraded marker rather than silently rewriting the binding.

## Catalog Projection

Catalog rows discovered from managed provider homes must follow the same overlay order as disk rows:

1. prove source existence and workspace ownership;
2. mark existing-on-disk physical path/source evidence;
3. apply provider binding metadata;
4. apply folder/archive/auto-session metadata;
5. compute source status and deletion/missing-on-disk state.

Provider binding remains overlay metadata. It must not be the only reason a session enters the strict workspace projection.

If a session has no provider binding but is discovered under a managed provider home, the implementation may project a best-effort provider binding from the provider home id only when that provider id can be resolved to a saved provider profile. If the provider profile no longer exists, the row should remain visible as unavailable with the provider id preserved when it can be inferred.

## Live Runtime Listing

Live Codex listing should not be treated as the sole membership source. There are two acceptable implementation shapes:

### Option A: Aggregate provider-scoped live runtimes

Enumerate active Codex runtimes for the workspace, including keys shaped like `codex::<workspaceId>::<providerId>`, and merge live thread entries from disk and managed runtimes.

Pros:

- live status is more complete while app-server processes are active;
- fewer temporary degraded markers for managed provider sessions.

Cons:

- requires careful runtime-key parsing and bounded fan-out.

### Option B: Keep live listing diagnostic; catalog scan owns membership

Do not expand live runtime aggregation in the MVP fix. Instead, ensure disk/provider-home scans are complete enough that refresh/restart membership is correct. Live listing can still overlay status when available and mark provider-scoped live coverage partial when only the legacy workspace runtime is queried.

Pros:

- smaller fix, lower risk;
- aligns with shared catalog as membership truth.

Cons:

- live status may lag for managed provider runtimes until scanner/catalog catches up.

Decision: prefer Option B for the first hardening pass unless existing runtime registry utilities make Option A simple and bounded. In either case, the UI must not interpret missing managed-provider live entries as deletion evidence.

## Mutation Routing

Archive, delete, folder assignment, and metadata cleanup must resolve Codex sessions discovered under provider homes. Target resolution should use stable keys already accepted by catalog metadata lookup:

- workspace id;
- engine `codex`;
- session/thread id;
- provider binding when needed for physical source disambiguation;
- physical path/root source evidence when the operation touches disk history.

Delete/archive operations must not delete or mutate an entire provider home. They should target the session file/metadata row only, following existing disk-session behavior.

## Source Completeness

Catalog source status should distinguish:

- disk Codex scan complete;
- managed provider homes scan complete;
- one or more provider homes unreadable/partial;
- provider binding metadata present but source file missing;
- provider profile missing while provider-home history still exists.

This is important because sidebar continuity logic should preserve last-good provider-backed rows during partial/degraded reads, but remove rows when the backend proves authoritative absence.

## Validation Plan

- Rust unit/integration tests create fake disk Codex history and fake `codex-provider-homes/<providerId>` history, then assert catalog membership after restart/no-runtime.
- Tests include provider-home sessions for another workspace and assert strict projection excludes them.
- Tests include deleted provider metadata and assert unavailable provider display without disk fallback.
- Mutation tests cover archive/delete/folder assignment for provider-home rows.
- Frontend tests assert sidebar/thread list preserves provider labels from catalog and does not clear last-good provider-backed rows on degraded provider source status.
- Run strict OpenSpec validation for this change.
