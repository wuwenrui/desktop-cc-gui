# Split AppShell Performance Boundaries

## Goal

继续推进 OpenSpec change `split-app-shell-performance-boundaries`，降低 AppShell startup eager code，并收敛 core shell 的 TypeScript suppression。

## Requirements

- 保持 active thread、sidebar、composer basic input、runtime notices 仍为 eager。
- 不把整页 shell 包进 Suspense；lazy boundary 只放在 feature pane / modal / low-frequency controller 周围。
- 继续评估 inactive feature controllers，只有行为允许时才移动到 lazy boundary。
- 清理 core shell `@ts-nocheck`，优先处理已抽出的 section 文件，避免一次性重写 `src/app-shell.tsx`。
- 保留并扩展 lazy boundary guard tests。

## Acceptance Criteria

- [x] Low-frequency views 已通过 `src/app-shell-parts/lazyViews.tsx` lazy-load。
- [x] `src/app-shell-parts/useAppShellLayoutNodesSection.tsx` 已移除 file-level `@ts-nocheck`。
- [x] `src/app-shell-parts/useAppShellSearchAndComposerSection.ts` 已移除 file-level `@ts-nocheck`。
- [x] Eligible inactive feature controllers moved behind lazy boundaries or explicitly re-scoped with reason。
- [x] Remaining core-shell `@ts-nocheck` debt resolved or explicitly split into follow-up with evidence。
- [x] `npm run typecheck` passes。
- [x] `npm run lint` passes。
- [x] Focused AppShell lazy/type cleanup tests pass。
- [x] `openspec validate split-app-shell-performance-boundaries --strict --no-interactive` passes。

## Technical Notes

- `src/app-shell.tsx`、`src/app-shell-parts/useAppShellLayoutNodesSection.tsx`、`src/app-shell-parts/useAppShellSearchAndComposerSection.ts` 已移除 file-level `@ts-nocheck`。
- `src/features/update/hooks/useReleaseNotes.ts` 已把 `CHANGELOG.md?raw` 从 startup static import 改为 open-time dynamic import。
- 其余 React hook/controller 模块保持 eager；原因是 hooks 不能按条件动态 import 后再调用，否则会破坏 React hook ordering。
