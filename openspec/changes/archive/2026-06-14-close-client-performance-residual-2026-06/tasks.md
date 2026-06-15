# Tasks: Close Client Performance Residual 2026-06

## Archive Calibration 2026-06-14

- [x] A.1 [archive][input:`openspec archive close-client-performance-residual-2026-06 -y`][output:`openspec/changes/archive/2026-06-14-close-client-performance-residual-2026-06/`][validation: archived directory exists and proposal/tasks/spec deltas are preserved] Archive this completed change.
- [x] A.2 [sync][input: change-local delta specs][output: main specs updated][validation: `openspec/specs/bundle-chunking-performance/spec.md`, `openspec/specs/realtime-input-render-budget/spec.md`, and `openspec/specs/runtime-performance-evidence-gates/spec.md` contain the synced requirements] Sync delta specs into main specs.
- [x] A.3 [truth-check][input:`docs/perf/baseline.json` + `scripts/perf-archive-readiness.mjs`][output: inputEventLossCount budgets encoded and stale residual entries removed][validation: `S-CI-50/inputEventLossCount` and `S-CI-100-IME/inputEventLossCount` have approved budget blocks; `BUDGET_RESIDUALS` excludes those two records and the four measured realtime records] Confirm post-archive budget truth.
- [x] A.4 [validation][input:`npm run perf:archive-readiness -- --json`][output: normal readiness remains warning-only][validation: `budgetMissingCount=15` and `hardFailures=[]`] Re-run normal archive-readiness.
- [x] A.5 [validation][input:`npm run perf:archive-readiness -- --release --json`][output: release readiness still has explicit cold-start blocker][validation: hard failures are exactly `S-CS-COLD/firstPaintMs` and `S-CS-COLD/firstInteractiveMs`] Re-run release archive-readiness.
- [x] A.6 [validation][input:`node --test scripts/perf-cold-start-baseline.test.mjs`][output: cold-start marker unit test passes][validation: 3 tests pass for valid marker, missing marker, and corrupt marker] Re-run cold-start runner unit test.
- [x] A.7 [validation][input:`openspec validate --all --strict --no-interactive`][output: all main specs and active changes validate][validation: 346 passed, 0 failed] Re-run full OpenSpec validation.
- [x] A.8 [handoff][input: remaining release hard failures][output: follow-up boundary documented][validation: `S-CS-COLD/firstPaintMs` and `firstInteractiveMs` remain out-of-scope and require measured Tauri/WebView marker collection] Document next proposal boundary.

## 1. Preflight

- [x] 1.1 [P0][depends:none][input:`npm run perf:archive-readiness -- --release --json`][output: hard failure baseline record][validation: hardFailures 恰好 2 项,记录是 `S-CS-COLD/firstPaintMs` 与 `S-CS-COLD/firstInteractiveMs`;`bundleSizeMain` 不在 hardFailures] Capture current release-readiness hard failures.
- [x] 1.2 [P0][depends:none][input:`dist/assets/App-*.js`][output: current bytes-gzip 快照][validation: 当前 `App-*.js` bytes-gzip <= 1100000] Confirm bundle main 不再 hard breach。
- [x] 1.3 [P1][depends:none][input:`scripts/perf-archive-readiness.mjs` 的 `BUDGET_RESIDUALS` 表 + `docs/perf/baseline.json`][output: 同步漂移记录][validation: 列出现有 4 条 realtime 已被 baseline 预算但仍列在 `BUDGET_RESIDUALS` 里的 record;以及 2 条 inputEventLossCount 仍是 `budget-missing`] Record BUDGET_RESIDUALS 同步漂移。

## 2. Input-Latency Budget Encoding

- [x] 2.1 [P0][depends:1.1][input: `openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md` 2 条 `budgeted-next`][output: owner 审批记录][validation: 2 条 metric 的 target/hardFail/owner/status 4 个字段被 owner 确认] Confirm 2 input-latency candidate budgets.
- [x] 2.2 [P0][depends:2.1][input: `docs/perf/baseline.json`][output: 2 条 metric 含 `budget` block,`budget.target=0`,`budget.hardFail=0`,`budget.unit=count`,`budget.owner="input-latency-budget"`,`budget.source` 指向 `archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md`,`budget.status="approved"`,`budget.rollout="fail-ready"`,顶层 `status="approved"`][validation:`rg '"source": "openspec/changes/archive/2026-06-13-collect-release-grade-performance-evidence/budget-decision-table.md"' docs/perf/baseline.json` 命中 >= 6(原 4 条 realtime + 新 2 条 input-latency)] Encode 2 input-latency budgets in baseline.
- [x] 2.3 [P1][depends:2.2][input: 同步 markdown][output: `docs/perf/baseline.md` 表格里能看到 input-latency 两条 budget 行][validation:`rg "inputEventLossCount" docs/perf/baseline.md` 命中 >= 4(2 input-latency + 2 现有 proxy 行)] Sync baseline.md table.

## 3. BUDGET_RESIDUALS Sync

- [x] 3.1 [P0][depends:2.2][input: `scripts/perf-archive-readiness.mjs`][output: `BUDGET_RESIDUALS` Map 移除 `S-RS-VL/RA/FD/TS` 4 条(已编预算)与 `S-CI-50/inputEventLossCount` / `S-CI-100-IME/inputEventLossCount` 2 条(本 change 编)] Remove 6 records from BUDGET_RESIDUALS.
- [x] 3.2 [P0][depends:3.1][input: readiness 普通模式][output: `npm run perf:archive-readiness -- --json` `budgetMissingCount: 15`,`hardFailures: 0`][validation: JSON 报告 `budgetMissingCount === 15` 且 `hardFailures.length === 0`] Run normal archive-readiness.
- [x] 3.3 [P0][depends:3.1][input: readiness release 模式][output: `npm run perf:archive-readiness -- --release --json` `hardFailures: 2`(firstPaintMs + firstInteractiveMs 显式 follow-up)][validation: JSON 报告 `hardFailures` 数组长度 === 2,且两条都是 release-evidence-unsupported] Run release archive-readiness.

