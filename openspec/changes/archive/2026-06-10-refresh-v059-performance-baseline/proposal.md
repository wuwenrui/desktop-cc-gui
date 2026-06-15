# refresh-v059-performance-baseline

## Summary / 摘要

基于 `docs/perf/v0.5.8-performance-optimization-roadmap.md` 启动性能优化，但本次 baseline 必须锚定当前仓库事实：`ccgui@0.5.9`。目标是在后续 P0 优化前刷新 release-grade performance evidence，避免继续用 `v0.5.6` baseline 评估当前分支收益。

## Problem / 问题

roadmap 明确指出当前 checked-in baseline 仍是 `v0.5.6`，而当前 `package.json` 与 `src-tauri/tauri.conf.json` 版本是 `0.5.9`。如果直接用旧 baseline 评估优化，会把 version drift、build output drift、dependency drift 和真实 optimization impact 混在一起。

同时，runtime evidence 仍存在 release 判断缺口：cold-start webview `firstPaintMs` / `firstInteractiveMs` 是 `unsupported`，realtime visible lag 缺少端到端 trace correlation，release budget 也没有和 observed value 形成稳定结构化合同。

## Goals / 目标

- 为当前 `0.5.9` 分支生成 fresh baseline，作为后续 P0 优化的 comparison anchor。
- 写入 immutable history：`docs/perf/history/v0.5.9-baseline.{json,md}`。
- 更新 latest baseline：`docs/perf/baseline.{json,md}`。
- 重新生成 `runtime-evidence-gates`，保留 `measured` / `proxy` / `unsupported` / `manual-only` evidence class。
- 增加 `v0.5.6 -> v0.5.9` comparison table，只比较 scenario id 与 unit 可对齐的 metric。
- 在 baseline JSON / markdown 中补充 `target` 与 `hardFail` budget fields，方便后续 gate fail-fast。

## Non-Goals / 非目标

- 本 change 不做 bundle/CSS/startup/realtime/search/file-preview 的具体优化。
- 不伪造当前 harness 采不到的 Tauri webview timing。
- 不改变用户可见行为。
- 不重写 perf harness 架构，只补齐 baseline artifact 与 release evidence contract。

## Approach / 方案

1. 在当前 HEAD 执行 `npm run perf:baseline:all`。
2. 将当前 package version 与 git commit 写入 baseline header 和 JSON metadata。
3. 持久化 `docs/perf/history/v0.5.9-baseline.{json,md}`，不覆盖旧版本 history。
4. 覆盖更新 `docs/perf/baseline.{json,md}`。
5. 重新生成 `docs/perf/runtime-evidence-gates.{json,md}`，unsupported/proxy 不能被描述成 measured。
6. 增加 previous/current/delta/unit/evidenceClass comparison table。
7. 为 bundle/runtime gate 增加 observed、target、hardFail、evidenceClass 字段。

## Risks / 风险

- baseline 脚本可能暴露现有 unsupported 或 flaky evidence；处理策略是记录事实，不隐藏问题。
- roadmap 文件名是 `v0.5.8`，但执行目标是当前 `0.5.9`；文档必须明确这个版本差异。
- 生成文件 diff 可能较大，review 应重点看 schema、version、evidence class、budget fields 是否正确。

## Acceptance Criteria / 验收口径

- `docs/perf/baseline.md` header 显示 `v0.5.9` 和当前 commit。
- `docs/perf/history/v0.5.9-baseline.{json,md}` 存在，旧 history 未被覆盖。
- `runtime-evidence-gates` 明确区分 measured/proxy/unsupported/manual-only。
- baseline report 包含可比较 metric 的 `v0.5.6 -> v0.5.9` delta table。
- 后续 P0 change 能引用结构化 budget fields，而不是解析叙述文本。

## Validation / 验证

- `npm run perf:baseline:all`
- `npm run check:bundle-chunking`
- `npm run perf:long-list:browser-scroll`
- `openspec validate refresh-v059-performance-baseline --strict --no-interactive`
