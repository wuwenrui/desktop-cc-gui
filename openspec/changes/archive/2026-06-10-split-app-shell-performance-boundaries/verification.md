# Verification / 验证

## Scope / 范围

This pass implements the first executable slice of `split-app-shell-performance-boundaries`: low-frequency view components are moved out of AppShell static imports and into `React.lazy` boundaries. It does not yet remove all AppShell `@ts-nocheck` debt or lazy-load inactive controllers.

## Commands / 命令

- `npx vitest run src/app-shell-parts/appShellLazyBoundaries.test.ts` passed, 2 tests.
- 2026-06-10 rerun: `npx vitest run src/app-shell-parts/appShellLazyBoundaries.test.ts src/app-shell-parts/useAppShellLayoutNodesSection.test.ts src/app-shell-parts/useAppShellLayoutNodesSection.recovery.test.ts` passed, 27 tests.
- 2026-06-10 rerun: `npx vitest run src/app-shell.startup.test.tsx src/app-shell-parts/appShellLazyBoundaries.test.ts src/app-shell-parts/useAppShellWorkspaceFlowsSection.test.tsx src/app-shell-parts/useAppShellLayoutNodesSection.test.ts src/app-shell-parts/useAppShellLayoutNodesSection.recovery.test.ts` passed, 42 tests.
- 2026-06-11 rerun: `npx vitest run src/app-shell.startup.test.tsx src/app-shell-parts/appShellLazyBoundaries.test.ts src/app-shell-parts/useAppShellWorkspaceFlowsSection.test.tsx src/app-shell-parts/useAppShellLayoutNodesSection.test.ts src/app-shell-parts/useAppShellLayoutNodesSection.recovery.test.ts src/features/update/hooks/useReleaseNotes.test.ts` passed, 48 tests.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run build` passed.
- `npm run check:bundle-chunking` passed.
- `openspec validate split-app-shell-performance-boundaries --strict --no-interactive` passed.

## Bundle Evidence / Bundle 证据

Latest production build emitted separate lazy chunks for low-frequency surfaces:

- `KanbanView-DUhMjupZ.js`: gzip `16.24 KiB`.
- `SpecHub-BxV7Cuji.js`: gzip `39.01 KiB`.
- `GitHistoryPanel-lBPQEbel.js`: gzip `51.94 KiB`.
- `SettingsView-D21h00DJ.js`: gzip `98.01 KiB`.
- `WorkspaceHome-2VSw0XFu.js`: gzip `2.99 KiB`.
- `SearchPalette-CMpH3j-N.js`: gzip `1.90 KiB`.
- `ReleaseNotesModal-DAq_fOVi.js`: gzip `1.19 KiB`.
- 2026-06-11 follow-up build also emitted `CHANGELOG-KVWKkkBD.js`: gzip `89.11 KiB`, proving release notes markdown data is no longer in the startup `App` chunk.

`App-*.js` latest production gzip is `1,125.59 KiB` (`1.07 MiB` in bundle gate output). Previous post-CSS-split bundle gate evidence was about `1.30 MiB`, and the first AppShell view-boundary slice recorded `1,223.70 KiB`, so this change produced another measurable main app decrease. It remains above advisory target `927.7 KiB` and hard-fail threshold `1.05 MiB` in advisory rollout mode.

## Boundary Evidence / 边界证据

- `src/app-shell-parts/lazyViews.tsx` owns the statically analyzable dynamic imports for the low-frequency views.
- `src/app-shell.tsx` no longer statically imports `KanbanView`, `GitHistoryPanel`, `WorkspaceHome`, `SpecHub`, `SearchPalette`, or `ReleaseNotesModal`.
- `src/app-shell-parts/renderAppShell.tsx` imports these surfaces only from `lazyViews` and wraps feature-local nodes in `Suspense fallback={null}`.
- `src/app-shell-parts/appShellLazyBoundaries.test.ts` guards against direct static re-imports from `app-shell.tsx` and `renderAppShell.tsx`.
- 2026-06-10 follow-up: `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` no longer uses file-level `// @ts-nocheck`; the section destructures only the ctx fields it consumes and adds local callback parameter types for TypeScript strict mode.
- 2026-06-10 follow-up: `src/app-shell-parts/useAppShellSearchAndComposerSection.ts` no longer uses file-level `// @ts-nocheck`; its existing boundary type now includes `activeEditorFilePath` and search result selection narrows workspace/thread ids before navigation.
- 2026-06-10 follow-up: `src/app-shell.tsx` no longer uses file-level `// @ts-nocheck`; stale imports were removed and the typed section boundaries now cover AppShell startup, search/composer, workspace flow, restore, refresh, and layout-node integration.
- 2026-06-11 follow-up: `src/features/update/hooks/useReleaseNotes.ts` no longer statically imports `CHANGELOG.md?raw` at module load. The release notes controller now loads changelog markdown through a statically analyzable dynamic import only when release notes open or auto-version check decides to open them.
- 2026-06-11 follow-up: `src/app-shell-parts/appShellLazyBoundaries.test.ts` now guards both lazy view imports and the release notes changelog data boundary.

## Remaining Work / 剩余工作

- React hook/controller modules that manage critical shell state remain eager because hooks cannot be conditionally imported and called without breaking React hook ordering. The eligible inactive controller payload found in this pass was release notes changelog data, which is now deferred.
- Manual visual QA is still recommended for first-open Kanban, Git History, SpecHub, WorkspaceHome, Search Palette, and Release Notes before release sign-off.

## Notes / 说明

- `npm run build` still reports the existing Vite warning that `FileViewPanel.tsx` is both dynamically and statically imported. That belongs to `lazy-file-preview-dependencies`, not this AppShell view-boundary slice.
- `npm` still prints existing `electron_mirror` config warning. Commands pass; this change does not handle npm config hygiene.
