# Design / 设计

## Baseline Artifact Contract / 产物合同

| Artifact | Purpose | Mutability |
|---|---|---|
| `docs/perf/baseline.{json,md}` | latest baseline，供脚本和 reviewer 使用 | 每次 refresh 可覆盖 |
| `docs/perf/history/v0.5.9-baseline.{json,md}` | 当前版本 immutable evidence | 创建后不覆盖 |
| `docs/perf/runtime-evidence-gates.{json,md}` | evidence strength 与 release readiness 分类 | 随 latest baseline 重新生成 |

版本锚点必须来自 `package.json.version`。roadmap 文件名只说明规划来源，不作为 baseline target version。

## Evidence Classes / 证据等级

- `measured`：来自 browser、Tauri WebView、React Profiler、PerformanceObserver、native process event 或等价 runtime signal。
- `proxy`：来自 fixture、jsdom、static bundle、synthetic replay 或 helper-only evidence。
- `unsupported`：当前环境或 harness 无法采集。
- `manual-only`：只来自人工验证，需要保留 platform qualifier。

unsupported metric 必须保留 row、`value: null` 和 reason，不能被删除或转写成 pass。

## Budget Fields / 预算字段

baseline JSON 中每个 budgeted metric SHOULD 包含：

- `observed`：本次采集值。
- `target`：下一阶段优化目标。
- `hardFail`：fail-fast threshold。
- `unit`：单位。
- `evidenceClass`：证据等级。
- `source`：原始 artifact path。

这样后续 `bundle budget` / `runtime budget` gate 可以读结构化字段，不需要 scrape markdown。

## Comparison Table / 对比表

markdown baseline 应包含 previous/current/delta/unit/evidenceClass。无法比较的 metric 必须标注 `missing`、`unsupported` 或 `not comparable`，并说明原因。

## Rollback / 回滚

如果 refreshed baseline 无效，只回滚生成的 perf artifacts。本 change 不应该包含业务代码修改，因此 rollback 不应影响 runtime behavior。
