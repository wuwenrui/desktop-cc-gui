## Why

`npm run perf:archive-readiness -- --json` 当前虽然没有 hard failure，但仍以 `warn` / exit 2 结束：15 个 `budget-missing` records、`proxyRatio=0.6842` 超过 0.5 阈值，并且仍存在 unsupported runtime evidence。现在需要把这些 advisory debt 从“可见但可放行”推进为 owner-approved budgets 与 measured runtime evidence，避免 release archive 长期依赖 warning 例外。

## 目标与边界

- 目标：让 perf archive readiness normal mode 在没有新回归时达到 `ok=true`、`status=pass`、`hardFailures=[]`、`warnings=[]`，并移除当前已还清的 residual table entries。
- 目标：为 long-list、input latency、realtime projection、cold-start、long-running runtime evidence 建立 owner-approved budget / measured evidence / explicit unsupported disposition。
- 边界：只处理 `perf:archive-readiness` 的 residual advisory debt，不扩大到 unrelated UI performance refactor。

## What Changes

- 为当前 15 个 `budget-missing` records 补齐 owner-approved budget metadata，或把不能立即预算化的 record 转为明确的 measured-evidence prerequisite。
- 将 `docs/perf/baseline.json`、`docs/perf/runtime-evidence-gates.json` 与 `scripts/perf-archive-readiness.mjs` 的 `BUDGET_RESIDUALS` 保持同步：已拥有真实 budget block 的 metric 不再出现在 residual table。
- 降低 proxy evidence 占比：优先把 release-relevant proxy metrics 升级为 measured runtime evidence，直到 `proxyRatio <= 0.5`，或在 design 中明确剩余 proxy 的 release blocker / accepted deferral。
- 处理 current unsupported records，尤其是 cold-start first paint / first interactive 与 long-running runtime resource evidence，不再让 unsupported evidence 默默维持 exit 2。
- 不引入 **BREAKING** user-facing behavior；这是 governance / performance evidence contract cleanup。

## 技术方案

| 方案 | 做法 | 取舍 |
|------|------|------|
| A. Contract-first debt cleanup | 先为每类 residual record 建立 owner-approved source，再更新 baseline / runtime evidence / residual table，并补测试锁定 readiness output。 | 选择此方案。它保留 gate 可信度，避免用 synthetic thresholds 掩盖真实风险。 |
| B. Gate relaxation | 调低 proxy ratio 规则，或继续把 missing budget / unsupported evidence 作为 warn-only。 | 不选。它能快速消除 CI 噪音，但会降低 archive-readiness 的审计价值。 |

## 非目标

- 不把 proxy-only evidence 伪装成 measured evidence。
- 不删除 `budget.hardFail` 或 `BUDGET_RESIDUALS` entry 来压低 warning count，除非对应 metric 已有真实 owner-approved budget block。
- 不重构 performance collection architecture；如需新增 runner 或采集链路，应在 design/tasks 中单独拆分。
- 不改变 `perf-archive-readiness.yml` 对 exit 2 advisory 的当前放行语义，除非后续设计明确要求收紧 CI gate。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `runtime-performance-evidence-gates`: tighten the archive-readiness cleanup contract so known residual budgets, proxy ratio warnings, and unsupported runtime evidence have concrete owner-approved closure criteria.

## Impact

- Affected specs: `openspec/specs/runtime-performance-evidence-gates/spec.md`
- Affected scripts: `scripts/perf-archive-readiness.mjs`
- Affected evidence artifacts: `docs/perf/baseline.json`, `docs/perf/runtime-evidence-gates.json`
- Affected validation: `npm run perf:archive-readiness -- --json`, parser/unit tests around perf readiness, and strict OpenSpec validation.
- No new runtime dependency is expected.

## 验收标准

- `npm run perf:archive-readiness -- --json` normal mode reports zero hard failures and zero residual warnings for the currently known 15 budget-missing records.
- Budgeted metrics include `target` or `hardFail`, `unit`, `owner`, `source`, and `status` / `rollout` metadata; no synthetic thresholds are accepted.
- `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` contains only records that still lack a real budget block, and tests fail if a budgeted record remains in the residual table.
- `proxyRatio` is reduced to `<= 0.5`, or the remaining proxy evidence is explicitly classified as accepted release debt with owner and next action.
- Current unsupported records are either upgraded to measured evidence or explicitly scoped as unsupported with a release decision that keeps audit output truthful.
- `openspec validate clean-up-perf-archive-readiness-debt --strict --no-interactive` passes before implementation begins.
