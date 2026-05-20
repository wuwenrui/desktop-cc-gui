## Context

当前治理证据链路已经有一个可用骨架：`useGovernanceEvidence()` 读取 workspace 文件，`collectGovernanceEvidence()` 汇总 OpenSpec、artifact、script、workflow、Trellis reader，`GovernanceEvidenceSnapshot` 再进入 checkpoint policy/audit。问题不在“没有桥”，而在“桥的 source selection 太早被 mossx/harness 固化”。

现状的典型失真：

- `KNOWN_HARNESS_SCRIPTS` 固定期待 8 个治理脚本。
- `GOVERNANCE_WORKFLOWS` 固定期待 large-file 与 heavy-test workflow。
- artifact reader 固定读取 `.artifacts/large-files-*` 与 `.artifacts/heavy-test-noise.json`。
- OpenSpec reader 只给总 task 进度，不区分 active change、risk、action。
- Cost/Budget UI 对 `pricing unavailable` 和 `budget unconfigured` 的行动指引不足。
- 当前 Cost/Budget 更深一层的问题是数据链路断裂：active thread id 可能没有传入，budget 没有接入，pricing fixtures 覆盖有限，token 细分和累计成本没有产品化呈现。

这会让不同项目看到相同治理项。普通 Node、Python、Rust、Go、Maven、Gradle 项目会被 mossx 专用 evidence 污染；反过来，这些项目真正重要的 `pytest`、`cargo clippy`、`go test`、`mvn verify`、`gradle check` 等证据又不会被准确表达。

本设计保持现有只读、in-memory、advisory-first 边界，不新增后台执行器、不写 OpenSpec/Trellis、不引入远程 API。核心是把“固定清单”改成“项目画像驱动的 adapter registry”。

## Goals / Non-Goals

**Goals:**

- 建立 `ProjectGovernanceProfile`，从 workspace files/config/artifacts 识别项目治理画像。
- 支持可选 `governance.config.json` v1 作为 profile override，而不是强制每个项目先写配置。
- 建立 `EvidenceAdapter` registry，让每类 evidence 先声明 `appliesTo(profile)` 再收集。
- 保持 `GovernanceEvidence` 和 `GovernanceEvidenceSnapshot` 作为唯一桥接 substrate，不创建第二套治理模型。
- 将 UI 从扁平 evidence list 改为 grouped action model：`needs_action`、`watch`、`passed`。
- 让 non-pass evidence 必须包含 `impact`、`source`、`suggestedAction` 或明确的 no-action rationale。
- 让 Cost/Budget 清晰区分 pricing、usage、budget 三类缺口，并逐步产品化为 Token Breakdown、Accumulated Cost、Budget Bar。
- 为 Node/TS、Python、Rust、Go、Maven、Gradle、generic、OpenSpec/Trellis/mossx profile 提供 fixture 级验证。

**Non-Goals:**

- 不执行 shell，不自动运行 test/lint/build。
- 不读取远程 GitHub branch protection、CodeQL、Dependabot 状态；这些可作为未来 remote evidence adapter。
- 不新增独立治理 dashboard。
- 不把 profile 缺失当成失败；未声明、未检测到的 capability 默认不显示。
- 不强制成本阈值打断 runtime。
- 不把 remote pricing sync、多模型并排成本对比、跨 workspace 成本聚合塞进本 change。

## Decisions

### Decision 1: ProjectGovernanceProfile 是 adapter 输入，不是 UI DTO

`ProjectGovernanceProfile` 只描述项目事实：文件、生态、工具链、治理目录、CI、artifact、agent 配置、package manager、known commands。它不直接决定 UI 文案，也不保存用户交互状态。

```ts
type ProjectGovernanceProfile = {
  ecosystems: readonly GovernanceEcosystem[];
  governanceSystems: readonly GovernanceSystem[];
  packageManagers: readonly PackageManager[];
  ciProviders: readonly CiProvider[];
  files: readonly string[];
  scripts: Readonly<Record<string, string>>;
  artifacts: readonly GovernanceArtifactRef[];
};
```

替代方案：让每个 reader 直接扫描 `files`。这会继续把探测逻辑散落到多个 reader，难以保证“不可用不显示”的全局语义。

### Decision 2: EvidenceAdapter 负责 applicability，collector 负责 orchestration

每个 adapter 必须声明：

```ts
type EvidenceAdapter = {
  id: string;
  appliesTo(profile: ProjectGovernanceProfile): boolean;
  collect(context: EvidenceCollectionContext): Promise<readonly GovernanceEvidence[]>;
};
```

Collector 只做三件事：创建 profile、筛选 adapters、并发 collect。Adapter 不应在 render/policy path 做 I/O；现有 `readWorkspaceFile` 仍只存在 collection runtime。

替代方案：保留固定 `collectGovernanceEvidence()` 顺序，只在 reader 内判断缺失。这会让不适用 evidence 继续泄漏到 UI。

