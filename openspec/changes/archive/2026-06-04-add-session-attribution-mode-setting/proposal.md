## Why

当前 workspace 会话列表默认采用宽松的 related discovery 策略：系统会从各 engine 的历史来源拉取会话，并根据 engine-specific evidence、workspace path、git root、worktree family 等证据，把“看起来与当前 workspace 相关”的会话展示出来。Claude history 的 `~/.claude/projects` 全局扫描是当前最明显的污染来源，但配置语义不能设计成 Claude-only。

这个策略对找回历史会话有价值，必须保留；但在多 workspace、父子目录、多项目并行使用场景下，用户会感知到当前 workspace 侧边栏被其他项目会话污染。因此需要在 `设置 > 会话管理` 中提供显式模式切换，让用户在“尽可能找回相关会话”和“严格缩窄当前 workspace 会话范围”之间自行选择。

## 目标与边界

- 在 `设置 > 会话管理` 增加 workspace 会话拉取模式的单选按钮组。
- 保留当前工作区会话拉取模式，并作为默认模式，确保升级后现有用户行为不变。
- 新增一个窄拉取模式，用于减少跨项目会话污染。
- 让 sidebar、Workspace Home、Session Management、Session Radar / prewarm 对同一模式使用一致解释。
- 仅调整所有 engine 的 workspace session membership 拉取与归因口径，不改变 engine runtime、transcript 加载、session 删除、归档、folder tree 等非 membership 行为。

## 非目标

- 不移除当前 related discovery 行为。
- 不把窄模式设为默认值。
- 不重写 Session Catalog 架构。
- 不改变 Claude / Codex / Gemini / OpenCode 的 runtime 启动逻辑。
- 不解决所有历史数据归属歧义；窄模式只保证不主动把其他 workspace 的会话混入当前 workspace 列表。

## What Changes

- 在 `设置 > 会话管理` 增加一个单选按钮组，用于选择 workspace 会话拉取模式。
- 默认模式保持当前行为，建议命名为：
  - 中文：`相关会话模式`
  - 内部值：`related`
  - 含义：保留当前宽松拉取、全局候选扫描、cwd / git root / worktree 相关归因能力。
- 新增窄拉取模式，建议命名为：
  - 中文：`当前工作区模式`
  - 内部值：`workspace-only`
  - 含义：只拉取明确属于当前 workspace 范围的会话，避免跨项目会话混入。
- `related` 模式 MUST 保留当前工作区会话拉取结果，新增模式不得造成默认行为回归。
- `workspace-only` 模式 MUST 缩窄所有 engine 的 workspace session membership：
  - 每个 engine adapter 都必须接收并尊重 effective attribution mode。
  - engine adapter 不得绕过 shared projection 直接把 related/global/history 结果写入当前 workspace membership。
  - Claude adapter 优先只扫描当前 workspace 精确对应的 Claude project dir，以及明确位于当前 workspace 子路径下的 Claude project dirs。
  - Claude adapter 不使用所有 Claude project dir 的全局扫描结果扩大当前 workspace 会话列表。
  - 如果 Claude project dir 映射到另一个已知 workspace，即使 transcript `cwd` 看起来落在当前 workspace 内，也不得直接归入当前 workspace；系统必须排除或暴露 conflict diagnostic。
  - 所有 engine 都不得使用 sibling、shared worktree family、模糊 related attribution 把其他 workspace 的会话并入当前 workspace。
  - SHOULD 允许 engine session evidence 指向当前 workspace 子目录，避免误伤从 `src/`、`packages/*` 等子目录启动的正常会话。
- Session Radar / prewarm MUST 尊重该设置：
  - `related` 模式保持现有全局聚合与预热体验。
  - Session Radar 可以继续作为全局视图展示多个 workspace 的会话状态。
  - `workspace-only` 模式下，每个 workspace 的 hydration / membership 必须按该 workspace 的 mode 计算，不得通过预热把其他 workspace 的会话写入当前 workspace 列表。

## 技术方案选项

### Option A: 只加前端过滤

