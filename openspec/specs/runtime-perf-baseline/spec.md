# runtime-perf-baseline Specification

## Purpose
TBD - created by archiving change add-runtime-perf-baseline. Update Purpose after archive.
## Requirements
### Requirement: Baseline Coverage MUST Span Four Hot-Path Scenarios

系统 MUST 为 long-conversation render、composer-input、realtime-stream 与 cold-start 四类用户感知热路径分别建立 fixture-based perf baseline。每个 scenario 的 metric 定义 MUST 在 `docs/perf/baseline.md`（latest）与 capability spec 中保持一致；版本锚定的归档副本 MUST 写入 `docs/perf/history/<version>-baseline.md`。

#### Scenario: long-conversation render baseline coverage

- **WHEN** baseline 采集运行
- **THEN** 系统 MUST 至少产出 200、500、1000 三档 thread item 数量下的 `commitDurationP50`、`commitDurationP95`、`firstPaintAfterMount`
- **AND** 1000 档 MUST 额外采集 `scrollFrameDropPct`
- **AND** fixture MUST 包含混合的 user / assistant / tool / reasoning item 形态

#### Scenario: composer-input baseline coverage

- **WHEN** baseline 采集运行
- **THEN** 系统 MUST 在 50 字符纯文本与 50 字符叠加 IME composition 两种 input pattern 下采集 `keystrokeToCommitP95`
- **AND** MUST 记录 `inputEventLossCount` 与 `compositionToCommit`
- **AND** keystroke 间隔 MUST 固定为 16ms 以保证可重现性

#### Scenario: realtime-stream extended baseline coverage

- **WHEN** baseline 采集运行
- **THEN** 系统 MUST 复用现有 `realtimeReplayHarness` 并扩展两个 fixture：Claude stream-json first-token slow path 与 prompt-enhancer dedup path
- **AND** MUST 采集 `firstTokenLatency`、`interTokenJitterP95`、`dedupHitRatio`、`assemblerLatency`
- **AND** existing `npm run perf:realtime:boundary-guard` 行为 MUST NOT 受到本次扩展影响

#### Scenario: cold-start baseline coverage

- **WHEN** baseline 采集运行于支持平台
- **THEN** 系统 MUST 采集 `bundleSizeMain`、`bundleSizeVendor`（gzipped bytes）、`firstPaintMs`、`firstInteractiveMs`
- **AND** 当目标平台不支持 webview headless 采集时 MUST 在报告中显式标注 `unsupported` 并附原因

### Requirement: Baseline Collection MUST Be Off By Default

baseline 采集层 MUST 受 `VITE_ENABLE_PERF_BASELINE` 环境开关控制，默认关闭。在开关关闭状态下，系统的运行时行为 MUST 与未引入本变更前的基线分支 100% 等价。

#### Scenario: default-off preserves baseline behavior

- **WHEN** 应用以默认环境运行（未设置 `VITE_ENABLE_PERF_BASELINE` 或显式设为 `0`）
- **THEN** baseline collector 的所有副作用 MUST NOT 触发
- **AND** `<PerfProfiler>` harness MUST NOT be imported by existing runtime business components
- **AND** `rendererDiagnostics` MUST NOT 产生新的 `perf.*` 条目

#### Scenario: explicit opt-in enables collection

- **WHEN** 环境变量 `VITE_ENABLE_PERF_BASELINE=1` 显式设置
- **THEN** baseline collector MUST 启用 web-vitals 监听
- **AND** runtime 采集事件 MUST 经 `rendererDiagnostics` 通道写入，label 取值为 `perf.web-vital`
- **AND** React Profiler 采样 MUST 只出现在 fixture producer harness，不得接入现有 runtime 根节点
- **AND** release build 中即使开关打开也 MUST 受 production-only gate 拒绝（防误开）

### Requirement: Perf Events MUST Reuse Existing Diagnostics Channel

所有 perf-related runtime sample MUST 通过 `RendererDiagnosticEntry` 写入并复用现有的 client-store 持久化路径。本变更 MUST NOT 引入新的全局事件总线、global window mutation 或并行存储。Fixture producer 生成的 React Profiler sample MUST 写入 baseline JSON fragment，不作为 runtime diagnostics entry。

