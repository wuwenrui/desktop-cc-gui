## Why

Claude / Codex / OpenCode sidebar rows are currently merged across runtime events, native history listing, catalog fallback, custom titles, and last-good snapshots in several hook/reducer paths. This makes degraded inputs able to overwrite stable titles with generic names such as `Agent N`, and transient source failures can still look like membership deletion.

The change refactors sidebar session display into a narrow, pure projection layer so source-specific candidates are merged by explicit identity, title confidence, and membership evidence instead of incidental arrival order.

## Goals And Boundaries

- Build a session-display projection contract for sidebar rows.
- Keep message sending, runtime process lifecycle, and transcript loading behavior unchanged except for the displayed sidebar rows they already feed.
- Preserve existing custom-title, archive/hidden, parent-child, and last-good continuity behavior.
- Make weak fallback titles (`Agent N`, `Claude Session`, empty ordinal titles) unable to overwrite meaningful user-facing titles.
- Make incomplete listing sources non-authoritative for deletion unless explicit delete/archive/hidden/out-of-scope evidence exists.

## Non-Goals

- No full rewrite of thread messaging, runtime launch, or native Claude history storage.
- No new global state framework.
- No schema-breaking changes to Tauri commands or persisted thread records.
- No change to the user-visible ordering model except where duplicate/weak rows currently distort the list.

## What Changes

- Add a feature-local pure projection helper that accepts runtime/catalog/native/last-good candidates and emits stable sidebar summaries.
- Consolidate weak-title detection and title confidence comparison behind that helper.
- Route existing sidebar merge logic through the projection helper instead of scattering fallback preservation logic across call sites.
- Preserve last-good Claude rows on degraded listing while rejecting degraded snapshots as future last-good truth.
- Add regression tests for generic `Agent N` title overwrite, pending/finalized identity continuity, and degraded listing preservation.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `claude-session-sidebar-state-parity`: Clarifies that stable sidebar display is produced by a projection layer with explicit identity alias, title confidence, and membership evidence semantics.

## Impact

- Frontend: `src/features/threads/hooks/**` and a new feature-local pure helper/test module under `src/features/threads/utils/**`.
- Backend: narrow Claude subagent summary filtering may be adjusted only if generic subagent metadata is proven to be the source of `Agent N`.
- Specs: delta under `openspec/changes/refactor-session-display-projection/specs/claude-session-sidebar-state-parity/spec.md`.
- Dependencies: none.

## Acceptance Criteria

- A meaningful sidebar title is not replaced by `Agent N` or `Claude Session` during refresh.
- A degraded/timeout Claude listing does not remove previously visible in-scope Claude rows.
- Pending-to-finalized Claude identity convergence does not create an additional visible `Agent N` row.
- Archive/hidden/delete evidence still removes rows and is not masked by last-good continuity.
- Focused frontend tests pass for the projection helper and touched thread sidebar paths.
