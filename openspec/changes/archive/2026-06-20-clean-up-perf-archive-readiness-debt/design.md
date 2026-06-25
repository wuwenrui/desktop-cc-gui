## Context

`perf:archive-readiness` 当前在 normal mode 下没有 hard failure，但仍返回 exit 2：

- 15 个 known residual metrics 被 `scripts/perf-archive-readiness.mjs` `BUDGET_RESIDUALS` 标记为 `budget-missing`。
- `proxyRatio=0.6842`，高于当前 warn threshold `0.5`。
- `docs/perf/runtime-evidence-gates.json` 中仍有 cold-start 与 long-running runtime records 处于 `unsupported`。

这些 warning 当前被 `.github/workflows/perf-archive-readiness.yml` 允许通过，但长期保留会削弱 archive-readiness 的审计意义。该变更只清理 performance evidence governance debt，不借机重构 UI runtime 或放宽 gate。

## Goals / Non-Goals

**Goals:**

- 让 normal-mode `npm run perf:archive-readiness -- --json` 在当前已知 debt 被处理后达到 `status=pass`，即 `hardFailures=[]` 且 `warnings=[]`。
- 为 15 个 residual metrics 建立可审计的 disposition：真实 `budget` block、measured evidence prerequisite，或有 owner 的 accepted deferral。
- 将 `docs/perf/baseline.json`、`docs/perf/runtime-evidence-gates.json` 与 `scripts/perf-archive-readiness.mjs` 的 residual table 保持机械同步。
- 将 release-relevant proxy evidence 尽量升级到 measured runtime evidence，使 `proxyRatio <= 0.5`，或者让剩余 proxy 以 owner / nextAction 的方式显式留痕。
- 保留 hardFail annotation、unit consistency、large-file ownership 等现有 hard gate 语义。

**Non-Goals:**

- 不通过降低 warn threshold、删除 warning、伪造 target / hardFail 来“消音”。
- 不修改 `perf-archive-readiness.yml` 对 exit 2 的当前 advisory 放行语义。
- 不新增外部依赖。
- 不在本变更中实施大型 performance architecture rewrite；新增采集 runner 只限于满足 evidence closure。

## Decisions

### Decision 1: Budget closure uses owner-approved metadata, not synthetic thresholds

选择：每个被预算化的 metric 必须带 `target` 或 `hardFail`、`unit`、`owner`、`source`、`status` / `rollout`。source 必须指向本 change 的 design/spec/task artifact、历史 budget decision table，或已存在的 measured baseline artifact。

备选方案：

- **A. Owner-approved metadata**：可信、可审计，和现有 `runtime-performance-evidence-gates` 保持一致。
- **B. Derived synthetic thresholds**：可以快速把 warning 清零，但没有 owner 认可，会把 risk 藏进 JSON。

取舍：采用 A。对当前缺预算 metrics，允许先在 design/tasks 中记录“不可预算化，必须先采集 measured evidence”，但不能直接移出 residual table。

### Decision 2: Residual table becomes a derived consistency check

选择：`BUDGET_RESIDUALS` 不再作为永久例外清单，而是作为“仍缺真实 budget block 的 known debt”索引。实现时增加测试：如果 `docs/perf/baseline.json` 已经存在对应 budget block，则 residual table 不能继续列该 metric。

备选方案：

- **A. 保留显式 residual table + 测试同步**：审计清晰，变更范围小。
- **B. 完全从 baseline 动态推导 residual warnings**：减少重复，但需要改写 readiness parser 的模型，风险更大。

取舍：采用 A。当前脚本已有 residual table 和测试基础，先把它变成可验证的同步契约，后续如有必要再重构为全动态推导。

### Decision 3: Proxy ratio debt is reduced by upgrading evidence class before relaxing policy

选择：优先把 release-relevant proxy records 升级为 runtime measured records；只有当平台限制明确存在时，才保留 proxy，并附 owner、nextAction、accepted deferral。

备选方案：

- **A. 采集 measured runtime evidence**：最符合 release archive 语义。
- **B. 提高 `PROXY_RATIO_WARN_THRESHOLD` 或移除 proxy warning**：CI 更安静，但 gate 失去方向性。

取舍：采用 A。若某些 proxy 暂时无法测量，design/tasks 必须列出 blocker 和 owner，而不是修改 threshold。