### Decision 3: 证据状态与 UI 分组分离

`GovernanceEvidence.status` 继续保持 `pass | warn | fail | unknown`。UI 额外通过 view model 归组：

- `needs_action`: `fail`、degraded critical、pricing unavailable、malformed required artifact。
- `watch`: `warn`、stale、optional missing result、partial task progress。
- `passed`: healthy `pass`。

这样 policy 仍可 advisory-first，UI 又能突出用户要处理什么。

替代方案：新增更多 status，例如 `not_applicable`。这会污染 policy 语义，也容易把“不显示”误做成“显示一个不适用行”。

### Decision 4: 不适用不显示；应有但缺失才显示 unknown/warn

这是本变更的核心 UX 规则。

示例：

- 没有 `openspec/` 的项目，不显示 OpenSpec tasks unknown。
- 有 `openspec/` 但没有 parseable tasks，显示 OpenSpec degraded evidence。
- 没有 `.artifacts/large-files-gate.json` 的普通 Python 项目，不显示 large-file artifact missing。
- mossx profile 检测到 large-file script/workflow 后，如果 artifact 缺失，则显示 missing artifact + suggested command。

替代方案：所有 known adapter 都显示 `unknown`。这正是当前“不智能”的来源。

### Decision 5: Cost/Budget 进入同一套 actionability 模型

Cost/Budget 不再只显示 session amount 和一个 degraded 文案。它要输出可分组证据：

- `pricing-unavailable`: 需要处理，动作是添加 pricing source / alias / 标记不计费。
- `pricing-stale`: 观察，动作是刷新 pricing source。
- `budget-unconfigured`: 观察或提示，动作是设置 session/workspace budget。
- `usage-unavailable`: 观察，动作是等待 usage snapshot 或检查 engine usage bridge。
- `threshold-crossed`: 按 tier 显示 action/watch。

替代方案：继续把 Budget 作为 CostBudgetSection 内部私有状态。这样 checkpoint policy 与 governance evidence 无法复用成本信号。

### Decision 6: 远程治理事实延后

GitHub branch protection、required checks、Dependabot、CodeQL、secret scanning、SLSA provenance attestation 等远程事实有价值，但需要权限、token、网络、隐私边界和 cache 策略。本轮只做本地静态/工件 evidence，保留 remote adapter 扩展位。

### Decision 7: governance.config.json 是 override，不是必需入口

吸收旧提案中的 `governance.config.json` 价值，但调整其定位：它不是项目治理证据的唯一来源，而是自动画像之上的 explicit override。

v1 形态：

```jsonc
{
  "$schema": "https://mossx.dev/schemas/governance.config.v1.json",
  "version": 1,
  "scripts": [
    {
      "name": "check:large-files:gate",
      "label": "Large-file hard gate",
      "required": true
    }
  ],
  "workflows": [
    {
      "path": ".github/workflows/large-file-governance.yml",
      "label": "Large-file workflow"
    }
  ],
  "gates": [
    {
      "name": "Large-file hard gate",
      "artifact": ".artifacts/large-files-gate.json",
      "severity": "warn"
    }
  ],
  "openspec": { "root": "openspec" },
  "trellis": { "root": ".trellis" }
}
```

Merge semantics:

1. Auto profile 先从 workspace facts 推断。
2. Config profile 后加载，用于添加、命名、标记 required、覆盖 root 或 artifact severity。
3. Config 缺失不是错误；config malformed 是 `watch` 或 `needs_action` evidence，但不能阻断其他自动证据。
4. 生成模板只生成空骨架，绝不复制 mossx 内部 profile。

替代方案：强制所有项目创建 config。拒绝，因为这会把“智能识别”退化成“用户先写配置”。

### Decision 8: CostBudgetSection 拆成容器 + 三个决策子模块

吸收旧提案的 Cost/Budget UI 结构：

| 子模块 | 回答的问题 | 关键状态 |
|---|---|---|
| `TokenBreakdownBar` | token 怎么花的？ | input / output / cached / reasoning breakdown |
| `AccumulatedCostCard` | 已经花了多少？ | Session / Today / Month |
| `BudgetBar` | 离预算还有多远？ | monthly limit / remaining / 80% / 100% |

这三个模块不需要同时一次性完整上线。第一阶段先保证 pricing unavailable/token-only 可用，第二阶段再引入累计和预算。

替代方案：继续扩展单个 `CostBudgetSection`。拒绝，因为它会把 pricing、usage、budget、history、settings 全塞进一个组件。

### Decision 9: Token-only fallback 是成本模块的硬语义

当 `lookupPricingSource()` 找不到 engine/model pricing 时，UI 必须进入 token-only mode：

- token breakdown 继续显示。
- 金额、budget progress、累计金额隐藏或标记 unavailable。
- evidence 明确显示 engine/model 和缺失原因。
- 绝不显示 `$0.00`，除非真实计算结果为零。

