# Tasks / 任务

## Planning / 规划

- [x] Inventory AppShell static imports and classify each dependency by startup policy.
- [x] Identify critical shell / always-on runtime dependencies that must remain eager.
- [x] Identify `@ts-nocheck` blockers and define typed boundary follow-up scope.

## Implementation / 实施

- [x] Move inactive tab/view components behind lazy feature entries: Kanban, Git History, SpecHub, WorkspaceHome, Search Palette, Release Notes.
- [x] Keep active thread, sidebar, composer basic input, and runtime notices eager.
- [x] Move inactive feature controllers behind lazy boundaries where behavior allows it.
- [x] Remove `@ts-nocheck` from core shell files using explicit TypeScript contracts.
- [x] Add import boundary guard for heavy optional feature modules.
- [x] Keep `Suspense` scoped to feature panes/modals, not the full shell.

## Validation / 验证

- [x] Run focused AppShell render/lazy boundary tests.
- [x] Run `npm run typecheck`.
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `npm run check:bundle-chunking` and record `App-*.js` gzip delta.
- [x] Run `openspec validate split-app-shell-performance-boundaries --strict --no-interactive`.