### Decision 4: Unsupported evidence must resolve to measured or explicit unsupported disposition

选择：当前 unsupported records 分两类处理：

- Cold-start `firstPaintMs` / `firstInteractiveMs`：优先通过 cold-start runner 或现有 history artifact 升级为 measured，并补预算源。
- Long-running runtime records：如果采集路径不可用，则保留 unsupported 但必须有 owner、platform qualifier、release decision 与 nextAction。

备选方案：

- **A. 对 unsupported 做分类 closure**：保留真实性，支持跨平台差异。
- **B. 将 unsupported 统一从 warning 中排除**：短期通过，但会丢失 release 风险。

取舍：采用 A。unsupported 不是错误本身，但必须可解释、可追踪、可复核。

## Implementation Shape

1. 建立 residual inventory。
   - 从 `npm run perf:archive-readiness -- --json` 生成当前 15 个 `budget-missing`、proxy ratio summary、unsupported records。
   - 将 records 分组：long-list、input latency、realtime projection、cold-start、long-running runtime。

2. 更新 spec delta。
   - 修改 `runtime-performance-evidence-gates`，补充 archive-readiness debt cleanup 的要求。
   - 明确 residual table 与 baseline budget block 的同步规则。

3. 更新 evidence artifacts。
   - 对 owner-approved metrics，在 `docs/perf/baseline.json` 加 budget block。
   - 对 measured runtime records，在 `docs/perf/runtime-evidence-gates.json` 或 source evidence artifact 中保留 evidenceClass、source、unit、owner、status。
   - 对不能立即测量的 records，保留 explicit unsupported disposition，不伪装为 pass。

4. 更新 readiness script 和 tests。
   - 调整 `BUDGET_RESIDUALS`，移除已预算化 records。
   - 补 `scripts/perf-archive-readiness.test.mjs` 覆盖：budgeted record 不能仍是 residual；normal mode 当前 known debt 清理后 warnings 为 0；proxy ratio warning 的 owner / nextAction 不丢失。

5. 验证。
   - `openspec validate clean-up-perf-archive-readiness-debt --strict --no-interactive`
   - `node --test scripts/perf-archive-readiness.test.mjs`
   - `npm run --silent perf:archive-readiness -- --json`
   - 如触碰 TS evidence generator，再运行对应 generator tests。

## Risks / Trade-offs

- [Risk] 直接从历史 baseline 推导 budget 可能把旧机器/旧版本数据误当 release target → Mitigation: budget source 必须标明版本、artifact、owner，必要时使用 `rollout: "advisory-until-runtime-trace"`。
- [Risk] 降低 proxy ratio 可能需要新增 runtime collection，工作量超过单次 cleanup → Mitigation: 优先 release-required records；其余 proxy 必须记录 accepted deferral，而不是修改 threshold。
- [Risk] `docs/perf/baseline.json` 与 `runtime-evidence-gates.json` 字段形态不一致 → Mitigation: 先扩测试 fixture，再改 parser，确保 unit / budget metadata 检查仍保持 hard fail。
- [Risk] Normal-mode warnings 清零可能被误解为 release-grade 全通过 → Mitigation: release mode 仍保留更严格的 unsupported/proxy/hardFail 判断，proposal/spec 中区分 normal readiness 与 release readiness。

## Migration Plan

1. Land OpenSpec artifacts: proposal, spec delta, design, tasks.
2. Add parser tests that describe the desired end state before editing JSON evidence.
3. Update baseline/evidence JSON and residual table in one commit-sized slice.
4. Run readiness gate and strict OpenSpec validation.
5. If measured evidence cannot be collected on the current platform, keep explicit unsupported disposition and leave tasks unchecked until owner accepts the deferral.

Rollback strategy:

- Revert changes to `docs/perf/baseline.json`, `docs/perf/runtime-evidence-gates.json`, and `scripts/perf-archive-readiness.mjs` together.
- Because this change does not alter runtime user behavior, rollback impact is limited to governance gate output.

## Open Questions

- Which existing baseline artifact should be the owner-approved source for long-list commit duration budgets: `docs/perf/long-list-baseline.json` or a newer v0.5.11 history artifact?
- Are cold-start first paint / first interactive budgets release-blocking for v0.5.11, or accepted deferral with explicit platform qualifier?
- Should `proxyRatio <= 0.5` be required for normal mode, release mode, or both after this cleanup lands?
