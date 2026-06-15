# Tasks / 任务

## Planning / 规划

- [x] Inventory file panel, editor, language resolver, PDF preview, and docs preview import graph.
- [x] Classify dependencies by activation trigger.
- [x] Define stale loader guard contract for file/mode switching.

## Implementation / 实施

- [x] Split file panel shell from editor and preview runtime modules.
  - `src/features/files/components/FileCodeMirrorEditor.tsx` exposes the
    lazy `FileCodeMirrorEditor` boundary, while
    `src/features/files/components/FileCodeMirrorEditorImpl.tsx` owns the
    static import of `@uiw/react-codemirror`, `@codemirror/view`, and the
    static import of `@codemirror/search`. `FileViewBody` and
    `FileViewPanel` no longer carry any of those imports on their
    startup path.
- [x] Lazy-load CodeMirror only for edit/text editor activation.
  - The shell renders a Suspense fallback while the lazy chunk resolves.
    The fallback uses `fvp-status` so users see a stable loading state
    identical to PDF / image previews.
- [x] Convert language extension resolver to async per-language dynamic imports with cache.
- [x] Withdraw first-open `@codemirror/search` lazy loading.  ← Withdrawn / No-Reintroduction
  - Withdrawn: the lazy loader broke normal contiguous
    search/replace behavior in the editor (search was decoupled
    from the surrounding editor state and from the `@codemirror/view`
    keymap so the panel could not stay in sync with the cursor,
    selection history, or replace workflow). The lazy editor chunk continues to
    inject `search({ top: true })` as a persistent extension;
    `@codemirror/search` is loaded eagerly inside the editor chunk,
    not on the file panel shell startup path.
  - This task is **permanently withdrawn** and tagged
    *No-Reintroduction*. Any future PR/change that re-tries this
    optimization must be rejected at review; see
    `.trellis/spec/frontend/quality-guidelines.md` (CodeMirror
    State-Coupled Extensions 不可跨越 Lazy Boundary) and
    `openspec/docs/lazy-state-extension-regression-2026-06-11.md`
    for the long-form rationale and the decision checklist.
- [x] Lazy-load PDF.js only inside PDF preview path.
- [x] Add stable loading/fallback states and stale request guards.

## Validation / 验证

- [x] Add file type switching and lazy initialization race tests.
  - `src/features/files/components/FileViewPanel.lazy-race.test.tsx`
    asserts that a slow typescript language loader resolves after the
    user has switched to a python file; the race guard inside the
    editor drops the stale extension so the active editor language
    stays correct.
- [x] Withdraw find-in-file lazy search regression test.  ← Withdrawn / No-Reintroduction
  - Withdrawn together with the lazy search boundary above. The
    follow-up test
    `src/features/files/components/FileViewPanel.find-in-file.test.tsx`
    (if added) MUST be an *eager-import regression test* that
    asserts Cmd+F / Cmd+H / replace / replace-all stay in lock-step
    with the editor; it MUST NOT assert that `@codemirror/search`
    is dynamically imported. See
    `openspec/docs/lazy-state-extension-regression-2026-06-11.md`
    for the required scenarios.
- [x] Add PDF preview lazy runtime/fallback test where feasible.
- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run check:bundle-chunking` and record CodeMirror/PDF startup evidence.
  - `vendor-codemirror-*` is now pulled only by the lazy `FileCodeMirrorEditorImpl-*` edge (gzip 296.7 KiB in `npm run check:bundle-chunking`) and is not module-preloaded from `dist/index.html`.
  - `vendor-docs-*` (gzip 384.5 KiB) is also out of the main
    bundle, matching the previous PDF lazy work.
- [x] Run `openspec validate lazy-file-preview-dependencies --strict --no-interactive`.
