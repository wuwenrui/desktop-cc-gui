## Why

2026-06 performance iteration 的代码侧和 OpenSpec 侧已经基本收口，但当前 release evidence 仍然有三个硬缺口：Tauri cold-start timing 还是 `unsupported`，realtime visible/render evidence 仍主要是 `proxy`，并且 `S-CS-COLD/bundleSizeMain=1121481 bytes-gzip` 超过 `hardFail=1100000`。

这个 change 的目标不是再做一轮大重构，而是把性能迭代从“工程完成”推进到“发布可信”：用可重复 runner 收集真实桌面运行证据，补齐预算口径，并把 bundle hard breach 的处理路径纳入 gate。

> 🛠 **深度推演**：[L2/L3 分析摘要] 根因不是某个指标缺字段，而是 release gate 仍混用了 proxy baseline、manual acceptance 和 measured runtime proof。正确抽象是把 evidence maturity 当成一等 contract：fixture/proxy 可用于回归比较，但不能替代真实 Tauri/webview/runtime evidence。

## 目标与边界

- 建立 release-grade performance evidence collection path，覆盖 Tauri cold-start、realtime streaming、Composer/file typing、long-list/browser scroll、runtime trace aggregation。
- 把 `docs/perf/baseline.json` 中 21 个 `budget-missing` 指标分为两类：有 owner-approved budget 的补结构化 budget，没有阈值来源的继续保留 residual risk，禁止随手编预算。
- 处理当前明确 hard breach：`S-CS-COLD/bundleSizeMain` 必须降到 hard fail 以下，或在 release notes / gate 中保持 blocking 状态，不能被 archive wording 掩盖。
- 将 9 个 `unsupported` evidence records 降低到 0 个，或为仍无法支持的平台给出 explicit platform qualifier 和 release decision。
- 保持现有 performance optimization 行为不被大范围重写；证据采集优先，优化只针对当前 hard breach 做 narrow bundle work。

## 非目标

- 不在本 change 中继续拆所有 10 个 P0/P1 large-file candidates；这些属于 `frontend-modularization-debt` / `backend-modularization-debt` follow-up。
- 不重写 AppShell、runtime reducer、Markdown renderer、workspace listing 或 backend bridge substrate。
- 不把 proxy/jsdom/fixture evidence 伪装成 measured evidence。
- 不新增重型依赖；如必须引入 browser/Tauri runner helper，优先使用现有 Vite/Tauri/Node/Playwright 能力或项目已有脚本。
- 不改变 Tauri command public payload contract，除非只是 additive diagnostics field。
- 不借性能 profiling 改动破坏已有 UI affordance；若 profiling wrapper 改变 React element 结构，必须补回原有 prop injection contract，并用 focused test 锁住。

## What Changes

- 新增或扩展 performance evidence runner：
  - Tauri desktop cold-start evidence：`firstPaintMs`、`firstInteractiveMs`。
  - Realtime streaming runtime evidence：visible text lag、reducer amplification、batch flush duration、terminal settlement。
  - Composer/file typing runtime evidence：keystroke-to-commit、input loss、composition-to-commit、file editor update latency。
  - Long-list/browser evidence：保留现有 browser scroll gate，并把 fixture-only list metrics 标清楚。
- 更新 `docs/perf/baseline.{json,md}` 与 `docs/perf/runtime-evidence-gates.{json,md}`：
  - 将可测指标升级为 `measured`。
  - 保留无法测指标的 platform qualifier。
  - 明确 budget source、owner、rollout/status。
- 更新 archive-readiness gate：
  - `npm run perf:archive-readiness` 对 release-target change 支持 stricter mode。
  - hard breach 不能只作为 warning。
  - unsupported evidence 不能在 release closure 中静默通过。
- 针对 `bundleSizeMain` 做 narrow remediation：
  - 优先检查主 bundle 中还能延迟加载的 feature/runtime surface。
  - 只移动明确不属于 first viewport / startup hot path 的依赖。
  - 不做大型模块重构。

## Capabilities

### New Capabilities

- None. 本 change 收紧 existing performance evidence contract，不新增 capability namespace。

### Modified Capabilities

- `runtime-performance-evidence-gates`: 增加 release-grade evidence collection / strict archive readiness / budget ownership / hard breach handling requirement。

## 技术方案取舍