#### Scenario: web-vitals report routed through rendererDiagnostics

- **WHEN** web-vitals callback 回报 LCP / INP / CLS
- **THEN** 系统 MUST 调用 `rendererDiagnostics` 的扩展入口写入 entry
- **AND** entry 的 `label` MUST 为 `"perf.web-vital"` 且 `payload` 包含 `name`、`value`、`rating`、`navigationType`

#### Scenario: profiler sample routed through fixture baseline JSON

- **WHEN** `<PerfProfiler id>` wrapper 的 `onRender` 回调被触发
- **THEN** 系统 MUST 将 sample 写入对应 fixture producer 的 JSON fragment
- **AND** sample MUST 包含 `id`、`phase`、`actualDuration`、`baseDuration`、`startTime`
- **AND** existing runtime business components MUST NOT import or render this wrapper

#### Scenario: buffer cap protects memory

- **WHEN** perf entry 数量超过 `MAX_PERF_ENTRIES`
- **THEN** 系统 MUST 按时间顺序丢弃最早条目
- **AND** `rendererDiagnostics` MUST apply separate caps: `MAX_RENDERER_DIAGNOSTICS=200` for non-perf entries and `MAX_PERF_ENTRIES=1000` for `perf.*` entries
- **AND** existing non-perf diagnostics buffer 行为 MUST NOT 受影响

### Requirement: Baseline Reports MUST Conform To Versioned Schema And Dual-Path Archival

baseline aggregator MUST 产出 latest 与 versioned archive 两套产物：

- **Latest**：`docs/perf/baseline.md` + `docs/perf/baseline.json`，每次执行覆盖写入。
- **Versioned archive**：`docs/perf/history/<version>-baseline.md` + `.json`，`<version>` 取自 `package.json.version` 字段，已存在则追加 `-<timestamp>` 后缀。

本变更首次产出的归档版本 MUST 为 `docs/perf/history/v0.4.18-baseline.md`。JSON MUST 包含 `schemaVersion` 字段，初始值为 `"1.0"`。Schema 在不破坏既有字段的前提下扩展时升 minor，破坏性变更升 major。

#### Scenario: report contains required sections

- **WHEN** `npm run perf:baseline:all` 成功执行
- **THEN** `docs/perf/baseline.md` 与对应的 `docs/perf/history/<version>-baseline.md` MUST 同时包含 Section A（Fixture-Replay Baseline）、Section B（Cross-Platform Notes）、Section C（Residual Risks）
- **AND** Section A MUST 以 `Scenario | Metric | Value | Unit | Notes` 表格形式呈现每个 metric
- **AND** latest 与对应 versioned archive 的 Section A 内容 MUST 字节级一致

#### Scenario: versioned archive preserves history

- **WHEN** 后续 follow-up change 重新跑 baseline
- **THEN** `docs/perf/history/v0.4.18-baseline.md` MUST 保持原样不被覆盖
- **AND** 新版本 MUST 写入 `docs/perf/history/<new-version>-baseline.md`
- **AND** `docs/perf/baseline.md` MUST 被新结果覆盖

#### Scenario: JSON consumers gate on schemaVersion

- **WHEN** 任何工具或后续 PR 读取 baseline JSON
- **THEN** 工具 MUST 先校验 `schemaVersion` 与自身兼容性
- **AND** 当 schema major 不兼容时 MUST 拒绝读取并提示升级

#### Scenario: cross-platform skips documented in report

- **WHEN** 某个 scenario 在特定平台无法采集
- **THEN** 报告 Section B MUST 显式记录平台、scenario、原因
- **AND** JSON 对应条目的 `value` MUST 为 `null` 且附带 `unsupportedReason`

### Requirement: Baseline Change MUST NOT Modify Business Code

本变更 MUST NOT 修改 `useThreadMessaging` / `useAppServerEvents` / `Composer` / `MessagesRows` 等业务 hook 或组件的现有行为路径。本变更 MUST NOT 改变 runtime 协议、事件 batching、流式 throttle 行为。

#### Scenario: business hooks untouched at diff level

