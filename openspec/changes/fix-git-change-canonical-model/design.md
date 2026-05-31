## Context

Git Diff panel currently receives repository facts from multiple sources:

- `getGitStatus()` returns aggregate `files`, plus section-scoped `stagedFiles` and `unstagedFiles`.
- `getGitDiffs()` returns preview diff entries and media metadata.
- `getGitFileFullDiff()` returns full-context diff for a selected file.

The current UI largely treats the status list as the file-list truth and uses diff entries as content payloads. This keeps existing Git actions simple, but it allows fact-source drift: a path present in diff evidence can be dropped when absent from status evidence. Issue #642 exposes two symptoms of that drift: added files can be missing from the visible change list, and deleted files do not carry strong deleted-state presentation.

The implementation must also stay compatible with:

- Local desktop mode.
- Remote daemon mode.
- Web Service entry points that receive equivalent Git payloads through web-facing APIs.
- Windows, macOS, and Linux behavior.
- `.github/workflows/large-file-governance.yml`, which runs large-file parser tests, near-threshold watch, and hard-debt gate across `ubuntu-latest`, `macos-latest`, and `windows-latest`.

## Goals / Non-Goals

**Goals:**

- Introduce a frontend canonical Git change projection consumed by Git Diff panel list/viewer flows.
- Preserve status-derived entries and existing action semantics as the primary behavior.
- Add diff-derived fallback entries when diff evidence proves a path exists but status evidence omits it.
- Keep the projection pure, deterministic, and platform-neutral.
- Preserve local, remote daemon, and Web Service response compatibility when optional `GitFileDiff.status` is absent.
- Make deleted file rows visually explicit without changing selection, preview, stage, unstage, discard, or commit inclusion behavior.
- Keep implementation files small enough to satisfy large-file governance.

**Non-Goals:**

- Replacing backend Git status/diff implementation.
- Changing `getGitStatus`, `getGitDiffs`, or `getGitFileFullDiff` required response shape.
- Reworking partial staging, rename detection, PR diff, commit history diff, or branch compare semantics.
- Introducing a new dependency.
- Adding OS-specific shell validation or path logic.

## Decisions

### Decision 1: Add a pure canonical projection layer

Create a focused frontend utility, for example `src/features/git/utils/gitChangeModel.ts`, that accepts status and diff inputs and returns section-aware canonical entries.

Canonical entry shape should include:

- normalized `path`
- display `path`
- `status`
- `section` or section membership
- additions/deletions
- preview `diff`
- binary/image metadata
- source flags such as `fromStatus`, `fromDiff`, `statusInferred`

Alternatives considered:

- Patch `useGitDiffs` inline only. Rejected because it keeps reconciliation logic inside a hook and makes future drift likely.
- Backend-only status enrichment. Rejected as a sole fix because local/remote/web callers can still return mixed payload generations, and UI still needs reconciliation.

Rationale:

The projection gives one explicit place for path normalization, fallback status inference, duplicate resolution, and media metadata preservation.

### Decision 2: Status evidence remains authoritative

If a path exists in `stagedFiles` or `unstagedFiles`, the canonical entry must preserve that section and status. Diff evidence fills content and metadata but must not rewrite existing section state.

Alternatives considered:

- Let diff entries override status entries. Rejected because diff entries may be truncated, may lack staging semantics, and may come from older daemon/web payloads.
- Collapse staged and unstaged same-path entries. Rejected because current UI has section-scoped actions and commit inclusion semantics.

Rationale:

This preserves existing correct behavior and avoids accidental changes to Git operations.

### Decision 3: Diff fallback is display-only until status catches up

When a diff entry has no status-derived match, the projection may synthesize a visible entry. It should infer status from optional `GitFileDiff.status` first, then diff headers:

- `new file mode` or `--- /dev/null` implies `A`
- `deleted file mode` or `+++ /dev/null` implies `D`
- otherwise fallback to `M`

Fallback entries should be renderable and previewable, but destructive/staging actions must remain guarded by existing action wiring and path validation.

