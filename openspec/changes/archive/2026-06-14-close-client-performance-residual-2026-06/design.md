# Design: Close Client Performance Residual 2026-06

OpenSpec change: `close-client-performance-residual-2026-06`

## Context

`9db56c88` (2026-06-13) 一次性把 `collect-release-grade-performance-evidence` 归档 + bundle 拆 lazy + realtime 4 条 budget 编预算 + realtime measured 数据落地。当前 `npm run perf:archive-readiness -- --release --json` 实际输出:

- `exitCode=1`, `hardFailures=2`:`S-CS-COLD/firstPaintMs` / `firstInteractiveMs` `evidenceClass=unsupported` —— **沙盒内做不了,作为显式 follow-up 留到 §8**
- `bundleSizeMain = 1052505 bytes-gzip < hardFail 1100000` (advisory,不 breach)
- `S-RS-VL/RA/FD/TS` 4 条 `evidenceClass=measured` 且 budget block 已编
- `budgetMissingCount=17`(原 21,已编 4 条)
- `BUDGET_RESIDUALS` 在 `scripts/perf-archive-readiness.mjs` 仍把 4 条 realtime 列为 budget-missing,需本 change 同步

`openspec list --json` active: 只有 `close-performance-iteration-2026-06` (complete) + 本 change (in-progress)。

## Implementation Principles

- 不修改任何产品代码(`src/**` / `src-tauri/**`)。
- 不写新 runner——`scripts/perf-cold-start-baseline.mjs` 已经接受 `--startup-markers`,`scripts/perf-realtime-runtime-report.mjs` 已经接受 `--input`。
- 不改 `generate-runtime-evidence-report.mjs` 的 measured-priority 逻辑。
- BUDGET_RESIDUALS 跟 baseline.json 同步是 closure contract,不是可选润色。
- 不在沙盒里造 `S-CS-COLD/firstPaintMs` / `firstInteractiveMs` 的 measured marker;这两条走显式 follow-up,closure notes 显式记录。

## Stage 1. Input-Latency Budget Encoding

针对 `S-CI-50/inputEventLossCount` 与 `S-CI-100-IME/inputEventLossCount` 2 条,补 `docs/perf/baseline.json` 的 `budget` block:

| Record | Target | HardFail | Unit | Owner | Source | Status |
|---|---:|---:|---|---|---|---|
| `S-CI-50/inputEventLossCount` | 0 | 0 | count | input-latency-budget | archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md | approved |
| `S-CI-100-IME/inputEventLossCount` | 0 | 0 | count | input-latency-budget | archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md | approved |

注意:

- 候选值在 `budget-decision-table.md` 已经标注 `budgeted-next` 与 "Candidate hardFail should be `0`, but requires owner approval before encoding";本 change 视作 owner 批准。
- `evidenceClass` 保持 `proxy`(value 仍来自 jsdom proxy,本 change 不动 evidence 升级路径)。
- `baseline.md` 表格同步加 2 行;`baseline.json` 与 `baseline.md` 必须一致。
- 真实 reject 路径:若 owner 在 review 阶段要"hardFail > 0 的容差",允许改值(改 budget block),但不允许把 2 条 budget 改成 `budget-missing` 跳过治理。

## Stage 2. BUDGET_RESIDUALS Sync

`scripts/perf-archive-readiness.mjs` 的 `BUDGET_RESIDUALS` Map 当前还列着 21 条 budget-missing,其中:

- `S-RS-VL/RA/FD/TS` 4 条 —— `9db56c88` 已给它们编预算,本 change 把这 4 条从 `BUDGET_RESIDUALS` 移除。
- `S-CI-50/inputEventLossCount` 与 `S-CI-100-IME/inputEventLossCount` 2 条 —— 本 change 自身会编预算,在 Stage 1 编码完成后从 `BUDGET_RESIDUALS` 移除。
- 剩下 15 条 (LL-200/500/1000 共 9 条 + CI compositionToCommit 2 条 + RS-PE 2 条 + CS-COLD firstPaintMs/firstInteractiveMs 2 条) 继续作为 residual risk。其中 CS-COLD 2 条是显式 follow-up,LL/RS/CI 共 13 条是 owner 后续决定。