- **WHEN** 本变更进入 review
- **THEN** `git diff main..HEAD -- src/features/threads/hooks/useThreadMessaging.ts` MUST 为空
- **AND** `git diff main..HEAD -- src/features/app/hooks/useAppServerEvents.ts` MUST 为空
- **AND** `git diff main..HEAD -- src/features/composer/components/Composer.tsx` MUST 为空
- **AND** `git diff main..HEAD -- src/features/messages/components/MessagesRows.tsx` MUST 为空
- **AND** these files MUST NOT import `src/services/perfBaseline/**`

#### Scenario: no implicit virtual scrolling activation

- **WHEN** 本变更代码完成实现
- **THEN** `@tanstack/react-virtual` 在 messages / composer / threads 模块的引用计数 MUST 与变更前相同
- **AND** 任何对长列表行为的修改 MUST 留给后续独立 change 完成

### Requirement: Baseline Producer Scripts MUST Honor Cross-Platform And Governance Gates

所有 baseline producer script MUST 在 ubuntu-latest、macos-latest、windows-latest 上可执行。新增脚本和 fixture 单文件 MUST < 400 行。所有脚本默认 MUST 静默运行（详细输出走 `--verbose` 或落盘 markdown）。

#### Scenario: scripts run on three CI platforms

- **WHEN** baseline producer script 在 CI 上运行
- **THEN** script MUST 在 ubuntu-latest、macos-latest、windows-latest 上完成或显式 skip
- **AND** skip 行为 MUST 在 baseline 报告中留痕

#### Scenario: scripts honor large-file governance

- **WHEN** 新增脚本或 fixture 文件
- **THEN** 每个文件 MUST < 400 行
- **AND** `npm run check:large-files:gate` MUST 在本变更上通过

#### Scenario: scripts honor heavy-test-noise governance

- **WHEN** baseline producer script 默认执行
- **THEN** script MUST NOT 向 stdout / stderr 写入逐事件日志
- **AND** `npm run check:heavy-test-noise` MUST 在本变更上通过

### Requirement: Baseline Capability MUST Define Interface For Follow-Up Optimizations

后续优化类 change MUST 以本 capability 的 baseline 报告作为 acceptance criteria 的引用源。本 capability MUST 明确列出已知的 follow-up 候选：long-list virtualization、realtime event batching、mega-hub split、bundle chunking。

#### Scenario: follow-up references concrete baseline rows

- **WHEN** 后续优化 change 进入 review
- **THEN** 该 change 的 proposal MUST 引用 `docs/perf/history/v0.4.18-baseline.md` 中具体 scenario id 与 metric 值
- **AND** acceptance criteria MUST 包含 "metric 退化 ≤ N%" 或 "metric 改进 ≥ M%" 形式的可校验条款

#### Scenario: follow-up backlog is enumerated in this capability

- **WHEN** 阅读本 capability 的 active spec
- **THEN** 文档 MUST 列出至少四个 follow-up 候选 change id
- **AND** 每个候选 MUST 标注其与具体 baseline scenario 的关联

### Requirement: Perf Baseline Reports MUST Expose Evidence Class

Perf baseline reports MUST expose whether each scenario is measured, proxy, unsupported, or manual-only so consumers do not mistake a successful script for release-grade runtime proof.

#### Scenario: long-list browser-scroll proxy is explicit
- **WHEN** the long-list `S-LL-1000` scroll metric is generated without browser-level evidence
- **THEN** the report MUST classify the scroll evidence as `proxy`
- **AND** the report MUST include the missing browser-scroll gate as the next action

#### Scenario: cold-start unsupported timing remains explicit
- **WHEN** `firstPaintMs` or `firstInteractiveMs` cannot be collected for Tauri webview cold start
- **THEN** the report MUST classify the metric as `unsupported`
- **AND** the report MUST include the unsupported reason from the baseline source

### Requirement: Perf Evidence Aggregation MUST Keep Raw Baseline Values Traceable

The evidence gate MUST preserve links from the aggregate summary back to raw perf baseline JSON sources.

#### Scenario: aggregate report references source files
- **WHEN** the runtime performance evidence report is generated
- **THEN** each summarized scenario MUST list the source JSON or report file used
- **AND** missing source files MUST be classified as `unsupported` or `manual-only` with a reason

