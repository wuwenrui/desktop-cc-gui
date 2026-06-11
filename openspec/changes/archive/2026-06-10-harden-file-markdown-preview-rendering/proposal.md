## Status

**Phase 1 complete** — current implementation evidence is recorded in `notes/phase-1-implementation-evidence.md`.

- Phase 1 renderer architecture, real file-view entrypoint routing, parser-derived outline, rich-path outline visibility, yn-style outline interactions, fallback, sanitizer, and validation evidence are complete.
- Optional Worker adapter is complete and remains file-preview scoped.
- Closure now depends on final validation / sync / archive process, not missing implementation scope.

---

## Why

File-view Markdown preview used to depend on a React-owned Markdown tree for the document body. That shape works for small documents, but it makes React reconciliation part of the hot path for long Markdown files with tables, code blocks, KaTeX, Mermaid, source-line annotations, and outline navigation.

The product needs a file-preview-specific reading surface with stronger boundaries:

- document rendering must be tied to a stable file snapshot and content hash;
- same-content UI changes must not recompile or remount the Markdown body;
- large documents need deterministic bounded rendering instead of machine-local timing decisions;
- outline navigation should come from parser/source metadata, not repeated mounted-DOM scans;
- unsafe HTML must fail closed inside the file-preview boundary.

Yank Note (`yn`) provides the architectural reference: compile Markdown into a document surface, keep parser-derived outline/source metadata, and handle interaction through local islands/delegated events. This change adopts that boundary for mossx file preview without importing the full `yn` plugin ecosystem.

## What Changed

### Renderer architecture

- Added a file-preview fast Markdown renderer pipeline that compiles Markdown into sanitized HTML plus structured metadata.
- Kept `rich-react` as the default and reversible fallback profile.
- Added deterministic renderer profiles: `rich-react`, `fast-html`, `bounded-fast-html`, and `low-cost-readable`.
- Kept selection based on document metrics and explicit rollout flags, not local timing.
- Preserved message/chat Markdown isolation; message surfaces are not migrated to the file renderer.

### Real file-view integration

- Routed the real Markdown file-preview entrypoint through `FileMarkdownPreviewFast`.
- Kept default behavior as `rich-react` unless explicit fast-renderer rollout flags are enabled.
- Preserved config-level rollback by disabling fast-renderer flags.
- Forwarded rich renderer props through the wrapper so fallback preserves existing annotation, marker, and render-pressure behavior.
- Added a preview-only large Markdown read path: normal editable file reads remain capped at 400 KB, while Markdown preview can fetch up to 4 MB and then rely on bounded/fast rendering.

### Outline / Toc

- Added parser-derived outline generation from Markdown heading/source metadata.
- Made outline visible in the default `rich-react` path, not only in the fast HTML path.
- Added heading anchors for rich-path navigation and fast-path navigation.
- Added yn-style outline interactions: collapse/expand, branch folding, pinning, unpinned auto-collapse, and repeated activation of the same item.

### Interaction and fallback boundaries

- Fast HTML path supports source-line attributes, annotation-start affordances, table scroll wrappers, link delegation, diagnostics, and fail-closed fallback.
- Existing rich file-preview path remains the parity source for annotation overlays and Mermaid Source/Render behavior while richer fast islands mature.
- Fast compile, sanitize, or hydration failures stay inside the file-preview renderer boundary and fall back to readable file preview.
- Unsafe unsanitized HTML is never mounted.

### Validation and evidence

- Implementation evidence records OpenSpec validation, focused renderer tests, focused file-preview tests, typecheck, lint, large-file check, dependency decision, diagnostics, fallback behavior, and sanitizer/security fixtures.
- No new dependencies were introduced; the implementation reuses existing unified / rehype / DOMPurify / KaTeX / Mermaid ecosystem packages already present in the project.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `file-markdown-preview-render-architecture`
  - Defines stable document snapshots, compile cache identity, heavy-block lifecycle isolation, deterministic large-document profiles, fast sanitized document rendering, parser-derived outline, and Worker-ready compile boundaries.

- `file-view-markdown-github-preview`
  - Preserves GitHub-style file-preview semantics while allowing sanitized HTML document output, dedicated file-view renderer routing, file-view-scoped styling, parser-derived outline navigation, stable large-document behavior, and readable fail-closed fallback.

## Functional Closure Boundary

This change closes the Phase 1 product behavior when all of the following are true:

- Markdown files opened from the file tree route through the dedicated file-preview wrapper.
- Default `rich-react` behavior remains available and unchanged unless fast-renderer rollout flags are enabled.
- Fast renderer can be explicitly enabled and reports profile/cache/fallback diagnostics.
- Parser-derived outline is available in both default rich path and fast path.
- Outline interactions match the intended yn-style behavior.
- Same-content UI updates do not invalidate the compiled document identity.
- Sanitizer/security fixtures prove unsafe HTML and unsafe URLs are stripped or forced into fallback.
- Large-document strategy is selected by deterministic metrics and flags.
- Truncated editable Markdown files can still receive a larger preview-only snapshot without enabling save/edit on partial content.
- Message Markdown remains isolated.

Worker execution is now included as an optional Phase 1 adapter. The adapter uses the same pure compile request/result contract, falls back to main-thread compile when Worker construction or transport fails, and prevents stale Worker responses from overwriting newer preview snapshots.

