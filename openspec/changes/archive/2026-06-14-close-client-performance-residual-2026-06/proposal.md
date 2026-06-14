# Proposal: Close Client Performance Residual 2026-06

## Why

2026-06-13 `9db56c88 feat(perf): 收口发布级性能证据提案` 把 `collect-release-grade-performance-evidence` 整个归档到 `openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/`,同时落地了大部分 release-grade evidence 工作:bundle lazy boundary、realtime 4 条 budget、realtime measured runtime 数据。

当前 active 列表只剩 `close-performance-iteration-2026-06` (25/25 complete) 与本 change。实测 `npm run perf:archive-readiness -- --release --json` 在 `9db56c88` 之后:

- `exitCode=1`, `hardFailures=2`:`S-CS-COLD/firstPaintMs` 与 `S-CS-COLD/firstInteractiveMs` 仍 `evidenceClass=unsupported` —— 这两条需要真实 Tauri/WebView 会话产 marker,**沙盒内做不了**,作为显式 follow-up 留到 §8。
- `bundleSizeMain = 1052505 bytes-gzip` 已经 < `hardFail 1100000`,不再 breach。
- `S-RS-VL/RA/FD/TS` 4 条 `evidenceClass=measured` 且 budget block 已编进 `docs/perf/baseline.json`(`owner=realtime-runtime-evidence`, `source=budget-decision-table.md`, `status=approved-runtime-measured`)。
- `budgetMissingCount=17`(原 21,已编 4 条)。
- `BUDGET_RESIDUALS` 在 `scripts/perf-archive-readiness.mjs` 仍把 4 条 realtime 列为 budget-missing,这是脚本滞后,不是数据问题——baseline 已经编预算。

剩余真工作只剩两类(沙盒内可完成):

1. `S-CI-50/inputEventLossCount` 与 `S-CI-100-IME/inputEventLossCount` 两条 input-latency budget 还没编进 `baseline.json`(`budget-decision-table.md` 已经标 `budgeted-next`,候选 `target/hardFail = 0/0 count, owner = input-latency-budget`)。这是沙盒内唯一剩下的"budget 编码"工作。
2. `scripts/perf-cold-start-baseline.mjs` 没有对应的 `--test` 单测,提案要补一个覆盖 marker 三分支(有 / 无 / 损坏)。`BUDGET_RESIDUALS` 同步(`scripts/perf-archive-readiness.mjs` 移出 4 条 realtime + 2 条 input-latency)是 closure contract,不是可选润色。

提案不需要再拆 bundle、不需要新写 runner、不需要改 `generate-runtime-evidence-report.mjs` L530 fallback 逻辑、不需要在沙盒里造 cold-start marker——这些都已由 `9db56c88` 完成或作为 follow-up 显式留底。把这些项从提案里清掉,聚焦沙盒内真剩余。

> 🛠 **深度推演**：[L2/L3 分析摘要] 根因是上一轮 `9db56c88` 是一次"超出原 collect change scope"的实现型收口:它顺手把 bundle 拆了、realtime 4 条 budget 编了、realtime measured 采了、change archive 了,而不是只做"工具 + 决策表 + 探针"。本提案必须按 `9db56c88` 后的真实状态重写,不能再用之前 `1132559 bytes-gzip hardFail` + `24/28 in-progress` 的旧假设。沙盒无法跑 Tauri/WebView 真实会话,cold-start 实采显式归到 follow-up,不在本 change 范围。

## What Changes

- 在 `docs/perf/baseline.json` 给 `S-CI-50/inputEventLossCount` 与 `S-CI-100-IME/inputEventLossCount` 编 `budget` block,`target/hardFail = 0/0 count`,`owner=input-latency-budget`,`source=openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md`,`status=approved`。
- 同步 `docs/perf/baseline.md` 表格反映这两条 budget 行。
- 同步更新 `scripts/perf-archive-readiness.mjs` 的 `BUDGET_RESIDUALS` 表:把 realtime 4 条(`S-RS-VL/RA/FD/TS`)与 input-latency 2 条从 budget-missing 移除。
- 补 `scripts/perf-cold-start-baseline.test.mjs`,覆盖 marker 三分支(有 marker / 无 marker / 损坏 marker)。
- 在 `openspec/changes/close-client-performance-residual-2026-06/specs/runtime-performance-evidence-gates/spec.md` 加 ADDED Requirement:`BUDGET_RESIDUALS` 与 baseline.json 必须保持同步。

## Capabilities

### Modified Capabilities

- `runtime-performance-evidence-gates`:把"inputEventLossCount 两条 input-latency 必须在 owner 批准后编进 baseline"、"BUDGET_RESIDUALS 与 baseline.json 必须保持同步"两条契约纳入 requirement。
- `bundle-chunking-performance`:不新增 requirement;`9db56c88` 已在 `useLayoutNodes.tsx` 用 `React.lazy` 拆 `ProjectMapPanel` 与 `IntentCanvasManager`,且 `appShellLazyBoundaries.test.ts` 已覆盖。spec delta 仅描述现有事实。
- `realtime-input-render-budget`:不新增 requirement;`9db56c88` 已在 `generate-runtime-evidence-report.mjs` L500-540 + `perf-aggregate.mjs` 落地 measured-priority,`baseline.json` 4 条 realtime 升级为 measured。spec delta 仅描述现有事实。

## Impact

- 证据产物:
  - 重生 `docs/perf/baseline.json` / `docs/perf/baseline.md`
  - 同步 `docs/perf/runtime-evidence-gates.json` / `docs/perf/runtime-evidence-gates.md`(由 aggregate 自动重生)
