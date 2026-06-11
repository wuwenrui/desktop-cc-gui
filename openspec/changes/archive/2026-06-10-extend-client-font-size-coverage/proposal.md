## Why

The current appearance settings expose UI scale, UI font family, code font family, and code font size, but the effective coverage of the font-size preference is too narrow. In practice, changing code font size mostly affects code-like surfaces such as code blocks and diff content, while many client views still use fixed `px` font sizes.

This creates a mismatch with user expectations: the font-size setting should affect readable client content across the main canvas and client-visible work surfaces, including file/folder views and Git worktree views. Today those areas can remain visually unchanged because their typography is defined by local hard-coded values or incomplete CSS variable mappings.

The product needs a clear content-typography contract so font-size preferences apply consistently without turning every icon, hit target, or layout dimension into a scaled element.

## What Changed

This change will extend the client font-size preference coverage by:

- defining a shared set of client typography CSS variables derived from the persisted font-size setting;
- applying those variables to readable text in the main canvas, file/folder surfaces, detached file explorer, Git worktree file trees, diff/file preview metadata, and other client-visible text surfaces where practical;
- preserving UI scale as the separate whole-window zoom control;
- preserving fixed dimensions for interaction hit targets, icons, layout gutters, and density-sensitive controls unless they are text-specific;
- ensuring detached/client windows receive the same typography variables as the main window;
- adding focused regression coverage for token injection and high-value surfaces.

## Non-Goals

- Do not replace global UI scale or change its supported range.
- Do not scale all pixel values globally.
- Do not change backend, Tauri command signatures, runtime event schemas, file tree data, Git data, or persistence format beyond existing settings usage.
- Do not redesign file tree, Git worktree, diff viewer, or message layout.
- Do not make icon sizes, button hit targets, panel widths, or row density automatically follow font size unless needed for text legibility.
- Do not introduce a new dependency.

## Impact

### Affected frontend areas

- `src/features/app/hooks/useCodeCssVars.ts`
- app shell and detached window style variable injection
- appearance settings copy/tests where needed
- file tree and detached file explorer styles
- Git history/worktree and shared git filetree typography variables
- file view / diff metadata styles where currently tied to fixed text sizes
- focused CSS/token tests and existing settings tests

### API / dependency impact

- No Rust/Tauri command signature change.
- No backend storage schema change.
- No new package dependency.
- Existing persisted `codeFontSize` can remain the source setting unless implementation chooses a backwards-compatible alias/name clarification.

### Product impact

- Changing the font-size preference visibly affects more readable client surfaces.
- Main window and detached client windows stay typographically aligned.
- File/folder and Git worktree text no longer drift away from the selected content font size.
- Layout remains usable at minimum and maximum supported font sizes.

## Acceptance Criteria

- Font-size preference changes are reflected in readable text across chat/main canvas, file/folder tree views, Git worktree file trees, diff/file metadata, and detached file explorer windows.
- UI scale remains a separate global zoom setting and continues to apply immediately after save.
- Code-like text continues to use the configured code font family.
- UI text continues to use the configured UI font family.
- Fixed interaction geometry, icons, and panel layout are not unintentionally scaled by text-size tokens.
- Main and detached windows expose the same typography CSS variable contract.
- Focused tests verify typography variable injection and at least file tree / Git worktree token usage.