| Option | Description | Pros | Cons | Decision |
|---|---|---|---|---|
| A. 只继续优化 bundle | 先把 `bundleSizeMain` 压下去，不补 evidence runner。 | 能快速消掉一个 hard breach。 | 仍然无法证明 Tauri cold-start 和 realtime 真实体感，下一轮继续靠 proxy。 | Rejected |
| B. 只补 evidence，不动 bundle | 建 runner 和 gate，保留 bundle breach。 | 证据体系干净，风险小。 | 已知 hard breach 仍会阻塞 release；用户看不到直接收益。 | Rejected |
| C. Evidence-first + narrow bundle remediation | 先建真实证据 runner/gate，再做最小 bundle hard breach 修复。 | 同时解决“可信”和“硬超线”；避免大重构。 | 工作量比单点修复大，需要严格分阶段。 | Accepted |

## Acceptance Criteria

- `openspec validate collect-release-grade-performance-evidence --strict --no-interactive` passes.
- `npm run perf:archive-readiness` gains release-grade mode or equivalent stricter release check, and release mode fails on:
  - hard budget breach without accepted release blocker.
  - `unsupported` evidence for required release metrics without platform qualifier.
  - budgeted metric missing `budget.source` / `owner` / `status` or equivalent annotation.
- `docs/perf/baseline.json` has no unit conflicts and clearly separates:
  - measured release evidence,
  - proxy regression evidence,
  - manual-only acceptance,
  - unsupported platform gaps.
- Tauri cold-start `firstPaintMs` and `firstInteractiveMs` are measured on at least the local supported platform, or explicitly documented as platform-blocked with runner failure evidence.
- Realtime visible lag / reducer amplification / batch flush / terminal settlement have runtime-collected evidence, not only replay-derived proxy evidence.
- `S-CS-COLD/bundleSizeMain` is below `1100000 bytes-gzip`, or the change remains unarchived with an explicit release blocker.
- No broad runtime refactor is mixed into this change; `git diff --stat` should show evidence scripts/docs and narrow bundle remediation only.

## Impact

- Performance docs:
  - `docs/perf/baseline.json`
  - `docs/perf/baseline.md`
  - `docs/perf/runtime-evidence-gates.json`
  - `docs/perf/runtime-evidence-gates.md`
- Scripts:
  - existing perf aggregate / runtime evidence report scripts
  - `scripts/perf-archive-readiness.mjs`
  - possible new release-grade runner script
- Frontend/runtime narrow instrumentation:
  - bounded diagnostics only; no prompt, assistant body, terminal output, file content, or raw diff content.
- Possible narrow bundle remediation:
  - startup lazy boundary or feature style/runtime loader only when proven by bundle analysis.
- Narrow regression correction:
  - `src/features/layout/hooks/useLayoutNodes.tsx` 中的 `Profiler` wrapper 保留 sidebar render profiling。
  - `src/app-shell-parts/renderAppShell.tsx` 必须把 sidebar titlebar `topbarNode` 注入到真正的 `Sidebar` child，而不是注入到 `Profiler` 外壳。

## Regression Note: Sidebar Titlebar Toggle After Profiling Wrapper

2026-06-13 用户反馈左侧区域上方折叠按钮消失。根因不是按钮组件、CSS 或 platform detection 被删除，而是 `25d101a0 feat(perf): 收口实时输入与前端 prop 链稳定性阶段实现` 为 sidebar 增加 `React.Profiler` wrapper 后，旧的 `cloneElement(sidebarNode, { topbarNode })` 将 `topbarNode` 写到了 `Profiler` 上，真正渲染 `SidebarTopbarSlot` 的 `Sidebar` 没收到该 prop。

本 change 接受一个 narrow runtime regression fix：保留 `Profiler id="sidebar"` 与 `handleRuntimeProfileRender`，仅修正 `renderAppShell` 的 topbar injection contract，使 wrapper child 收到 `topbarNode`。该修复不移除 profiling、不新增 runtime subscription、不改变 Tauri command payload，只恢复既有 sidebar collapse affordance。

Required validation:

- `src/app-shell-parts/renderAppShell.sidebarTopbar.test.tsx` 覆盖 `Profiler -> Sidebar child` 注入路径。
- `src/features/layout/utils/sidebarTogglePlacement.test.ts` 覆盖 desktop expanded/collapsed placement。
- `npm run typecheck` 必须通过。