### Requirement: Browser Long-List Scroll Gate MUST Use Explicit Unsupported Fallback

The `S-LL-1000` browser scroll gate MUST record browser-level scroll evidence when a supported local browser is available and MUST write an explicit unsupported result when it is not available.

#### Scenario: browser scroll gate records measured evidence
- **WHEN** a supported Chrome/Chromium-compatible browser and CDP transport are available
- **THEN** the browser scroll gate MUST write a `S-LL-1000` browser scroll metric with evidence class `measured`
- **AND** the metric MUST include frame count, dropped-frame estimate, duration, scroll height, and viewport height details

#### Scenario: browser scroll gate records unsupported evidence
- **WHEN** no supported browser or CDP transport is available
- **THEN** the browser scroll gate MUST write a `S-LL-1000` browser scroll metric with `value: null`
- **AND** the metric MUST include an `unsupportedReason`

### Requirement: 当前版本 Baseline MUST Use Package Version As Evidence Anchor

性能 baseline refresh MUST 使用当前 package version 与 git commit 作为 evidence anchor；roadmap 文件名只作为规划来源，不得覆盖仓库版本事实。

#### Scenario: baseline target follows package version

- **WHEN** `npm run perf:baseline:all` 生成 latest baseline artifacts
- **THEN** `docs/perf/baseline.md` 与 `docs/perf/baseline.json` MUST 使用 `package.json.version` 作为 target version
- **AND** artifacts MUST include 当前 git commit
- **AND** 当 package version 是 `0.5.9` 时，baseline MUST NOT 声称自己是 `v0.5.8`

#### Scenario: immutable history is written for refreshed version

- **WHEN** baseline refresh 对 package version `0.5.9` 成功完成
- **THEN** system MUST write `docs/perf/history/v0.5.9-baseline.md`
- **AND** system MUST write `docs/perf/history/v0.5.9-baseline.json`
- **AND** older history files MUST NOT be overwritten

### Requirement: Baseline Reports MUST Include Previous-Version Delta Table

refreshed baseline report MUST 对 previous checked-in baseline 与 current baseline 做可追溯 comparison，只比较 scenario id 与 unit 可对齐的 metric。

#### Scenario: comparable metrics show previous and current values

- **WHEN** `docs/perf/baseline.md` 为 refreshed baseline 生成
- **THEN** report MUST include previous value, current value, delta, unit, and evidence class
- **AND** 不可比较 metric MUST 标记为 `missing`、`unsupported` 或 `not comparable` 并附 reason

### Requirement: V0511 Baseline MUST Anchor To Current Package Version And Commit

The current performance baseline MUST use the repository's current `package.json.version` and git commit as its evidence anchor.

#### Scenario: baseline uses current version

- **WHEN** `npm run perf:baseline:all` generates baseline artifacts on `feature/v0.5.11`
- **THEN** `docs/perf/baseline.json` and `docs/perf/baseline.md` MUST identify the baseline as v0.5.11
- **AND** the artifacts MUST include the current git commit

#### Scenario: history artifact preserves versioned evidence

- **WHEN** v0.5.11 baseline generation succeeds
- **THEN** the system MUST write an immutable `docs/perf/history/v0.5.11-baseline*.json` artifact
- **AND** it MUST write the matching markdown history artifact

### Requirement: V0511 Cold Start Timing MUST Require Real Startup Markers

Cold-start first paint and first interactive timing MUST be measured only from real startup marker snapshots.

#### Scenario: startup marker snapshot provided

- **WHEN** `scripts/perf-cold-start-baseline.mjs` receives a valid `--startup-markers` input containing `first-paint` and `first-interactive`
- **THEN** it MUST emit numeric `S-CS-COLD/firstPaintMs` and `S-CS-COLD/firstInteractiveMs` values
- **AND** their evidence class MUST be classified as measured by the aggregate report

#### Scenario: startup marker snapshot missing

- **WHEN** no valid startup marker snapshot is provided
- **THEN** `firstPaintMs` and `firstInteractiveMs` MUST remain `unsupported`
- **AND** the unsupported reason MUST state that Tauri/WebView startup marker evidence was not provided

