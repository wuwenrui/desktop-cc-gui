## Why

Codex 供应商管理当前只保存 `configToml/authJson/customModels` 并设置 `codex.current`，但 Codex 会话启动链路不会消费该 active provider；用户点击“启用”后会误以为新会话已经切换供应商，实际仍由磁盘 `CODEX_HOME` 配置决定。

产品需要把 Codex provider 从“全局启用状态”改成“创建会话时选择的 launch profile”，让同一 workspace 可以并行运行多个 Codex 会话，并且每个会话稳定绑定不同供应商配置。

## 目标与边界

- 创建 Codex 会话时展示二级 provider selector，默认项为“磁盘 .codex 配置”。
- 二级 provider selector MUST 使用与一级 workspace menu 对齐的实底浮层背景；不得因透明度过高透出底层会话内容、代码文本或日志文本，造成文字重叠。
- 客户端配置的 Codex providers 作为其它可选项，而不是全局互斥启用项。
- 选择客户端 provider 后，本次创建的 Codex 会话 MUST 使用该 provider 的 `configToml/authJson`。
- 支持同一 workspace 下多个 Codex providers 并行运行，彼此配置隔离。
- 供应商管理 Codex tab MUST 移除或替换误导性的“启用”动作，避免表达全局切换语义。
- Managed provider 的关键配置 MUST 在本次会话中真实生效；若项目级 `.codex/config.toml` 或其它配置优先级会覆盖 provider 配置，系统 MUST 使用明确覆盖策略或阻断启动并提示风险。
- App 重启后的 Codex 历史会话列表 MUST 能恢复 provider binding，不能把 managed provider 会话误识别成磁盘默认配置。

## 非目标

- 不实现运行中会话的无感 provider 切换。
- 不通过覆盖全局 `~/.codex/config.toml` / `auth.json` 实现供应商切换。
- 不改变 Claude / Gemini / OpenCode 的 provider 管理语义。
- 不把 provider-scoped runtime 设计扩展为完整 runtime pool 重构。

## What Changes

- 新增 Codex provider-scoped session launch 能力：
  - new Codex conversation 创建时必须选择一个 provider profile；
  - provider selector 作为二级浮层呈现时，视觉层级必须能遮蔽底层文本，并与一级新建会话面板使用同一浮层背景语义；
  - fork Codex conversation 时也必须提供 provider selection，默认继承 parent thread 的 provider；
  - 默认 profile 为现有磁盘 `.codex` / `CODEX_HOME` 配置；
  - managed provider profile 使用 app-local provider-scoped `CODEX_HOME`。
- Codex runtime identity 从仅 workspace 维度扩展到 provider profile 维度：
  - managed provider runtime key 包含 `workspaceId` 与 `providerProfileId`，形如 `codex::<workspaceId>::<providerProfileId>`；
  - disk provider 保留 legacy workspace runtime key，语义上等价于 `providerProfileId="__disk__"`，用于兼容现有 `.codex` / `CODEX_HOME` 行为；
  - thread metadata 必须记录 provider binding；
  - 后续 turn / resume 路由必须回到同一 provider-scoped runtime；
  - fork 创建的 child thread 绑定 fork selector 选择的 provider，parent thread provider 不变；
  - message-tail provider fork MUST append/create a child conversation and MUST NOT reuse the legacy rewind `renameThreadId(parent -> child)` / `hideThread(parent)` state transition.
  - cross-provider message-tail fork preserves Codex native fork semantics: backend sends `thread/fork` to the parent thread's provider runtime, makes the resulting child history visible to the selected provider home when needed, and records the child binding as the selected provider.
  - provider-selected message-tail fork MUST tolerate drift between frontend local message ids/ordinals and Codex app-server native user message anchors: resolve by exact native id first, then normalized user text/occurrence, then ordinal/tail alignment; if local history extends beyond the runtime-visible native user messages, fork SHOULD use the last runtime-visible user message as the native anchor; if no native user anchor exists, fork MAY omit `messageId` and perform a full-thread native fork.
  - destructive Codex rewind remains strict: missing target anchors MUST fail closed and MUST NOT use the fork-only tail fallback.
- Codex supplier management UI 改语义：
  - “启用”按钮不再作为 Codex provider 的主动作；
  - 卡片展示“可用于新会话”或等价状态；
  - “磁盘 .codex 配置”作为默认 provider option，而不是卡片内 active state。
- Provider-scoped config materialization：
  - managed provider 的 `configToml/authJson` 写入 app-local scoped directory；
  - Codex app-server 以该 scoped directory 作为 `CODEX_HOME` 启动；
  - provider 关键字段必须通过启动参数或有效配置校验确保不会被项目 `.codex/config.toml` 静默覆盖；
  - 删除/编辑 provider 不应静默改变已绑定会话。
- Codex command routing matrix：
  - thread-bound operations 必须按 thread metadata 里的 provider binding 路由；
  - thread-bound `turn/start` 若遇到 Codex app-server stale `thread not found`，只能在同一个 provider-scoped runtime 内先 `thread/resume` 再 retry 一次，不得把该 turn 重新路由到磁盘默认 profile；
  - workspace/global operations 必须显式声明使用磁盘默认、provider selector 或 provider-agnostic 路径；
  - remote/daemon adapter 若尚未实现 managed provider-scoped runtime，必须保留 `providerProfileId` 并对 managed provider 返回显式 unsupported error；不得丢弃参数后静默按 disk 运行；
  - 未分类命令不得默认复用 workspace-only runtime。
