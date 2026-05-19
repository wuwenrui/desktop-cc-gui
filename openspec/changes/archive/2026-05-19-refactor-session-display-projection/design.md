## Context

The sidebar currently receives session/thread summaries from several sources:

- live runtime thread summaries and pending IDs
- native Claude history listing
- catalog / startup partial listings
- custom title maps
- last-good snapshots used during degraded refresh
- archive, hidden, and workspace-scope filters

Those responsibilities are spread across hook helpers and reducer branches. The practical failure mode is that weaker candidates can overwrite stronger display identity, and incomplete source results can be interpreted like authoritative deletion.

## Goals / Non-Goals

**Goals:**

- Centralize sidebar display merging into a pure projection helper.
- Make identity aliasing, title confidence, and membership evidence explicit.
- Preserve existing public hook contracts and Tauri payload contracts.
- Keep the implementation testable without mounting the whole app.

**Non-Goals:**

- Rebuild the whole thread reducer or message sending flow.
- Introduce Redux/Zustand or another global store.
- Change native history file formats.
- Change activation/reopen semantics beyond removing duplicate/weak sidebar projections.

## Decisions

### Decision 1: Add a pure projection helper instead of rewriting hook state

Chosen approach:

- Add a feature-local utility that projects sidebar summaries from source candidates and previous stable rows.
- Keep React hooks responsible for orchestration only.
- Make the helper deterministic and unit-testable.

Alternative A: keep patching existing hook branches.

- Pros: smallest diff.
- Cons: preserves the original design flaw; fallback rules remain scattered and will drift.

Alternative B: rewrite the entire session store.

- Pros: clean conceptual model.
- Cons: too risky because session identity touches composer, runtime events, history loading, custom titles, archive state, and active selection.

Rationale: the helper is a strangler layer. It gives the sidebar one stable projection path while leaving high-risk runtime and messaging flows intact.

### Decision 2: Model titles by confidence

Chosen confidence order:

1. custom or mapped title
2. meaningful native/runtime title
3. meaningful first-message preview
4. weak generic fallback such as `Agent N` or `Claude Session`

Weak titles can fill an empty row, but MUST NOT overwrite a stronger existing title for the same canonical identity.

Alternative: use source ordering only.

- Rejected because arrival order is exactly what makes degraded refreshes overwrite meaningful rows.

### Decision 3: Separate incomplete source evidence from authoritative removal

Incomplete sources such as timeout, partial catalog, startup first page, or native listing error can add/update rows but cannot remove previously stable in-scope rows. Removal requires archive, hidden, delete/not-found, control-plane filter, or workspace-out-of-scope evidence.

Alternative: treat every latest refresh as authoritative.

- Rejected because transient listing failures are common and directly cause disappearing sidebar rows.

### Decision 4: Keep backend adjustment narrow

If Claude subagent metadata is the source of `Agent N`, only sanitize generic display metadata before it becomes a summary title. Do not change transcript parsing or native storage format unless needed by tests.

## Risks / Trade-offs

- [Risk] Projection helper duplicates some existing merge rules during migration.  
  Mitigation: route existing helpers through it and delete replaced logic in the same change.

- [Risk] Over-preserving last-good rows could keep a row after true deletion.  
  Mitigation: authoritative filters remain hard removals and are covered by tests.

- [Risk] Pending/finalized identity is ambiguous with multiple pending Claude sessions.  
  Mitigation: do not invent a visible finalized `Agent N` row when alias evidence is insufficient; wait for explicit mapping or native truth.

- [Risk] Rust subagent metadata filtering could hide useful agent names.  
  Mitigation: only classify ordinal generic names like `Agent 202` as weak; meaningful `agentName` values remain eligible.

## Migration Plan

1. Add OpenSpec delta and tasks.
2. Add projection helper and targeted unit tests.
3. Route Claude sidebar continuity/title merge through the helper.
4. Tighten pending/finalized fallback so ambiguous Claude finalization does not create generic visible rows.
5. Add narrow Rust test/fix if generic subagent metadata produces `Agent N`.
6. Run focused Vitest, focused Rust tests if touched, and `npm run typecheck`.

Rollback strategy: revert the helper integration while keeping the tests as failing repros; no persisted data migration is introduced.

## Open Questions

- Whether `Agent N` in the screenshot comes primarily from frontend fallback rows, Claude subagent metadata, or both. The implementation should cover both without broadening the runtime scope.
