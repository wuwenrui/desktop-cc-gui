## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 34/34 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `src/features/governance/evidence/*`、`GovernanceEvidenceSection`、policy audit、cost/capability/gate adapters 与 replay fixtures 已存在。
- **Next action**: 归档前补 evidence replay、policy audit、StatusPanel focused tests 与 strict validation 记录。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

当前 `Governance evidence` 仍带有明显的 mossx/harness 专用色彩：OpenSpec tasks、large-file gate、heavy-test-noise、固定 harness scripts、固定 workflow、Trellis session record 被平铺成同一组证据。这个模型在 mossx 当前分支里可解释，但换到 Python、Rust、Go、Java 或普通 Node 项目时，会把“不适用”误报成“未知/异常”，用户看到的是固定 checklist，而不是当前项目真正需要治理的风险。

外部通用基线也不支持固定清单式治理：OpenSSF Scorecard 按 repo 实际安全实践评估，GitHub 安全配置强调仓库需求因项目而异，SLSA 关注 source/build/provenance 链路，OWASP SAMM 把软件保证分为 Governance、Design、Implementation、Verification、Operations 五类。CodeMoss 的治理证据应该吸收这些原则：先识别项目画像，再选择适用 evidence adapter，最后只展示当前项目相关、可解释、可行动的证据。

## 目标与边界

- 将治理证据从固定 harness checklist 升级为动态 `ProjectGovernanceProfile -> EvidenceAdapter registry -> GovernanceEvidence[]`。
- 根据项目真实文件、配置、工具链、CI、artifact 和 agent workflow 信号识别适用治理项。
- 支持可选的项目自声明 override（例如 `governance.config.json` v1），用于补充或校准自动画像；它不是必需入口，不能替代自动识别主路径。
- 让 UI 默认聚焦“需要处理 / 观察 / 已通过”，而不是平铺所有证据。
- 让每条证据都能说明 `status`、`impact`、`source`、`freshness/provenance` 和 `suggested action`。
- 让成本模块参与同一套实用性原则：区分 pricing unavailable、budget unconfigured、usage unavailable、stale pricing，而不是显示空泛 Budget 区块。
- 将 Cost/Budget 从降级提示升级为决策面板：Token Breakdown、Accumulated Cost、Budget Bar 三个子模块回答 token 分布、累计花费、预算消耗三个问题。
- 保持治理证据只读、advisory-first，不自动写回 OpenSpec/Trellis，不在渲染或 policy 路径执行 shell。

## 非目标

- 不新增大型治理 dashboard；本变更优先改造现有 StatusPanel/checkpoint 治理证据入口。
- 不要求所有项目都创建 `governance.config.json`；没有 config 时必须仍可基于项目内容动态识别。
- 不让客户端自动勾选 `openspec/changes/*/tasks.md`，不写 `.trellis/**` session/task 状态。
- 不引入文件 watcher、后台 shell runner、远程安全扫描服务或跨 workspace 管理后台。
- 不把所有生态的最佳实践一次性做成强制 gate；未检测到或未声明的能力不得显示为失败。
- 不强制成本阈值中断 runtime；成本治理仍然通过 UI/advisory policy 表达。
- 不做跨 workspace 成本聚合；已有独立 change `add-cross-workspace-cost-admin-view` 负责该方向。

## What Changes

- 新增项目画像能力：
  - 识别 OpenSpec、Trellis、Agent rules、Node/TS、Python、Rust、Go、Maven、Gradle、CI、pre-commit、lockfile、artifact 等信号。
  - 为项目生成 `ProjectGovernanceProfile`，作为后续 evidence adapter 是否适用的唯一输入。
  - 可选读取 `governance.config.json` v1 作为 explicit override：补充脚本、workflow、gate artifact、OpenSpec/Trellis root 与 required/warn 语义。
