## Why

`feature/v0.5.11` already contains multiple performance substrates, but the current evidence gate still reports important runtime paths as `unsupported` or budget-missing. On 2026-06-17, before this change was created, `npm run perf:archive-readiness -- --json` returned `ok: true`, `status: "warn"`, `hardFailures: []`, `activeChangeCount: 2`, `budgetMissingCount: 15`, and unsupported records for cold start, long-running runtime, realtime input render budget, backend file I/O isolation, file-change debounce, app-server event batching, and frontend prop-chain stability.

## 目标与边界

- 目标：把 v0.5.11 的性能方向建立在当前代码、脚本和 checked-in evidence 事实上，而不是新增一轮凭直觉的性能重构。
- 目标：补齐 producer artifact 与 aggregation wiring，让已有 profiling / batching / debounce / startup-marker 能力进入 `runtime-performance-evidence-gates`。
- 目标：只允许基于 producer 证据做最小 runtime jank hardening；没有 measured/proxy evidence 的路径只记录 unsupported reason 和 next action。
- 边界：本 change 是 v0.5.11 性能证据与运行中卡顿治理的 proposal/design/tasks/spec delta，不直接承诺完成跨平台真实 Tauri/WebView 采样。

## 非目标

- 不做大规模 AppShell、thread reducer、Tauri backend 或 file tree 架构重写。
- 不用人工体感替代 perf artifact。
- 不伪造 `firstPaintMs`、`firstInteractiveMs`、OS child liveness 或 module switch latency。
- 不把 fixture/proxy evidence 声称为 release-grade runtime proof。
- 不引入新依赖；优先复用现有 `scripts/perf-*`、`rendererDiagnostics`、`__profile`、Rust debounce tests 和 app-server batching substrate。

## What Changes

- Add a v0.5.11 performance evidence collection scope that refreshes current-version baselines and keeps version/commit anchors from `package.json` and git.
- Add producer artifact requirements for the currently unsupported summaries:
  - `S-IO-RR` realtime input render budget from reducer/profile fixtures.
  - `S-IO-AS` app-server event batching from batch route / IPC-vs-raw evidence.
  - `S-IO-FC` file-change debounce from same-path burst fixtures.
  - `S-IO-FS` backend file I/O isolation from blocking-pool / 10MB read-write fixture evidence.
  - `S-IO-FP` frontend prop-chain stability from existing React Profiler / `__profile` counters.
  - `S-CS-COLD` startup timing from real startup marker snapshots when available, otherwise explicit unsupported output.
- Modify aggregation requirements so `scripts/generate-runtime-evidence-report.mjs` consumes those producer outputs instead of leaving the summaries unsupported when evidence exists.
- Modify archive-readiness expectations so v0.5.11 distinguishes hard failures from visible residual warnings and records owners/next actions for budget-missing metrics.
- Add a guarded runtime jank hardening rule: implementation fixes may proceed only after a producer exposes a failing or unsupported metric with a concrete code owner and verification path.

## 技术方案选项

| 选项 | 做法 | 取舍 |
|---|---|---|
| A | 继续直接做性能重构，例如继续拆组件、拆 state、压 bundle | 速度快但不可证明，容易重复 v0.5.9/v0.5.10 已完成方向，也可能制造新回归 |
| B | 先补 evidence producer 与 aggregation，再按证据做最小修复 | 更慢但可审计，能把现有代码事实接入 gate，符合 v0.5.11 当前状态 |
| C | 只刷新 baseline，不改 producer 和 aggregation | 风险最低，但会保留大量 `unsupported`，无法指导真正的卡顿治理 |

采用选项 B。理由：当前仓库已经有 `__profile`、batch consumer、debounced file change emitter、startup marker snapshot reader 和 runtime evidence aggregation scaffold；v0.5.11 的缺口主要是证据闭环，而不是再造一套优化架构。

## Capabilities

### New Capabilities

- 无。本 change 复用并强化现有 performance / evidence capabilities，避免引入重复命名空间。

### Modified Capabilities

- `runtime-performance-evidence-gates`: Consume v0.5.11 producer artifacts for `S-IO-*` summaries and preserve unsupported records with exact reasons when a trustworthy source is absent.
- `runtime-perf-baseline`: Refresh current-version baseline semantics and require v0.5.11 history artifacts to anchor package version and git commit.
- `conversation-realtime-client-performance`: Require realtime reducer/profile evidence to expose `prepareThreadItems` call rate, reducer dispatch/flush cost, and route timing for streaming bursts.
- `frontend-prop-chain-stability`: Require profiler/render-count evidence to populate composer/sidebar/thread-row/layout recompute summaries.
- `app-server-event-batching`: Require raw-vs-IPC batching evidence and route/dispatch metrics for batch-aware app-server paths.
- `file-change-event-debounce`: Require same-path burst evidence for raw/emitted event rate, coalesce ratio, and empty batch count.
- `backend-file-io-isolation`: Require file I/O fixture evidence for blocking-pool usage, command wall time, async-worker stall, and Tauri command latency during streaming.
- `client-startup-orchestration`: Require startup marker evidence to be consumed when available and remain explicitly unsupported when no real Tauri/WebView snapshot exists.

## Impact

- Affected scripts:
  - `scripts/perf-aggregate.mjs`
  - `scripts/generate-runtime-evidence-report.mjs`
  - `scripts/perf-archive-readiness.mjs`
  - existing/new `scripts/perf-*.mjs` or `scripts/perf-*.ts` producer entrypoints
- Affected docs/artifacts:
  - `docs/perf/baseline.{json,md}`
  - `docs/perf/history/v0.5.11-baseline*.{json,md}`
  - `docs/perf/runtime-evidence-gates.{json,md}`
  - producer fragments under `docs/perf/*.json` or `.artifacts/*.json`
- Affected code surfaces for evidence only:
  - `src/features/threads/hooks/useThreadsReducer.ts` existing `__profile`
  - `src/features/app/hooks/useAppServerEvents.ts`
  - `src-tauri/src/workspaces/external_changes.rs`
  - `src-tauri/src/backend_budget.rs`
  - `src/services/perfBaseline/**`
  - `src/services/rendererDiagnostics.ts`
- No new runtime dependency is expected.

## 验收标准

- `npm run perf:archive-readiness -- --json` remains free of hard failures and reports a lower or explicitly owned unsupported/budget-missing set for v0.5.11.
- `npm run check:runtime-evidence-gates` consumes producer artifacts and no longer leaves `S-IO-RR`, `S-IO-AS`, `S-IO-FC`, `S-IO-FP`, or `S-IO-FS` unsupported when their producer has generated valid evidence.
- `npm run perf:baseline:all` creates v0.5.11 baseline artifacts anchored to current `package.json.version` and git commit.
- Cold-start `firstPaintMs` and `firstInteractiveMs` are measured only when a real startup marker snapshot is provided; otherwise they remain `unsupported` with exact reason.
- Focused tests cover reducer profile, app-server batch route, file-change debounce, runtime evidence aggregation, archive readiness, and startup marker parsing.
- `npm run typecheck`, `npm run lint`, and `openspec validate v0511-performance-evidence-and-runtime-jank-hardening --strict --no-interactive` pass before implementation is considered ready.