## 4. Cold-Start Runner Unit Test

- [x] 4.1 [P0][depends:2.2][input: `scripts/perf-cold-start-baseline.mjs` 的 `readStartupMarkers`(L84-102)与 `findStartupMarker`(L104-110)行为][output: `scripts/perf-cold-start-baseline.test.mjs` 覆盖有 marker / 无 marker / 损坏 marker 三分支][validation:`node --test scripts/perf-cold-start-baseline.test.mjs` 全 pass] Add focused unit tests.
- [x] 4.2 [P1][depends:4.1][input: 测试覆盖度][output: 测试断言有 marker / 无 marker 两种情况下 `unsupportedReason` 文本不同(L88 的 "was not provided" vs L99 的 "Failed to read"),且损坏 marker 分支用 `assert.doesNotMatch` 验证不含 "was not provided"][validation: 测试 assert 文本不同] Cover reason-text distinction.

## 5. Spec Deltas

- [x] 5.1 [P0][depends:2.2,3.1][input: change-local runtime-performance-evidence-gates spec delta][output: 2 条 ADDED Requirement 覆盖 input-latency budget encoding / BUDGET_RESIDUALS sync + 1 段 Implemented(No New Requirement) + 1 段 Out of Scope][validation:`rg "Input-Latency Budget Encoding\|BUDGET_RESIDUALS Sync" openspec/changes/close-client-performance-residual-2026-06/specs/runtime-performance-evidence-gates/spec.md` 命中] Add requirements and sections to runtime-performance-evidence-gates change delta.
- [x] 5.2 [P1][depends:5.1][input: change-local bundle-chunking-performance spec delta][output: 1 段 MODIFIED Requirement 描述 `9db56c88` 已在 `useLayoutNodes.tsx` 用 `React.lazy` 拆 `ProjectMapPanel` 与 `IntentCanvasManager`,`appShellLazyBoundaries.test.ts` 已覆盖][validation:`rg "ProjectMapPanel\|IntentCanvasManager" openspec/changes/close-client-performance-residual-2026-06/specs/bundle-chunking-performance/spec.md` 命中] Describe existing implementation.
- [x] 5.3 [P1][depends:5.1][input: change-local realtime-input-render-budget spec delta][output: 1 段 MODIFIED Requirement 描述 `9db56c88` 已在 `generate-runtime-evidence-report.mjs` 的 `buildRealtimeTraceBudgets`(L503-534)与 `perf-aggregate.mjs` 的 `classifyMetric`(L41-65)落地 measured-priority 行为,4 条 realtime 已 measured][validation:`rg "measured.*priority\|priority.*measured" openspec/changes/close-client-performance-residual-2026-06/specs/realtime-input-render-budget/spec.md` 命中] Describe existing implementation.

## 6. Final Validation

- [x] 6.1 [P0][depends:3.3,5.1][input: 所有 OpenSpec artifacts][output: `openspec validate close-client-performance-residual-2026-06 --strict --no-interactive` pass][validation: validate 退出 0] Run strict OpenSpec validation.
- [x] 6.2 [P0][depends:3.3][input: TypeScript][output: `npm run typecheck` pass][validation: 退出 0] Run typecheck.
- [x] 6.3 [P1][depends:3.3][input: ESLint][output: `npm run lint` pass][validation: 退出 0] Run lint.
- [x] 6.4 [P1][depends:4.1][input: 单元测试][output: `node --test scripts/perf-cold-start-baseline.test.mjs` pass][validation: 退出 0] Run new unit tests.
- [x] 6.5 [P1][depends:3.3][input: bundle sanity][output: `npm run check:bundle-chunking` 不为 `app-js` 报 `fail`][validation: summary 行 `app-js` 状态不是 `fail`] Verify bundle not regressed.
- [x] 6.6 [P1][depends:6.1][input: repository diff][output: `git diff --stat -- 'src/**' 'src-tauri/**'` 是空][validation: 无产品代码改动] Confirm no product code change.

## 7. Follow-up Explicitly Out of Scope

- 7.1 [follow-up][owner:release-grade-evidence-collection] 在真实 Tauri/WebView 桌面环境(本机 `npm run tauri:dev` 或 CI runner)采集 `S-CS-COLD/firstPaintMs` / `firstInteractiveMs` 的 measured marker,把产物放 `.artifacts/startup-marker-snapshot.json`,跑 `npm run perf:cold-start:baseline -- --startup-markers <snapshot> --skip-build` + `npm run perf:baseline:aggregate` 把 baseline 升级为 `measured`。本 change 不在沙盒内做,closure 接受 release mode `hardFailures=2` 的 explicit release blocker 形式。
- 7.2 [follow-up][owner:frontend-modularization-debt] 拆 10 个 P0/P1 large file candidates。
- 7.3 [follow-up][owner:backend-modularization-debt] 拆 backend bridge / runtime 大文件。
- 7.4 [follow-up][owner:realtime-runtime-evidence] 把 `firstTokenLatency=5000` / `interTokenJitterP95=920` 真实压到 target。
- 7.5 [follow-up][owner:input-latency-budget] 把 `S-CI-50/compositionToCommit` / `S-CI-100-IME/compositionToCommit` 的 budget 来源从 jsdom proxy 升级到 runtime measured,获得 owner 批准后编入 baseline。