## Non-Goals

- Do not migrate chat/message Markdown, Spec Hub Markdown, release notes, or other message-based surfaces.
- Do not import the full `yn` plugin ecosystem.
- Do not add macro/code-run/mindmap/drawio/luckysheet style Markdown extensions.
- Do not change Tauri file-read, file-sync, or storage backend contracts.
- Do not make machine-local timing the primary renderer strategy selector.
- Do not let Worker adapter behavior escape the file-preview renderer boundary.

## Rollout / Fallback Contract

- Default profile remains `rich-react`.
- Fast profiles require explicit rollout gates:
  - `VITE_MOSSX_FILE_MARKDOWN_FAST_HTML=true`
  - `VITE_MOSSX_FILE_MARKDOWN_BOUNDED_FAST_HTML=true`
  - `localStorage.mossx.fileMarkdownFastHtml=true`
  - `localStorage.mossx.fileMarkdownBoundedFastHtml=true`
- `rich-react` must remain a forced fallback profile.
- `fast-html` and `bounded-fast-html` must be observable through diagnostics or data attributes.
- Fast renderer compile, sanitize, or hydration failure must fail closed to file-preview fallback.
- Worker construction or transport failure must fall back to the existing main-thread fast compile path before renderer fallback is considered.
- Stale Worker responses must not update preview state after a newer Markdown snapshot has been requested.
- Fallback must not route to message Markdown.
- Rollback must be possible by disabling flags or routing the file-view entrypoint directly back to the rich preview path.

## Security Definition of Done

- Sanitizer uses a file-preview-scoped allowlist.
- Event handler attributes such as `onclick`, `onerror`, and `onload` are stripped.
- Unsafe URL schemes such as `javascript:`, `vbscript:`, and unsafe `data:` uses are stripped or rejected.
- Raw HTML handling remains explicit and file-preview scoped.
- File/local resource opening remains behind existing file-link and external URL policies.
- Sanitizer failure never mounts unsafe HTML and must use fallback.
- Regression fixtures cover raw HTML, unsafe links, inline event attributes, task lists, tables, code, math, Mermaid placeholders, CJK headings, duplicate headings, and sanitizer fallback.

## Impact

### Affected frontend areas

- `src/features/files/components/FileViewBody.tsx`
- `src/features/files/components/FileViewPanel.tsx`
- `src/features/files/components/FileMarkdownPreviewFast.tsx`
- `src/features/files/components/FileMarkdownPreview.tsx` through wrapper/fallback integration, not as the fast renderer implementation owner
- `src/features/files/components/PreviewOutlineSidebar.tsx`
- `src/features/markdown/fastMarkdownRenderer/**`
- File-preview Markdown styles under `src/styles/**`
- Focused tests under `src/features/files/components/__tests__/**` and `src/features/markdown/fastMarkdownRenderer/__tests__/**`

### API / dependency impact

- No Tauri command signature change.
- New preview-only Tauri command: `read_workspace_file_preview`, scoped to file preview and using a larger read budget.
- No backend storage format change.
- No message Markdown API change.
- No new package dependency.

### Product impact

- Markdown file preview becomes a guarded document-renderer surface.
- Default user behavior remains rich file preview unless rollout flags are enabled.
- Outline becomes a file-preview reading feature, not a fast-renderer-only affordance.
- Failure modes remain local and readable.

## Acceptance Criteria

- Large Markdown preview remains readable and interactive under deterministic render budgets.
- File-view Markdown uses the dedicated file-preview renderer boundary.
- Fast renderer can mount sanitized HTML without React owning every Markdown node.
- Same-content annotation, outline, hover, and localized-label changes do not recompile or remount the Markdown body.
- Mermaid, table scroll, annotation state, code readability, KaTeX behavior, and links retain file-preview semantics or fail closed to rich fallback.
- Outline entries are parser-derived, source-line stable, duplicate-safe, CJK-safe, and navigable.
- Outline interactions support collapse/expand, pinning, unpinned auto-collapse, branch folding, and repeated selection.
- Sanitizer failures and unsafe input never mount unsafe HTML.
- Renderer diagnostics expose profile, cache identity, status, fallback reason, heading count, heavy-block count, and truncation state.
- Chat/message Markdown surfaces remain visually and structurally unchanged.

## Closure Calibration

Current readout:

- OpenSpec schema artifacts are complete: proposal, design, specs, and tasks exist.
- OpenSpec progress should report `35/35` tasks complete after this writeback.
- All Phase 1 implementation, revalidation, outline backfill, and optional Worker adapter tasks are complete.
- Worker execution remains optional at runtime and scoped to file-preview fast Markdown compile.
- Evidence confirms the compile result is JSON-serializable, has a non-DOM sanitizer fallback, stale Worker responses cannot overwrite newer preview state, and preview-only large Markdown reads do not weaken editor truncation protection.

Closure decision:

- **Functionally closable for Phase 1**.
- **Archive readiness now depends on final validation and governance closeout**, not missing implementation tasks.

Recommended closeout action:

1. Run final OpenSpec validation.
2. Run focused Worker/hook and fast renderer tests if validation is requested.
3. If validation passes and no implementation drift is found, sync/archive this Phase 1 change.