## Stage 3. Cold-Start Runner Unit Test

新增 `scripts/perf-cold-start-baseline.test.mjs`(现有 `scripts/perf-archive-readiness.test.mjs` / `scripts/perf-realtime-runtime-report.test.mjs` 是 `node --test` 风格,沿用同一种风格)。

三个测试分支:

1. **有 marker**:传入合法 snapshot,断言 `firstPaintMs` / `firstInteractiveMs` 在输出的 `docs/perf/cold-start-baseline.json` 升级为非 null + 正确 ms。
2. **无 marker**:snapshot 为 null 或不传 `--startup-markers`,断言两 metric `value=null` 且 `unsupportedReason` 含 "Tauri/webview startup marker snapshot was not provided" 文本(`perf-cold-start-baseline.mjs:131-132` 的固定 reason)。
3. **损坏 marker**:snapshot 是 JSON 解析失败的文件,断言 runner 产出 corrupt-specific `unsupportedReason` 且文本含 "Failed to read startup marker snapshot"(`perf-cold-start-baseline.mjs:81-83`);若未来 runner 改为非零退出,错误信息也必须保留 corrupt-specific 文本,不能退化成 "was not provided"。

> 注:runner 真实接口已经把"无 marker" 和"损坏 marker"区分开(`unsupportedReason` 文本不同),测必须覆盖到这一区分,不能只测"全 null"。

## Stage 4. Spec Deltas

只改 1 份 change-local spec(`runtime-performance-evidence-gates`),其余 2 份(`bundle-chunking-performance` / `realtime-input-render-budget`)因为没有新增 contract,沿用 `9db56c88` 已实现的事实,改写为"已实现 / 已覆盖" 的描述,不再加 ADDED Requirement。

`openspec/changes/close-client-performance-residual-2026-06/specs/runtime-performance-evidence-gates/spec.md` 加 2 条 ADDED Requirement:

1. Input-Latency Budget Encoding(对照 Stage 1)
2. Budget Residual Table Sync(对照 Stage 2,要求 BUDGET_RESIDUALS 与 baseline.json 双向同步)

## Stage 5. Validation

```bash
npm run perf:baseline:aggregate
npm run perf:archive-readiness -- --json
npm run perf:archive-readiness -- --release --json
npm run check:bundle-chunking
npm run typecheck
npm run lint
node --test scripts/perf-cold-start-baseline.test.mjs
openspec validate close-client-performance-residual-2026-06 --strict --no-interactive
git diff --stat
git diff --stat -- 'src/**' 'src-tauri/**'   # 必须是空
```

Acceptance:

- 普通模式 `hardFailures: 0`, `budgetMissingCount: 15`。
- release 模式 `hardFailures: 2`(firstPaintMs + firstInteractiveMs 显式 follow-up),closure 接受。
- `git diff --stat` 不含 `src/**` / `src-tauri/**` 改动。

## Failure Handling

- cold-start 实采:本 change 不在沙盒内造 marker,closure 接受 release 模式 `hardFailures=2` 的 explicit release blocker 形式;真实会话与 marker 升级作为 §8 follow-up。
- 若 owner 否决 input-latency hardFail=0,允许把 hardFail 改成 >0,任务 3.x 仍可勾选;但**不允许**把 2 条 budget 改回 `budget-missing` 跳过治理。
- 若 BUDGET_RESIDUALS 同步遗漏某条已编预算 record,readiness 输出 `budgetMissingCount` 会比预期高;这种情况下必须回去修脚本,不允许靠"加注释" 或"调整 acceptance 数字" 蒙混。

## Out of Scope

- 大文件拆分(10 个 P0/P1)继续 follow-up。
- `firstTokenLatency=5000` / `interTokenJitterP95=920` 实际降值(advisory,不在 release 硬关内)。
- 性能优化层(渲染、reducer、batch)代码调整。
- 重开 `collect-release-grade-performance-evidence`(已 archive)。
- 新增 npm 依赖。
- 后端 Rust 代码改动。
- 沙盒内 cold-start 实采(显式 follow-up)。