- 改造治理证据来源选择：
  - 固定 `KNOWN_HARNESS_SCRIPTS`、固定 workflow、固定 `.artifacts/*` 路径不再作为全局默认清单。
  - 每类证据通过 `EvidenceAdapter.appliesTo(profile)` 判断是否适用。
  - 不适用的能力不显示；“项目应该有但缺失”的能力才显示 `unknown` 或 `warn`。
- 改造 UI 信息架构：
  - 证据按 `需要处理`、`观察`、`已通过` 分组。
  - 默认展开需要处理项，默认折叠已通过项。
  - 每条证据显示影响、来源、最近运行/新鲜度、建议动作。
- 改造成本/Budget 表达：
  - 成本区分 `pricing unavailable`、`pricing stale`、`usage unavailable`、`budget unconfigured`、`threshold crossed`。
  - Token Breakdown 在 pricing 缺失时仍显示 token 信息，进入 token-only 模式而不是静默归零。
  - Accumulated Cost 显示 Session / Today / Month 三档累计成本，数据本地持久化。
  - Budget Bar 显示月度预算消耗、剩余额度、80%/100% 阈值预警；预算缺失时显示设置引导。
  - 如果未配置 Budget，不再展示空泛 Budget 状态，而是给出设置 session/workspace budget 的动作。
  - 如果模型 pricing 缺失，显示模型、engine、缺失原因和可执行修复动作。
  - 新成本 UI 通过 `statusPanel.costV2` feature flag 灰度启用，关闭时回退老 UI。
- 扩展验证覆盖：
  - 增加 Node、Python、Rust、Go、Maven、Gradle、OpenSpec/Trellis fixture profile。
  - 增加 conformance check，防止未来重新引入 mossx-only 全局硬编码 evidence。

## 技术方案取舍

| Option | Description | Trade-off | Decision |
|---|---|---|---|
| A. 继续固定 checklist，只补文案 | 最小改动，继续显示当前 7 类证据。 | 成本低，但不同项目继续失真；UI 仍然噪音大。 | Rejected |
| B. 为每种项目写一套独立组件 | Python/Rust/Go/Node 各自定制 UI 和 reader。 | 短期直观，长期 duplication 和 drift 高。 | Rejected |
| C. 项目画像 + adapter registry | 先识别项目，再动态选择 evidence adapter，UI 消费统一证据模型。 | 需要一次模型重构，但扩展性和准确性最好。 | Selected |
| D. 接入远程安全/CI API 做全量治理 | 可获得 branch protection、Dependabot、CodeQL 等远程事实。 | 需要权限、网络、token 和隐私策略；超出当前本地治理证据边界。 | Deferred |

### Governance override

| Option | Description | Trade-off | Decision |
|---|---|---|---|
| A. 强制 `governance.config.json` | 项目必须自声明所有治理证据来源。 | 可解释，但零配置体验差；违背“动态识别”目标。 | Rejected |
| B. 纯自动嗅探 | 完全按文件和配置推断。 | 零配置，但用户难以覆盖特殊路径和 required 语义。 | Rejected |
| C. 自动画像为主，可选 config override | 默认动态识别；config 只补充/校准。 | 设计稍复杂，但兼顾智能与可控。 | Selected |

### Cost persistence

| Option | Description | Trade-off | Decision |
|---|---|---|---|
| A. Tauri backend JSON storage | 与项目持久化体系一致。 | IPC/迁移成本高，超出第一轮 UI 改造。 | Deferred |
| B. Zustand + localStorage | 前端闭环，易灰度和回滚。 | 单机本地，不跨设备。 | Selected |

## Capabilities

### New Capabilities

- `dynamic-project-governance-evidence`: Defines dynamic project profile detection, evidence adapter selection, grouped governance evidence UI semantics, and project-type-specific evidence expectations.

### Modified Capabilities

- `governance-evidence-bridge`: Replace globally fixed harness evidence assumptions with profile-aware adapter applicability while preserving pure, in-memory, advisory-first snapshot semantics.
- `context-ledger-cost-budget`: Clarify cost/Budget UI behavior for unavailable pricing, stale pricing, missing usage, and unconfigured budgets so the section becomes actionable instead of decorative.
- `checkpoint-policy-chain`: Ensure dynamically collected governance evidence contributes only through advisory policy semantics and does not turn non-applicable project capabilities into checkpoint blockers.

