# Tasks / 任务

## Implementation / 实施

- [x] 新增 `scripts/bundle-budget.config.json`，包含 schemaVersion、groups、targets、hardFail thresholds、rollout mode。
- [x] 扩展 `scripts/check-bundle-chunking.mjs`，从 `dist/assets` 计算 raw/gzip sizes。
- [x] 保留现有 manual chunk existence checks。
- [x] 支持 `App-*.js`、`App-*.css`、`vendor-mermaid`、`vendor-codemirror`、`vendor-docs`、total js/mjs/css matching。
- [x] 输出 actionable offender rows：actual、target、hardFail、mode、matched files。
- [x] heavy optional eagerness 必须输出 measured/fail/not-measured 状态。

## Validation / 验证

- [x] 运行 `npm run build`。
- [x] 运行 `npm run check:bundle-chunking`，确认 advisory/fail behavior。
- [x] 运行 `openspec validate enforce-bundle-budget-gate --strict --no-interactive`。