这个语义比“补某个模型 fixture”更重要；补 fixture 只能解决单点模型，token-only fallback 解决未知模型的一类问题。

### Decision 10: Cost history 和 budget 先走本地 store

采用 zustand + localStorage：

```ts
type BudgetState = {
  monthlyLimitUsd: number | null;
  alertThresholds: readonly number[];
};

type CostHistoryEntry = {
  sessionId: string;
  engine: string;
  model: string | null;
  usage: ThreadTokenUsage;
  amountUsd: number | null;
  pricingSourceId: string | null;
  occurredAt: string;
};
```

localStorage 写失败时降级为内存态，并显示非阻断 warning。

替代方案：Tauri backend JSON storage。延后，因为它涉及 IPC、跨设备同步和迁移策略，应与未来 sync/storage change 统一处理。

### Decision 11: Pricing source 显式版本化，alias 必须可追溯

Pricing source 已有 `lastUpdatedAt`，后续 UI 要把它当成一等事实展示。旧提案里的 `pricedAt` 可以被吸收为 `lastUpdatedAt` 或等价字段，不要求平行字段。

规则：

- 未知模型不能 silent fallback 到相邻模型价格。
- alias 必须显式配置，并在 cost record 中暴露 resolved source。
- fixture/config/remote 三类 source 都必须携带更新时间。

### Decision 12: statusPanel.costV2 feature flag 分阶段启用

成本 UI 改动面比治理 evidence adapter 更贴近用户操作，必须可灰度：

- flag off：保留现有 cost UI。
- flag on：启用 TokenBreakdownBar / AccumulatedCostCard / BudgetBar。
- token-only fallback 和 pricing unavailable 语义可以先进入老 UI，因为它们属于 bug fix 级别的准确性提升。

### Decision 13: 分三阶段交付

- Phase 1 Stop the bleeding：修复 activeThreadId、pricing unavailable/token-only、预算未配置表达。
- Phase 2 Decouple governance profile：profile detector + optional config override + adapter registry。
- Phase 3 Productize Cost/Budget：三子组件、history store、budget settings、feature flag。

## Risks / Trade-offs

- [Risk] Profile 误判生态，导致 evidence 缺失。
  Mitigation: 多生态项目允许 profile 同时包含多个 ecosystems；fixture 覆盖混合 Node+Rust/Tauri。

- [Risk] Adapter registry 过度抽象。
  Mitigation: 先只抽通用 contract 与 6-8 个高价值 adapter，不引入 plugin loader。

- [Risk] UI 分组隐藏了通过项细节。
  Mitigation: `passed` 默认折叠但可展开；计数必须可见。

- [Risk] Suggested action 看起来像自动执行。
  Mitigation: action 只作为文案/命令建议，不在 evidence path 自动执行。

- [Risk] 成本 pricing source 不全，继续出现 unavailable。
  Mitigation: unavailable 不是失败静默，而是 needs-action evidence；实现配置/alias 入口可后续分片完成。

- [Risk] optional config 被误解成必须配置。
  Mitigation: 文案和 tests 明确“无 config 仍自动识别”；config 只作为 override。

- [Risk] localStorage 成本历史被清理或写失败。
  Mitigation: UI 降级到 session-only/in-memory，并显示非阻断提示。

## Migration Plan

1. Phase 1：修复 Cost/Budget 当前可见断点，确保 unknown pricing/token-only/active session/budget unconfigured 可解释。
2. Phase 2：添加 profile detector、optional config override、fixture tests。
3. Phase 2：将现有 OpenSpec/Trellis/script/workflow/artifact readers 包装为 adapters。
4. Phase 2：将 mossx harness scripts/workflows/artifacts 的适用条件收窄到检测到相关 files/scripts/workflows 或 config override。
5. Phase 2：添加 grouped evidence view model，并让 `GovernanceEvidenceSection` 消费 view model。
6. Phase 3：拆分 CostBudgetSection 为 TokenBreakdownBar / AccumulatedCostCard / BudgetBar，并引入 local stores 与 settings。
7. 更新 conformance check，禁止新增全局固定 mossx-only evidence list。
8. 跑 focused Vitest、typecheck、OpenSpec strict validation。

Rollback 策略：保留现有 reader 函数签名；adapter migration 出现问题时，可让 registry 临时只启用现有 mossx-compatible adapters，但不得恢复全局固定 unknown 展示。

## Open Questions

- Budget 配置第一阶段只支持 session-level，还是同时支持 workspace-level 默认预算？
- Pricing source 配置入口是否属于本 change，还是拆到 follow-up？
- Remote CI/security evidence adapter 是否要单独建 change，以便处理 token 与权限边界？
- `governance.config.json` schema 是否放在 `schemas/` 还是 `src/features/governance/config/` 旁边，取决于项目现有 schema 管理约定。