## 外部基线参考

- OpenSSF Scorecard: repository security posture is assessed from the repository's actual checks and practices.
- GitHub repository security quickstart: repository security needs are unique; code scanning, secret scanning, dependency review, Dependabot, and security policy are configured according to repo needs.
- GitHub protected branches: required status checks and merge protections are branch/repo configuration, not source-tree universal facts.
- SLSA provenance: source/build/provenance evidence should identify build definitions, external parameters, resolved dependencies, and generated artifacts.
- OWASP SAMM: software assurance spans Governance, Design, Implementation, Verification, and Operations rather than one fixed CI checklist.
- Ecosystem docs: `package.json` scripts, `pyproject.toml`, `Cargo.toml`, `go.mod`, Maven lifecycle, and Gradle `check`/`build` tasks define project-specific verification surfaces.

## Impact

- OpenSpec:
  - `openspec/changes/dynamic-project-governance-evidence/**`
  - future delta specs for `dynamic-project-governance-evidence`, `governance-evidence-bridge`, `context-ledger-cost-budget`, and `checkpoint-policy-chain`
- Frontend:
  - `src/features/governance/evidence/**`
  - optional `src/features/governance/config/**`
  - `src/features/status-panel/components/GovernanceEvidenceSection.tsx`
  - `src/features/status-panel/components/CostBudgetSection.tsx`
  - future `src/features/status-panel/components/cost/**`
  - `src/features/status-panel/utils/checkpoint.ts`
  - `src/features/context-ledger/cost/**`
  - `src/features/context-ledger/pricing/**`
  - settings surface for budget configuration
  - related i18n keys under `src/i18n/locales/*`
- Validation tooling:
  - `scripts/check-governance-evidence-bridge.mjs`
  - potential new profile/conformance checker for adapter applicability
- Tests:
  - project profile fixtures for Node/TS, Python, Rust, Go, Maven, Gradle, OpenSpec/Trellis, and generic repos
  - UI grouping tests for needs-action/watch/pass evidence
  - cost/Budget degraded-state tests

## Acceptance Criteria

- A generic repo without OpenSpec/Trellis/harness artifacts does not show mossx harness evidence as `unknown`.
- A Node/TS repo surfaces package scripts, lockfile, CI, lint/typecheck/test/build evidence when present.
- A Python repo can surface pytest/ruff/mypy/pyright-style evidence from `pyproject.toml` or related config without showing large-file harness evidence by default.
- A Rust repo can surface `cargo test`, `cargo fmt --check`, `cargo clippy`, and `Cargo.lock` evidence when applicable.
- A Go repo can surface `go test`, `go vet`, `go mod tidy`/`go.sum` evidence when applicable.
- A Maven or Gradle repo can surface lifecycle/check/build/test evidence from its build files.
- A mossx workspace still surfaces OpenSpec, Trellis, large-file, heavy-test-noise, and governance artifact evidence because the profile detects those capabilities.
- If a project supplies `governance.config.json`, it can add or override scripts/workflows/gates without making that config mandatory for other projects.
- StatusPanel groups governance evidence into `需要处理`、`观察`、`已通过`; pass-only evidence is collapsed by default.
- Every visible non-pass evidence item exposes impact, source, and suggested action.
- Cost/Budget UI distinguishes pricing unavailable, pricing stale, usage unavailable, budget unconfigured, and threshold crossed; pricing unavailable enters token-only mode instead of silent zero.
- Cost/Budget V2 can display token breakdown, Session/Today/Month accumulated cost, and Budget Bar when the needed usage/pricing/budget data is available.
- Budget settings can set, edit, and clear the local monthly budget without app restart.
- Dynamic evidence remains read-only and advisory-first; non-applicable capabilities do not create checkpoint blockers.
- Cross-platform path normalization and CRLF/LF parsing behavior remain covered by tests.