- Codex session catalog / history：
  - app restart 后必须聚合磁盘默认 profile 与 managed provider homes 的历史；
  - 每条历史会话必须保留或恢复 provider id/source/name；
  - provider 不可用时显示 unavailable，而不是降级为 disk。

## Capabilities

### New Capabilities

- `codex-provider-scoped-session-launch`: Defines provider selection during Codex conversation creation, provider-scoped Codex home materialization, runtime isolation, thread binding, and vendor-management UI semantics.

### Modified Capabilities

- `codex-session-sidebar-state-parity`: New Codex conversation start idempotency must include provider profile identity so parallel provider launches do not collapse into one backend start.
- Current implementation note: frontend Codex start in-flight identity is `workspaceId + providerProfileId + folderId/root + autoSession identity`. The current `start_thread` payload does not include selected model, launch mode, or spec-root; if those fields are added later, the in-flight identity MUST be extended in the same change.

## 技术方案对比

| Option | Shape | Pros | Cons | Decision |
|---|---|---|---|---|
| A. 覆盖全局 `~/.codex` | 点击供应商后写全局 config/auth | 实现最少 | 并发供应商互相污染；全局副作用危险；用户无法并行 | Reject |
| B. 每次 turn 前临时改写磁盘配置 | 发消息前切 config，发完恢复 | 看似支持多 provider | race condition 明显；失败恢复复杂；对 app-server 进程级配置不可靠 | Reject |
| C. Provider-scoped `CODEX_HOME` | 每个 managed provider 生成独立 Codex home，并启动独立 app-server | 并行隔离清晰；不污染全局；符合 Codex 配置读取模型 | 需要 runtime key / thread binding / cleanup 设计 | Accept |

## 验收标准

- 创建 Codex 会话入口展示 provider selector，默认选择“磁盘 .codex 配置”。
- provider selector 二级浮层背景必须足够不透明；在底层存在会话文字、代码 diff 或日志文本时，不得出现前后景文字重叠。
- 所有用户可见的新建 Codex 会话入口都遵循同一 provider selection contract；非交互式入口必须显式传 provider id 或默认 disk。
- 同 workspace 的 Codex start in-flight reuse MUST distinguish provider profile、folder/root 和 auto-session identity；不同 provider profile 的 start 不能 collapse 成同一个 backend start。
- Fork Codex 会话入口展示 provider selector，默认继承 parent thread provider，并允许选择 disk 或其它 managed provider 创建 child thread。
- 选择 managed provider 创建会话后，该 thread metadata 可见记录 provider id/name/source。
- 选择相同 provider 进行 message-tail fork 后，parent conversation row MUST remain visible and bound to its original provider; child conversation MUST be a separate thread id with the selected provider binding.
- 选择不同 provider 进行 message-tail fork 时，后端 MUST route native `thread/fork` through the parent thread runtime, MUST NOT send a seed transcript as a new user turn, and MUST bind the forked child to the selected provider after ensuring the child native history is visible to that provider.
- cross-provider provider-rebind fork MUST be metadata-distinguishable from same-provider fork; it is a native fork whose continuation provider differs from the parent provider.
- 当 message-tail fork 的 frontend local conversation 比 Codex runtime native history 多出尾部 user message，导致 requested `messageId` 或 local ordinal 不能直接命中 native anchor 时，后端 MUST prefer the best runtime-visible anchor instead of failing with `CODEX_FORK_ANCHOR_NOT_FOUND`; destructive rewind MUST continue to fail on missing exact target.
- 同一 workspace 中用两个不同 providers 创建 Codex 会话时，后端必须启动或复用两个不同 provider-scoped runtimes。
- 同一 workspace 中用相同 provider 创建多个 Codex 会话时，也必须支持并行运行；这些会话 MAY 共享同一个 provider-scoped runtime，但 thread/session 状态不得互相串线。
- 两个 provider-scoped sessions 并发发送消息时，不得共享或互相覆盖 `CODEX_HOME/config.toml` / `auth.json`。
- 新版本 Codex 会话列表、会话头部或等价明显位置必须展示当前 thread 使用的 provider label。
- 供应商管理 Codex tab 不再提供误导性的“启用”按钮；provider 卡片表达“可用于新会话”语义。
- 删除 provider 后，已有绑定 thread 不得静默路由到磁盘默认配置。
- 编辑 provider 后，已运行 runtime 不得被静默热更新；新启动 runtime 使用最新保存配置。
- disk profile thread 首次发送消息若命中 stale `thread not found`，后端 MUST 在同一 disk runtime 内执行 bounded `thread/resume` + 单次 `turn/start` retry；成功时不展示 stale recovery card，失败时必须清理 foreground work 并保留原始错误诊断。
- Remote/daemon creation/fork path MUST parse and preserve `providerProfileId`; unsupported managed provider MUST fail visibly rather than silently creating/forking a disk-profile thread.

## Impact

- Frontend:
  - Codex new conversation affordance / create flow
  - `features/vendors` Codex tab copy/actions
  - thread metadata display and obvious sidebar/header provider label
- Tauri/Rust:
  - Codex runtime session registry key
  - Codex `start_thread` / `send_user_message` routing
  - provider-scoped `CODEX_HOME` materialization and sensitive file permissions
  - session catalog / history metadata projection
- Storage:
  - app-local managed provider home directories
  - thread metadata provider binding
- Tests:
- frontend provider selector and vendor tab tests
- frontend provider selector visual smoke / CSS review：确认二级 provider selector 与一级 workspace menu 的浮层背景语义一致，且不会透出底层正文造成文字重叠。
- frontend service payload、in-flight start key、provider label/reducer merge、fork selector tests
  - Rust provider scoped launch / routing / deletion behavior tests
  - focused runtime concurrency tests
