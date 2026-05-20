## Why

Harness governance 已经形成证据采集、policy audit、checkpoint 呈现的基础闭环；下一阶段的主要风险不是“检查不够多”，而是治理信号过早变成阻塞，打断 AI 执行链路并放大误判成本。

本变更将 harness governance 的默认产品语义校准为 advisory-only：先把风险、证据、来源和建议动作讲清楚，不新增 blocking gate；同时重构 checkpoint 视图结构，让用户能快速理解当前状态，但不因为治理提示而被系统强制拦停。

## 目标与边界

- 将 bridge 已有和新增消费的 harness governance 信号默认定义为 advisory warning / informational evidence，而不是 blocking failure。
- 保持 AI 执行链路连续：治理层可以提示、解释、建议复跑命令，但不能新增自动阻断。
- 重构 checkpoint 视图的信息结构，使其稳定表达 summary、advisory signals、evidence trail、policy audit、suggested actions。
- 明确 dock / popover / compact 视图的信息边界，避免 UI 重构造成核心风险和证据丢失。
- 复用现有 governance evidence bridge、checkpoint policy chain、policy decision audit surface 和 status-panel checkpoint module，不创建平行治理产品层。

## 非目标

- 不新增或扩大 CI blocking gate。
- 不把 advisory warning 升级为 `blocked` verdict。
- 不改变现有 runtime / fatal failure 的阻塞语义；已有 hard failure 仍按当前 core policy 处理。
- 不新增 telemetry export、持久化 governance store、EventBus、远端上报或独立 dashboard。
- 不重写 policy engine；本变更优先约束语义和 checkpoint presentation structure。
- 不要求当前阶段提供三平台实际 CI 结果作为执行阻塞前置条件。

## What Changes

- Governance evidence 的默认消费语义调整为 advisory-first：
  - 已有和新增 bridge evidence 出现证据缺口、stale artifact、platform qualifier、spec warning、large-file near-threshold、heavy-test-noise warning 等信号时，默认只能贡献 `needs_review`、`ready`、`running` 或 `no_contribution`。
  - 除已有 runtime/fatal/core policy failure 外，不得由本变更新增 `blocked` 贡献。
- Checkpoint 视图结构重构为稳定分区：
  - `Summary`: 当前 checkpoint verdict 与一句话结论。
  - `Advisory Signals`: 非阻塞治理提示，突出风险但不拦截执行。
  - `Evidence Trail`: 展示 evidence source、observed time、artifact path/hash、stale/degraded reason。
  - `Policy Audit`: 展示 policy id、贡献级别、命中原因、source id。
  - `Suggested Actions`: 给出可执行建议，例如复跑 OpenSpec validate、large-file gate、heavy-test-noise sentry，但不强制执行。
- UI 文案和视觉层级必须区分 advisory 与 blocking：
  - advisory 用提示/建议语气。
  - blocking 仅用于既有 hard failure。
  - 不允许用红色 fatal 语义渲染普通 governance warning。
- Compact / popover 视图可隐藏详细 audit，但必须保留 advisory count、最高风险级别和可展开入口。
- Future implementation tasks must validate that advisory governance does not block AI execution flow.

## 技术方案取舍

| Option | Description | Trade-off | Decision |
|---|---|---|---|
| A. 继续推进 risk-aware blocking gate | 在 checkpoint/archive/merge 阶段自动阻断高风险治理缺口。 | 理论上更严格，但容易误伤 AI 连续执行；当前 evidence 仍有 platform qualifier 和历史 warning，过早阻塞会放大治理层自身不确定性。 | Rejected for current phase. |
| B. Advisory-only governance with structured checkpoint view | 治理层只增强提示、证据链、解释和建议动作；checkpoint 通过结构重构提高可读性。 | 对错误的硬拦截能力较弱，需要用户或 AI 自觉处理建议。 | Selected. |
| C. 只改文案，不重构 checkpoint structure | 最小改动，只把 blocking wording 改成 warning wording。 | 无法解决当前 evidence、policy audit、next action 混在一起的问题，后续仍容易误读。 | Rejected. |
| D. 新建独立 Governance Dashboard | 把 governance evidence 从 checkpoint 中拆到新页面。 | 会增加产品层复杂度，并削弱 checkpoint 作为当前回合决策面的价值。 | Rejected. |

## Capabilities

### New Capabilities

- None. This change intentionally modifies existing harness governance and checkpoint capabilities instead of adding a parallel governance surface.

### Modified Capabilities

- `governance-evidence-bridge`: default consumed governance evidence semantics become advisory-first unless explicitly mapped to an existing hard failure.
- `checkpoint-policy-chain`: optional governance policies must not add new `blocked` contributions in this phase; advisory policies should cap at `needs_review`.
- `policy-decision-audit-surface`: audit rows must distinguish advisory signals from blocking failures and explain evidence provenance without implying execution was blocked.
- `status-panel-checkpoint-module`: checkpoint surface must adopt the stable advisory-oriented section structure and preserve compact/dock/popover parity.

## Impact

- OpenSpec:
  - `openspec/changes/soften-harness-governance-to-advisory-mode/**`
  - Future delta specs for the four modified capabilities listed above.
- Future frontend implementation:
  - `src/features/status-panel/components/**`
  - `src/features/status-panel/utils/checkpoint.ts`
  - `src/features/status-panel/utils/policies/**`
  - `src/features/status-panel/components/audit/**`
  - `src/features/governance/evidence/**`
- Future tests and checks:
  - StatusPanel / Checkpoint rendering tests.
  - Policy chain tests proving advisory governance does not contribute `blocked`.
  - Bridge/audit conformance checks proving evidence remains visible and non-blocking.

## Acceptance Criteria

- OpenSpec proposal, design, specs, and tasks are complete and pass strict validation.
- The spec delta explicitly states that existing and new bridge-consumed governance evidence is advisory-only by default.
- Optional governance policy contributions are capped below `blocked` unless a future proposal explicitly changes this rule.
- Checkpoint view structure is specified with stable sections for summary, advisory signals, evidence trail, policy audit, and suggested actions.
- Compact and popover views preserve advisory visibility without rendering the full audit table by default.
- Existing hard failure semantics remain intact for runtime/fatal/core policy failures.
- No product code or CI workflow is changed by the proposal artifact itself.
