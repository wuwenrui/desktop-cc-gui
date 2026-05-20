## Context

Harness governance 当前已经具备 evidence bridge、checkpoint policy chain、policy audit surface、gate artifact reader 和 StatusPanel checkpoint 呈现路径。上一阶段的目标是把治理事实接入 checkpoint；本阶段要校准它的产品语义：治理信号先作为提示和解释存在，而不是默认变成阻塞。

当前约束：

- AI 执行链路必须保持连续，不能因为治理信号误判而频繁中断。
- 已有 runtime/fatal/core policy failure 的阻塞语义不能被削弱。
- Governance evidence 已经携带 source、observedAt、artifactPath、artifactHash、stale/degraded reason 等 provenance，可以支撑解释型视图。
- Checkpoint 视图已经承载 verdict、evidence、policy audit、next action，但信息层次需要更清晰地区分 advisory 与 blocking。

## Goals / Non-Goals

**Goals:**

- 将 bridge 已有和新增消费的 harness governance 信号默认限定为 advisory-only。
- 让 optional governance policy 的贡献上限保持在 `needs_review`，不得新增 `blocked`。
- 重构 checkpoint presentation structure，使 Summary、Advisory Signals、Evidence Trail、Policy Audit、Suggested Actions 有稳定层级。
- 让 dock / popover / compact 视图保持同源 verdict，同时按空间压缩展示 advisory 信息。
- 用测试和 conformance check 证明 advisory governance 不阻碍 AI 执行链路。

**Non-Goals:**

- 不新增 CI blocking gate。
- 不重写 checkpoint policy engine。
- 不新增独立 governance dashboard。
- 不引入新的持久化、telemetry export 或远端治理服务。
- 不把当前阶段的 platform qualifier、spec warning、stale artifact 自动升级为 hard failure。

## Decisions

### Decision 1: Advisory-first is a policy contribution rule, not just UI wording

Governance 信号不能只在 UI 上换成温和文案；policy contribution 必须从源头限制。bridge 已有和新增 governance policy 默认只能返回 `needs_review`、`running`、`ready` 或 `no_contribution`。`blocked` 仍保留给已有 core policy 的 runtime/fatal failure。

Alternatives considered:

- UI-only softening：实现快，但 policy audit 仍可能产生 blocked，用户看到的语义会自相矛盾。
- 删除治理 policy contribution：不会阻塞，但也会丢失 checkpoint 对风险的结构化解释。

### Decision 2: Checkpoint structure is refactored as presentation composition

Checkpoint 结构重构应优先发生在 presentation/view-model 层：把已有 verdict、governance evidence、policy decisions 和 next actions 投影为固定 section，而不是重写 evidence reader 或 policy engine。

Alternatives considered:

- 重写 policy engine：风险高，会影响已有 checkpoint 测试和 hard failure 语义。
- 新增 Governance dashboard：会分散当前回合决策入口，用户需要跳转才能理解风险。

### Decision 3: Compact hosts preserve signal summary instead of full audit

Dock expanded view 可以展示完整 Evidence Trail 和 Policy Audit；popover / compact view 不应默认塞入完整 audit table，但必须保留 advisory count、highest advisory level、source summary 和展开入口。

Alternatives considered:

- Compact view 完全隐藏治理信号：降低噪音，但会制造 dock/popover 信息不一致。
- Compact view 展示完整 audit：信息完整，但会破坏 composer 附近的轻量交互。

### Decision 4: Suggested Actions are executable recommendations, not gate triggers

Suggested Actions 可以指向已有命令或详情入口，例如 OpenSpec validate、large-file gate、heavy-test-noise sentry、policy audit expansion；但点击或展示建议不得自动触发 blocking 状态。

Alternatives considered:

- 自动执行建议命令：更积极，但会引入不可控耗时和平台差异。
- 只显示静态文案：最安全，但无法帮助用户快速修复 evidence 缺口。

## Risks / Trade-offs

- [Risk] Advisory-only 可能让真实风险继续前进。 → Mitigation: 明确保留已有 runtime/fatal/core policy blocking；advisory rows 必须给出具体 source、reason 和 suggested action。
- [Risk] UI section 增多导致 checkpoint 变重。 → Mitigation: dock expanded 承载完整信息，compact/popover 只展示汇总与展开入口。
- [Risk] 开发者误把新 governance warning 写成 blocked。 → Mitigation: 增加 policy tests 和 conformance check，扫描 optional governance policy 的 contribution ceiling。
- [Risk] Evidence Trail 暴露过多底层字段。 → Mitigation: 默认展示 source、observed time、artifact identity 和 degradation reason；hash/path 细节可折叠。
- [Risk] 语义软化被误解为降低质量门槛。 → Mitigation: tasks 中保留 typecheck、focused tests、OpenSpec strict validation；只是不把提示转成自动阻塞。

## Migration Plan

1. 更新 delta specs，先固化 advisory-only 和 checkpoint section contract。
2. 调整 policy/view-model，使 bridge 已有和新增 governance policy contribution ceiling 低于 `blocked`。
3. 重构 CheckpointPanel 或其 view-model projection，加入稳定 section 结构。
4. 更新 audit rendering，使 advisory 与 blocking 在文案和视觉语义上可区分。
5. 增加 focused tests，覆盖 advisory 不阻塞、compact parity、evidence provenance 展示和 suggested actions。
6. 运行 OpenSpec、typecheck、checkpoint/policy/audit 相关测试和 governance conformance checks。

Rollback strategy:

- 回滚 presentation 重构时保留 policy contribution ceiling，避免重新引入 blocking。
- 若 UI 重构引入回归，可先恢复旧 CheckpointPanel 布局，但保留 advisory-only policy tests。
- 若 conformance check 误报，先降级为 warning 输出，不把它接入 blocking workflow。

## Open Questions

- Suggested Actions 是否需要支持一键复制命令，还是只显示命令文本与已有入口。
- Evidence Trail 的 artifact hash 默认是否折叠，取决于当前 checkpoint 面板可用宽度。
- 是否需要单独的 i18n namespace，例如 `statusPanel.checkpoint.advisory.*`，还是复用现有 `statusPanel.policy.*`。
