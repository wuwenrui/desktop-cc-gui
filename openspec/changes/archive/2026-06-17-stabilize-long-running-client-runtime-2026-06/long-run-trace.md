# Long-Run Trace Status (Phase 5.4)

> 状态:本 change 内不进行 15-30min Tauri/WebView trace(需要真实 desktop runtime,
> 不在沙箱环境内执行)。Evidence gate 已在 `evidence.md` 里以 `proxy` / `unsupported` 标注。
> Release-grade `measured` 数据需在后续 `release-grade-evidence` change(`task 6.4`)
> 里补全,使用 `bash scripts/perf-reproduce-jank.sh` 在 macOS desktop 上跑。

## Trace 计划(留给 release-grade-evidence change)

- **Platform**: macOS 15 (开发机器当前 OS)
- **Duration**: 15-30min
- **Tool**: `bash scripts/perf-reproduce-jank.sh` (仓库已有)
- **Outputs to capture**:
  - `S-LR-100` registered active process count per minute
  - `S-LR-101` sampled OS child count (需要补 sampler,见 `task 5.4` 后续)
  - `S-LR-200` module switch p95 (real timing, 切换 200 workspaces)
  - `S-LR-210` visible row count per workspace switch
  - `S-LR-300` worker pending count timeline
  - `S-LR-310` streaming visible lag p95 (reuses chat-stream baseline)
- **Platform qualifier**: Windows / Linux OS sampling 当前 `unsupported`,
  需要在 release-grade-evidence change 内补 `psutil` 或 `/proc` reader

## 当前 evidence 状态

| Metric | Evidence class | Notes |
|---|---|---|
| S-LR-100 | measured (command) | diagnostics command 实测;registry count vs OS liveness 已分两路 |
| S-LR-101 | unsupported | 仓库无跨平台 OS sampler;`os_child_liveness.evidence_class="unsupported"` |
| S-LR-110 | measured (registry) | stale candidates 数组;progress metadata 缺失 engine 标 `unsupported` |
| S-LR-200 | unsupported | jsdom 不能产真实 module switch latency |
| S-LR-210 | proxy | jsdom test 验证 `data-virtualized="true"` 标记 + spacer 元素 |
| S-LR-300 | proxy | jsdom test 验证 fallback / dispose counter 行为 |
| S-LR-310 | proxy (reuses chat-stream) | 继承 `chat-stream-render-isolation-2026-06` baseline |

## 把 release-grade 留给后续

按 proposal `task 6.4`:
- Owner: `release-grade-evidence`
- 不在本 change 内实现
- 升级 `S-LR-*` proxy budgets 到 measured runtime/WebView evidence
