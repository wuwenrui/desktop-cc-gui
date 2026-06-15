# enforce-bundle-budget-gate

## Summary / 摘要

把现有 `check:bundle-chunking` 从“只检查 manual chunk 是否存在”升级为 `bundle budget` fail-fast gate：读取 `dist/assets`，计算 raw/gzip size，按 startup chunk、CSS、heavy vendor、total payload 输出 pass/advisory/fail 结果。

## Problem / 问题

当前 gate 能确认 `vendor-mermaid`、`vendor-codemirror` 等 manual chunks 存在，但不能阻止 size regression。roadmap 快照显示当前 payload 已经偏大：

- `App-*.js` gzip 约 `1.37 MB`。
- `App-*.css` gzip 约 `269 KB`。
- total js/mjs/css gzip 约 `5.87 MB`。
- Mermaid、CodeMirror、document preview、PDF worker 都是 heavy optional dependencies。

没有 budget gate 时，PR 可以保留 chunk name，但让 startup path 继续变大，或者把 heavy optional dependency 意外拉回首屏。

## Goals / 目标

- 从 `dist/assets` 计算 raw bytes 与 gzip bytes。
- 使用 versioned budget config 管理 app JS、app CSS、total js/css、heavy vendor budgets。
- 对 hard-fail threshold 超标的 group 退出非零。
- 保留现有 manual chunk existence checks。
- 输出 actionable offender list，包含 budget id、actual、target、hardFail、matched files。
- 对 heavy optional chunk 的 startup eagerness 明确标注 `measured-lazy`、`measured-eager` 或 `not-measured`。

## Non-Goals / 非目标

- 本 change 不负责实际减少 bundle size。
- 不大改 Vite chunk strategy，除非 checker 需要最小 metadata。
- 不引入 external browser tooling。
- 不在当前已知超标状态下直接启用低于现状的 hard fail，避免 gate 先于优化阻塞主线。

## Approach / 方案

1. 新增 `scripts/bundle-budget.config.json`，包含 schemaVersion、groups、target、hardFail、mode。
2. 扩展 `scripts/check-bundle-chunking.mjs`，读取 `dist/assets` 并用 Node `zlib` 计算 gzip。
3. 用 stable group matcher 识别 `App-*.js`、`App-*.css`、`vendor-mermaid`、`vendor-codemirror`、`vendor-docs`、total js/mjs/css。
4. 区分 `advisory` 与 `fail` mode：advisory 只打印，fail 超阈值退出非零。
5. heavy optional eagerness 如无法可靠判断，必须输出 `not-measured`，不能假装 safe。

## Initial Budget Policy / 初始预算策略

| Group | Roadmap Current Gzip | Next Target | Hard Fail Rollout |
|---|---:|---:|---|
| `App-*.js` | ~1.37 MB | <= 950 KB | first pass advisory，优化后启用 `> 1.10 MB` fail |
| `App-*.css` | ~269 KB | <= 180 KB | CSS split 后启用 `> 220 KB` fail |
| `total js/mjs/css` | ~5.87 MB | <= 4.8 MB | first optimization batch 后启用 `> 5.3 MB` fail |
| `vendor-mermaid` | ~673 KB | lazy only | measured eager startup import fails |
| `vendor-codemirror` | ~302 KB | lazy only | measured eager startup import fails |
| `vendor-docs` | ~394 KB | lazy only | measured eager startup import fails |

## Risks / 风险

- 如果直接把 future target 作为 hard fail，会阻塞还没开始的优化工作；因此必须支持 advisory rollout。
- Vite hashed output name 会变，matcher 需要按稳定 prefix/pattern 做 group。
- startup eagerness 依赖 build metadata；拿不到证据时必须保持 `not-measured`。

## Acceptance Criteria / 验收口径

- `npm run check:bundle-chunking` 输出 raw/gzip grouped budget table。
- fail-mode group 超过 hardFail 时命令退出非零。
- advisory-mode group 超 target 时只输出 warning，不阻塞当前批次。
- heavy optional chunks 的 eagerness status 不再是隐式 pass。

## Validation / 验证

- `npm run build`
- `npm run check:bundle-chunking`
- `openspec validate enforce-bundle-budget-gate --strict --no-interactive`
