# Tasks / 任务

## Planning / 规划

- [x] Inventory `src/bootstrapApp.tsx`、client storage preload、localStorage migration、input history init、i18n init、App import ordering。
- [x] 分类每个 startup step：must-block-render、can-run-in-parallel、post-render。
- [x] 确认 current language source 与 fallback-language behavior。

## Implementation / 实施

- [x] 更早启动 `import("./App")`，并与安全的 bootstrap work 并行。
- [x] Startup 只加载 stored/current locale。
- [x] Language switch 或 deterministic fallback path 再加载 alternate locale。
- [x] Composer 可 empty history render 时，将 input history restore 移到 shell mount 后。
- [x] localStorage migration 在不影响 initial correctness 时改为 background/best-effort。
- [x] 保留 critical failure 的 bootstrap fallback 与 ErrorBoundary behavior。
- [x] 增加 proposal 中列出的 startup trace milestones。
- [x] development/performance build 中输出 startup timing diagnostics，且不包含用户内容。

## Validation / 验证

- [x] 增加/更新 dynamic locale startup 与 language switch tests。
- [x] 增加/更新 bootstrap sequencing 或 startup trace utility tests where feasible。
- [x] 手动验证 startup、renderer-ready、composer typing、input history hydration。
- [x] 运行 `npm run typecheck`。
- [x] 运行 `npm run lint`。
- [x] 运行 `openspec validate parallelize-bootstrap-locale-loading --strict --no-interactive`。