Diff-only fallback entries must be preview-only unless section state is confirmed by status evidence. They may open diff review, focus the viewer, and participate in non-mutating display, but they must not expose stage, unstage, discard, or commit inclusion mutation controls while their section is inferred only from diff evidence.

Alternatives considered:

- Hide unmatched diff entries. Rejected because this is the issue being fixed.
- Enable all actions for unmatched diff entries unconditionally. Rejected because section state may be unknown.

Rationale:

The user sees complete evidence without changing existing mutation semantics.

### Decision 4: Optional backend status is forward-compatible only

TypeScript may accept `GitFileDiff.status?: string`. Rust can later return optional status from local and daemon commands. The frontend must not require it.

Alternatives considered:

- Require backend status immediately. Rejected because it risks local/daemon/Web Service version skew.
- Avoid backend status forever. Rejected because backend-derived status is cleaner when available.

Rationale:

Optional status supports gradual compatibility without breaking old payloads.

### Decision 5: Normalize paths as Git display paths, not platform paths

Projection must normalize `\` to `/` for identity comparison, preserve original display path where useful, trim duplicate separators conservatively, and never call OS-specific path APIs for repository-relative Git paths.

Line statistics must handle CRLF and LF consistently by splitting on `\n` and stripping a trailing `\r` only for classification.

Alternatives considered:

- Use Node `path` utilities. Rejected because `path.win32`/`path.posix` behavior can create platform drift in browser-like test environments.
- Treat paths as opaque strings. Rejected because Windows-style separators would fail to merge with Git slash paths.

Rationale:

Git paths are repository-relative logical paths; the UI should not reinterpret them as local filesystem paths.

### Decision 6: Separate identity keys by UI responsibility

Canonical projection must use different keys for different responsibilities:

- List row identity: `section + normalizedPath`
- Viewer diff identity: `normalizedPath`
- Mutation action identity: `section + normalizedPath + operation`

Alternatives considered:

- Use only `normalizedPath` everywhere. Rejected because staged and unstaged same-path rows would collapse.
- Include section in viewer identity. Rejected because viewer content is path-centric and should not duplicate identical file content solely due to section.

Rationale:

This avoids selection/action ambiguity while preserving section-scoped Git operations.

### Decision 7: Web Service consistency is a projection contract

Web-facing payloads should continue using existing Git status/diff shapes. The browser/client side should apply the same canonical projection after receiving payloads, instead of adding Web-only reconciliation logic.

Minimum payload handling:

- Missing `path`: discard the entry and emit a diagnostic in existing error/diagnostic channels where available.
- Missing `status`: tolerate and infer only when diff evidence supports it.
- Missing `diff`: allow status-derived rows but do not synthesize diff-only fallback rows.
- Missing media metadata: preserve text diff behavior and leave media preview unavailable.

Alternatives considered:

- Add a Web Service-specific endpoint for canonical changes. Rejected for this change because it adds backend/API scope and risks divergence.
- Keep Web Service on status-only display. Rejected because it would preserve the same correctness gap.

Rationale:

One frontend projection keeps local desktop, remote daemon, and Web Service UI behavior aligned.

### Decision 8: Large-file governance shapes file layout

Implementation should add small pure utilities and focused tests instead of expanding existing large React components. Avoid broad rewrites of `GitDiffPanel` or `GitDiffViewer`.

Alternatives considered:

- Put projection in `useGitDiffs`. Rejected for governance and reuse reasons.
- Refactor the full Git panel into smaller components first. Rejected as too broad for this issue.

Rationale:

The workflow `.github/workflows/large-file-governance.yml` already gates parser tests, near-threshold watch, and hard-debt on all three OS runners. This change must not add large-file debt while fixing behavior.

## Risks / Trade-offs

- [Risk] Fallback diff entries may have incomplete additions/deletions because preview diffs can be truncated. → Mitigation: preserve status stats when available; mark diff-derived stats as best-effort; avoid using them for mutation decisions.
- [Risk] Diff-only fallback entries can accidentally expose destructive controls. → Mitigation: enforce preview-only behavior until status evidence confirms section state; add tests that mutation controls are absent for diff-only fallback rows.
- [Risk] Same path in staged and unstaged sections may be accidentally collapsed. → Mitigation: key canonical entries by `section + normalizedPath` for section-scoped lists and test dual-state behavior.
- [Risk] Optional backend status can create mixed-generation payloads. → Mitigation: frontend fallback must work when `status` is absent; tests cover both shapes.
- [Risk] Windows path separators or CRLF diffs can produce mismatched identities/stats. → Mitigation: pure projection tests include Windows-style paths, POSIX paths, file names with spaces, CRLF, and LF.
- [Risk] Deleted styling can reduce readability or break focus affordances. → Mitigation: styling applies to textual file identity only; selected/active/hover/focus states keep existing contrast and controls.
- [Risk] Web Service behavior can drift if it bypasses the projection. → Mitigation: route all Git panel list/viewer inputs through the same utility regardless of source mode.
- [Risk] Large files become larger. → Mitigation: add small utility/test files; keep component changes thin; run the large-file governance commands during final validation.
- [Risk] Rename-only diff evidence is misclassified as modified. → Mitigation: detect `rename from` / `rename to` headers as status `R` for fallback display without attempting deep rename pairing.

## Migration Plan

1. Add pure projection utility and unit tests without wiring it into UI.
2. Add optional `GitFileDiff.status?: string` type support while keeping old payload compatibility.
3. Wire `useGitDiffs` or Git panel data preparation through the projection while preserving current return shape.
4. Add deleted-state row attributes/classes and CSS.
5. Add focused component tests for visibility and action compatibility.
6. Optionally add Rust-side optional status in local and daemon `GitFileDiff` after frontend fallback exists.
7. Validate with typecheck, focused Vitest suites, and large-file governance commands.

Backend status decision:

- The first implementation batch defers Rust-side optional status emission. Frontend accepts `GitFileDiff.status?: string` now, but local/daemon/Web payloads remain compatible when the field is absent.
- A follow-up can add Rust status only after frontend fallback and tests prove compatibility across old payloads.

Rollback strategy:

- Revert the UI wiring to previous `files.map(...)` behavior while keeping the pure utility unused.
- Optional `GitFileDiff.status` can remain because it is additive and ignored by old code.
- CSS deleted-state additions can be removed independently without affecting data projection.

## Implementation Review Record

The implementation keeps the architectural decision boundary from this design:

- Projection remains frontend-owned and source-agnostic.
- Backend `status` enrichment is deferred and optional.
- Diff-only fallback entries are intentionally preview-only because status evidence is absent.
- Mutation keys and list keys remain section-scoped; viewer keys remain path-scoped.
- Path handling treats Git paths as repository-relative logical paths, not local filesystem paths.

Review outcomes:

- Boundary handling: missing `path` is ignored, missing `status` is tolerated, missing `diff` cannot synthesize fallback, binary/image metadata is preserved.
- Cross-platform handling: backslash paths, slash paths, duplicate separators, paths with spaces, LF diffs, and CRLF diffs are covered by deterministic tests.
- Governance handling: `.github/workflows/large-file-governance.yml` equivalent commands passed; the implementation avoided expanding existing large components beyond thin wiring.
- Noise handling: `.github/workflows/heavy-test-noise-sentry.yml` equivalent command passed after stabilizing the slow documentation-window test timeout.

Untested caveat:

- No manual app-window smoke was executed during closure. The next human smoke should visually confirm deleted-row line-through and preview-only fallback rows in the Git panel.

## Open Questions

- Should unmatched diff fallback entries expose stage/discard controls immediately, or only preview/open controls until the next status refresh confirms section state?
- Should backend optional status be included in the first implementation batch or left as a follow-up after frontend compatibility is proven?
- Should diff-derived fallback entries display a subtle “derived from diff” diagnostic in development builds only?