- 脚本:
  - 改 `scripts/perf-archive-readiness.mjs` 的 `BUDGET_RESIDUALS` 列表
  - 新增 `scripts/perf-cold-start-baseline.test.mjs`
- OpenSpec artifacts:
  - 改 `openspec/changes/close-client-performance-residual-2026-06/specs/runtime-performance-evidence-gates/spec.md`
  - 改 `openspec/changes/close-client-performance-residual-2026-06/specs/bundle-chunking-performance/spec.md`(已实现的事实描述,非新增 contract)
  - 改 `openspec/changes/close-client-performance-residual-2026-06/specs/realtime-input-render-budget/spec.md`(同上)
- 业务行为:不变。仅在 `baseline.json` 补 2 条 `budget` block + readiness 脚本同步;不修改任何产品代码。

## Non-Goals

- 不再拆 bundle(`9db56c88` 已完成)
- 不再写新 runner(`9db56c88` 已存在 `perf-cold-start-baseline.mjs --startup-markers` 与 `perf-realtime-runtime-report.mjs --input`)
- 不再改 `generate-runtime-evidence-report.mjs` 的 fallback 逻辑(measured-priority 已存在)
- 不在沙盒里造 cold-start marker / 不在沙盒里跑 Tauri/WebView 真实会话
- 不重开 `collect-release-grade-performance-evidence`(`9db56c88` 已 archive)
- 不拆 10 个 P0/P1 large file(继续 follow-up)
- 不动 backend (Rust) 代码
- 不动 frontend 任何 `src/**` 业务代码
- 不新增 npm 依赖

## Acceptance Criteria

- `docs/perf/baseline.json` 中 `S-CI-50/inputEventLossCount` 与 `S-CI-100-IME/inputEventLossCount` 含 `budget` block,`budget.target=0`,`budget.hardFail=0`,`budget.unit=count`,`budget.owner="input-latency-budget"`,`budget.source` 指向 `openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md`,`budget.status` 非空。
- `docs/perf/baseline.md` 表格里能看到 input-latency 两条 budget 行。
- `scripts/perf-archive-readiness.mjs` 的 `BUDGET_RESIDUALS` 列表实时同步:`S-RS-VL/RA/FD/TS` 4 条已编预算的从表里移除;`S-CI-50/inputEventLossCount` 与 `S-CI-100-IME/inputEventLossCount` 编完预算后从表里移除。
- `npm run perf:archive-readiness -- --json` 报告 `hardFailures: 0`,`budgetMissingCount: 15`(原 17,本 change 减 2)。
- `npm run perf:archive-readiness -- --release --json` 报告 `hardFailures: 2`(firstPaintMs + firstInteractiveMs 仍 unsupported,这是显式 follow-up,closure 接受 explicit release blocker 形式)。
- `npm run typecheck` 与 `npm run lint` pass。
- `npm run check:bundle-chunking` 维持 `app-js: pass` 或 `advisory`(不超 `1,100,000 bytes-gzip`)。
- `node --test scripts/perf-cold-start-baseline.test.mjs` 覆盖有 marker / 无 marker / 损坏 marker 三分支且全 pass。
- `openspec validate close-client-performance-residual-2026-06 --strict --no-interactive` passes。
- `git diff --stat` 显示改动仅限:`docs/perf/**`、`scripts/perf-archive-readiness.mjs`、`scripts/perf-cold-start-baseline.test.mjs`、`openspec/changes/close-client-performance-residual-2026-06/**`。**不出现** `src/**` 或 `src-tauri/**` 改动。

## Closure Decision Record

- cold-start 实采显式 follow-up:本 change 不在沙盒里造 `S-CS-COLD/firstPaintMs` / `firstInteractiveMs` 的 measured marker。release mode 仍报 2 个 `release-evidence-unsupported` hard fail(closure 接受 explicit release blocker 形式,语义为"已识别,等待真实会话")。`src/services/perfBaseline/startupMarkers.ts` 与 `scripts/perf-cold-start-baseline.mjs --startup-markers` 都已就位,真实会话一次即可升级。
- input-latency budget 编码:按 `budget-decision-table.md` 候选 `target=0, hardFail=0` 编码;若 owner 在 review 阶段提出"hardFail 应是 >0 的非零容差",允许改值,但不允许把 2 条 budget 改成 `budget-missing` 跳过治理。
- BUDGET_RESIDUALS 同步:本 change 完成后该表只剩余 15 条,且不能再有"baseline 已编预算但 readiness 仍报 budget-missing"的同步漂移。

## 技术方案取舍

| Option | Description | Pros | Cons | Decision |
|---|---|---|---|---|
| A. 不开新 change,直接 commit 收口 | 在当前 active 工作区直接改 baseline + archive-readiness。 | 0 overhead。 | 没有 OpenSpec task 留痕,后续 review 看不到 acceptance contract;也违反 6 月迭代"行为变更必须先 proposal" 规则。 | Rejected |
| B. 开 `close-client-performance-residual-2026-06`,聚焦 input-latency budget 编码 + BUDGET_RESIDUALS 同步 + 冷启动单测;cold-start 实采显式 follow-up | 沙盒内 1 天规模,聚焦能做的 3 件。 | 任务清单跟沙盒能力一一对应,closure 状态诚实;cold-start 实采显式归到 follow-up,reviewer 一眼能看清边界。 | release 模式仍报 2 个 hard fail(unsupported),需要 closure notes 显式记录。 | Accepted |
| C. 在沙盒里构造 marker 假装 measured | 构造合法形状的 `.artifacts/startup-marker-snapshot.json`,让 release 模式 `hardFailures=0`。 | release 模式全绿。 | 数据是造的,违反提案 "Failure Handling" 兜底口径("不允许从 proxy 升 measured 伪升级")。 | Rejected |
