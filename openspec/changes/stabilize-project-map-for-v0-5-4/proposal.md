## Why

v0.5.3 已经把 Project Knowledge Map 从基础生成推进到增量生成、证据链交互、自动补充队列和画布控制，但这些能力集中落地后，0.5.4 的首要风险不再是“功能不够”，而是生成链路、后台调度、跨工作区归属、重复节点、拖拽选择和失败诊断之间的稳定性漂移。

本变更将 v0.5.4 的 Project Map 范围收敛为稳定性版本：只修复和加固现有能力，不扩展新的图谱产品边界。

## 目标与边界

- 稳定 Project Map generation / auto ingestion / candidate review / graph interaction 的已发布能力。
- 将自动补充、后台调度、run ownership、storage key、node dedupe、drag / selection、structured output repair 纳入同一条 release stability contract。
- 保持现有 in-house SVG/HTML graph renderer、现有 persistence schema、现有 Project Map task drawer 和现有 evidence navigation 入口。
- 所有修复必须是 additive 或兼容性收口；不得让既有 Project Map 数据因为新版本升级而被静默删除。
- 0.5.4 的 Project Map changelog 只描述稳定性、可诊断性和交互可靠性，不包装为新的大功能。

## 非目标

- 不做跨项目知识融合、图谱版本管理、图谱 diff、图谱导出或多人协同。
- 不引入第三方 graph layout / graph editing dependency。
- 不重写 Project Map 数据模型，不迁移或清空用户已有 `.ccgui/project-map/**` 数据。
- 不增加新的 AI action 类型；Collect profile、Complete node、Calibrate node、Auto Ingestion 保持现有语义。
- 不把 candidate review 做成完整审核工作台；本轮只保证候选状态可见、可恢复、不会误写。
- 不做 native daemon；Auto Ingestion 仍跟随 app/workspace lifecycle。

## What Changes

- 复用并校准已有 Project Map async run ownership 与 storage boundary，不重复立法；实现时只修补当前代码与主 spec 的偏差。
- 收口 Auto Ingestion scheduler：enabled 状态下即使 Project Map panel 未挂载，也能按 workspace lifecycle 评估并排队；同时保留 interval、threshold、duplicate-run guard 和 success-only processed marker。
- 校准 Auto Ingestion candidate safety：`createCandidate` 必须人工确认；`autoApplyEvidenceBacked` 可以通过 evidence gate 自动应用强证据更新，但 weak / unsupported / memory-only claims 仍保持 candidate。
- 稳定 structured output repair：模型输出解析失败时必须保留可诊断 run failure，不允许静默写入半成品 dataset。
- 稳定 Project Map Codex model selection：当 runtime model catalog / config 读取失败或返回空列表时，生成入口仍复用现有 Codex model catalog 作为 fallback，不让稳定性修复被模型选择空态阻断。
- 保留现有 graph renderer / layout 边界，只做既有 drag、dedupe、viewport 稳定性回归验证，不引入新的 graph dependency。
- 增加 focused verification matrix，覆盖 generation ownership、auto scheduler、node dedupe、drag / selection、candidate safety 和 parse failure visibility。

## 技术方案对比

| 方案 | 做法 | 优点 | 风险 / 成本 | 结论 |
|---|---|---|---|---|
| A. 继续逐个修 Project Map 单点问题 | 每次只针对一个症状创建小 patch，例如只修 drag、只修 scheduler、只修 parse | 单次改动小，容易快速合并 | release contract 分散，容易出现“这里修了、那里又漂移”；0.5.4 changelog 缺少主线 | 不采用作为主方案 |
| B. 做 0.5.4 Project Map stability contract | 用一个稳定性 change 统一约束 run ownership、scheduler、dedupe、interaction、candidate safety 和 diagnostics | release 范围清晰，能把现有 Project Map 能力闭环成可回归矩阵 | 需要跨几个前端 hook/component/service 和少量 backend storage guard 做一致性验证 | 采用 |
| C. 直接进入 Project Map 第二阶段大功能 | 在稳定性修复同时加入跨项目图谱、版本管理、复杂 layout | 短期看起来更有新鲜感 | 回归面过大，和 0.5.3 刚上线的大能力叠加，风险不成比例 | 不采用 |

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `project-xray-panel`: 校准 Auto Ingestion run lifecycle、mode-aware candidate safety 和 renderer dependency boundary。
- `project-map-incremental-generation`: 增加 structured-output failure visibility 的 fail-closed 长期契约。

## Impact

- Frontend:
  - `src/features/project-map/**`
  - `src/styles/project-map.css`
  - Project Map focused Vitest suites
- Backend:
  - `src-tauri/src/project_map.rs` 或现有 Project Map persistence command 边界
- OpenSpec:
  - delta specs for `project-xray-panel`
  - delta specs for `project-map-incremental-generation`
- Storage:
  - No schema migration.
  - Existing Project Map snapshots remain readable when ownership matches.
  - Mismatched or malformed snapshots are rejected / quarantined instead of rendered as trusted project knowledge.
- Dependencies:
  - No new external dependency.

## 验收标准

- 当 workspace A 的 Project Map run 未完成时切换到 workspace B，A 的后续 progress / completion / failure 不得污染 B 的 dataset、UI state 或 persistence path。
- 当 Project Map panel 未挂载且 Auto Ingestion enabled、interval elapsed、threshold satisfied 时，系统仍能排队一个 `kind="auto"` run。
- 当已有 pending / running auto run 时，scheduler 不得重复排队同一类 auto run。
- 当同一 stable node id 出现在多个 lens 或生成输出中，graph 中只渲染一次，并保留合并后的 evidence、relationships 和 metadata。
- 任意可见 graph node 都能从 node body 拖动并持久化布局；点击 drill action 不触发拖拽。
- 节点选择不得导致普通 viewport 丢失；只有结构性 framing 变化才允许 auto-fit。
- structured output repair 失败时，run 必须进入可见 failed state，并保留 failure reason；不得写入不完整 dataset。
- Codex runtime model catalog 临时不可用或为空时，Project Map generation options 必须仍展示来自既有 Codex model catalog 的 fallback 选项，并保持用户可发起生成。
- Auto Ingestion 在 `createCandidate` 模式下不得绕过 confirmation；在 `autoApplyEvidenceBacked` 模式下，只有通过 evidence gate 的强证据更新可以自动应用，weak / unsupported / memory-only claims 必须保持 candidate。
- Focused frontend tests、相关 Rust tests、`npm run typecheck`、`openspec validate stabilize-project-map-for-v0-5-4 --strict --no-interactive` 通过，若平台手测缺口存在，必须在 verification 中显式标注。