前端在 sidebar / Session Radar 渲染前，根据 `workspaceId` 或 `cwd` 做二次过滤。

- 优点：改动小，UI 见效快。
- 缺点：污染源仍在 backend catalog / native listing；不同 surface 容易过滤规则漂移；prewarm、count、pagination、source status 仍可能携带宽口径结果。

### Option B: 在 backend session attribution pipeline 中引入 mode

设置层持久化 `sessionAttributionMode`，请求 workspace session catalog、engine-native listing、radar prewarm 时透传 mode；backend 根据 mode 选择现有 related 策略或新增 workspace-only 策略。

- 优点：membership truth 在源头收敛；sidebar、Workspace Home、Session Management、Radar 可以复用同一规则；更符合现有 shared workspace session projection 方向。
- 缺点：需要改动 Rust catalog、all-engine listing 参数和前端 service 类型，测试面更大。

### 决策

采用 Option B。原因是这个问题的本质是 session membership attribution，不是单个 UI 列表展示问题。只在前端过滤会制造新的规则分叉，后续更难维护。

## Capabilities

### New Capabilities

- `workspace-session-attribution-mode`: 定义全引擎 workspace session attribution mode 的设置入口、默认兼容行为、related / workspace-only 两种拉取口径，以及各 session surface 对该设置的一致解释。

### Modified Capabilities

- `workspace-session-catalog-projection`: workspace session projection 需要接受 attribution mode 作为 membership resolver 的输入；默认 `related` 保持当前 projection 行为，`workspace-only` 对所有 engine 缩窄 workspace membership；Claude history 作为特殊污染源需要缩窄扫描并处理跨已知 workspace 的冲突归因。
- `workspace-session-source-fact-cache`: Claude source fact cache 不得把 related 模式下的缓存结果作为 workspace-only 模式的 membership truth；cache namespace 或读取条件必须区分有效 attribution scope。

## 验收标准

- 升级后未配置该字段的用户 MUST 自动使用 `related` 模式，现有 workspace 会话列表结果不因本变更改变。
- 用户可在 `设置 > 会话管理` 看到单选按钮组，并在 `相关会话模式` 与 `当前工作区模式` 之间切换。
- `related` 模式下，当前全局扫描和 related discovery 行为 MUST 保留。
- `workspace-only` 模式下，所有 engine 的其他 workspace session MUST NOT 出现在当前 workspace 会话列表。
- `workspace-only` 模式下，位于其他 known workspace Claude project dir 的 session MUST NOT 出现在当前 workspace 会话列表，即使 transcript `cwd` 指向当前 workspace，也必须排除或标记 conflict diagnostic。
- `workspace-only` 模式下，session evidence 位于当前 workspace 子目录内的正常 session SHOULD 保留，避免从子目录启动 engine 的会话被误隐藏。
- Session Radar / prewarm 在 `workspace-only` 模式下 MUST NOT 绕过该模式污染当前 workspace 的会话列表、计数或最近会话展示；Radar 自身的全局展示不构成污染，前提是每个 workspace 的 membership 按各自 mode 计算。
- 相关测试 MUST 覆盖默认兼容、窄模式排除 unrelated project dir、窄模式保留 workspace child cwd、Radar/prewarm mode 透传。

## Impact

- Frontend:
  - 设置页新增单选按钮组。
  - app settings 类型、默认值、持久化迁移需要增加 `sessionAttributionMode`。
  - 会话列表、Session Radar、prewarm 路径需要读取并透传该设置。
- Backend:
  - workspace session catalog / all engine session listing 需要接收 attribution mode。
  - `related` 模式保持当前扫描和归因逻辑。
  - `workspace-only` 模式需要新增独立拉取和归因逻辑，不复用现有 `related` 拉取链路作为实现。
- Compatibility:
  - 默认值必须为 `related`。
  - 旧配置缺失该字段时必须按当前行为处理。
- Tests:
  - 需要新增 Rust backend attribution tests。
  - 需要新增或更新 frontend settings、thread hydration、Session Radar tests。
- Dependencies:
  - 不需要新增第三方依赖。
