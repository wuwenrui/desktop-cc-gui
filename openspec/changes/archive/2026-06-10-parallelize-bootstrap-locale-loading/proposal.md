# parallelize-bootstrap-locale-loading

## Summary / 摘要

缩短 renderer pre-render critical path：并行启动 `App` import、critical store preload 与 current-locale i18n load；把 input history restore 与非关键 localStorage migration 后置到 shell mount 之后；startup 只加载当前 locale，不再静态导入所有 locale resources。

## Problem / 问题

roadmap 标出的当前 startup chain 是串行的：

```text
preloadClientStores
-> migrateLocalStorageToFileStore
-> initInputHistoryStore
-> import("./i18n")
-> import("./App")
-> render
-> markRendererReady
```

这意味着 storage preload、migration、input history、i18n、App module import 任意一步慢都会延迟 first render。另一方面，`src/i18n/index.ts` 静态导入 `en` 与 `zh`，即使 startup 只需要 stored/current language，也会把两个完整 locale resources 拉入启动路径。

## Goals / 目标

- 区分 `must-block-render`、`can-run-in-parallel`、`post-render` startup work。
- 让 `import("./App")`、critical store preload、current-locale load 尽早并行。
- Composer 可先以 empty history render，input history hydrate later。
- localStorage migration 若不影响 initial shell correctness，则作为 background/best-effort task。
- Startup 只加载 stored/current locale。
- Language switch 时再加载 target locale，并保持 `saveLanguage` behavior。
- 扩展 startup trace milestones，定位 delay source。

## Non-Goals / 非目标

- 不重写完整 Startup Orchestrator。
- 不改变 storage schema 或 migration 语义。
- 不删除 locale resources，不改变翻译文案。
- 不在本 change 处理 AppShell static surface lazy loading，那是独立 P0。

## Approach / 方案

1. Audit `src/bootstrapApp.tsx`、client storage preload、localStorage migration、input history init、i18n init、App import ordering。
2. 为每个步骤标注 phase：`must-block-render`、`can-run-in-parallel`、`post-render`。
3. 启动时并行触发 `import("./App")`、critical store preload、current-locale i18n load。
4. root render 只等待 critical subset。
5. input history restore 在 shell mount 后执行，完成后 hydrate composer history。
6. localStorage migration 默认后置；如果发现初始正确性依赖 migration，必须记录 blocking invariant。
7. 用 dynamic locale loader 替代 startup path 上的 dual-locale static imports。
8. 增加 startup trace milestones。

## Startup Milestones / 启动埋点

至少记录：

- `bootstrap:start`
- `storage:preload:start/end`
- `migration:start/end`
- `input-history:start/end`
- `i18n:start/end`
- `app-import:start/end`
- `root-render:start/end`
- `shell-ready`

## Risks / 风险

- migration 如果实际上影响 initial shell correctness，后置会暴露 stale state；必须用 invariant 判断，而不是默认移动。
- fallback locale 不在 startup 加载后，missing key behavior 仍需 deterministic。
- parallel promises 不能绕过现有 bootstrap fallback / ErrorBoundary。
- input history 后置不能破坏 hydration 完成后的 keyboard history behavior。

## Acceptance Criteria / 验收口径

- first render 不再等待非关键 input history restore。
- startup trace 能证明哪些任务被并行、哪些任务后置。
- startup module path 不再静态加载所有 supported locale resources。
- `zh <-> en` language switch 仍能更新文案且持久化设置。
- critical failure 仍走现有 bootstrap fallback / ErrorBoundary path。

## Validation / 验证

- Focused tests for bootstrap sequencing/startup trace utilities where feasible。
- Focused tests for dynamic locale startup、language switch、fallback behavior。
- Manual startup check：shell renders、renderer-ready emitted、composer works before/after history hydration。
- `npm run typecheck`
- `npm run lint`
- `openspec validate parallelize-bootstrap-locale-loading --strict --no-interactive`
