## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 57/57 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: 代码存在 `conversationCompletionEmail.ts`、`useMailDrivenSessionContinuation.ts` 与 `src-tauri/src/email/session_continuation.rs`；支持 reply delimiter、MOSS CONTEXT、natural reply、IMAP read-only intake、mail session ledger 与 settings management surface。
- **Next action**: 补 archive 前 verification note，确认 focused frontend/backend/email tests 与 strict OpenSpec validation 后归档。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

当前对话完成邮件已经可以把客户端运行结果发送到配置收件箱，但邮件正文偏长，且用户回复邮件后无法稳定回到对应 session 继续执行。用户希望把 completion email 迭代成一个简洁、可回复、可审计的邮件驱动式 session 闭环。

这次变更要解决两个核心问题：第一，completion email 必须从长内容汇报变成“本轮用户请求 + 本轮修复信息 + 下一步建议”的决策摘要，且标题要能在邮箱列表中一眼识别 engine、session 和 workspace；第二，客户端必须只接收和处理带 Moss session 协议的有效回复，避免无关邮件污染存储或触发错误执行。

## 目标与边界

- 建立邮件驱动 session continuation 协议，使用户回复邮件后，客户端能够准确识别 workspace/thread/session/turn 并继续执行。
- 将 completion email 正文精简为人类决策摘要，机器上下文放入 header、thread metadata 和签名 context block。
- 新增 inbound mail intake 的过滤、最小存储、去重、过期、签名校验和状态管理契约。
- 在设置页邮箱设置中增加管理 tab，提供收信监听状态、邮件会话、待确认回复、异常邮件和跳转到对应 session 的 UX。
- 明确当前 MVP 的产品决策：用户在会话发送时点选“邮件”即表示本轮完成邮件默认可回复、可继续该 session；收到有效邮件回复后，后续 completion email 也默认保持可回复闭环。
- 收信读取默认使用 read-only / local cursor 模式，不删除、不归档、不移动用户邮箱中的邮件。
- 保持现有 SMTP 发信配置和 shared email sender contract，不把客户端扩展成通用邮件客户端。

## 非目标

- 不同步、展示或归档普通邮箱邮件。
- 不把自然语言邮件直接无约束地当作 prompt 自动执行。
- 不支持附件解析、HTML 邮件编辑器、多邮箱聚合或完整 IMAP 客户端能力。
- 不把普通未选择邮件发送的 session 自动纳入邮件闭环；只有用户在会话中选择发送 completion email 后，才创建可回复的 session target。
- 不在普通 AppSettings payload、日志、toast 或诊断包中暴露邮箱授权码、reply token 明文或原始邮件全文。

## What Changes

- 精简 conversation completion email 模板，只保留状态、本轮用户请求、本轮修复信息、下一步建议、简单回复说明，以及机器可校验的 Moss context block。
- 优化 completion email subject：保留 Moss subject tag，同时在基础标题中加入 engine name、session name 和 workspace name；过长 session/workspace 使用字符安全 `...` 截断，便于邮箱列表快速识别。
- 为发出的 actionable email 建立 outgoing mail ledger，保存 `sessionId`、`workspaceId`、`threadId`、`turnId`、`messageId`、`subjectTag`、`replyTokenHash`、`expiresAt` 和 actionable 状态。
- 为可回复邮件写入冗余绑定锚点：Moss headers、RFC thread、Subject Tag、Body Anchor、签名 context block，降低不同邮件客户端丢 header 的风险。
- 新增 inbound mail intake pipeline：只处理来自默认收件箱或白名单、匹配 reply chain、带 Moss context、签名有效且未过期的回复。
- 新增低摩擦 reply command 解析：MVP 支持 `ACTION: NEXT`、`ACTION: CHANGE`、`ACTION: PAUSE`、`ACTION: STOP`、`ACTION: STATUS`，同时支持用户直接回复“继续 / 下一步 / 暂停 / 停止 / 状态”或直接写自然语言要求；直接自然语言会作为当前 session 的 `CHANGE` 指令处理。
- 新增最小 inbound command ledger，只保存已过滤的 session command、状态、reject reason 和 sanitized detail，不保存无关邮件或完整原始邮件。
- 设置页邮箱设置新增 tab：文档 / 发送配置 / 收信监听 / 邮件会话，支持查看活跃邮件 session、邮件事件时间线、待确认/异常回复，并跳转到对应 workspace、thread 和 turn anchor。
- 发送配置中的授权码 / App Password 输入框默认以脱敏状态展示，并提供仅 UI 层的显示/隐藏切换；切换只改变输入框可见性，不改变 secret 保存、清除或测试发送语义。
- 对重复回复、旧邮件回复、多封回复、缺失 context、歧义指令、运行中 session 等边界行为给出稳定处理策略。
- 为真实邮件客户端补充抗干扰规则：只解析 `Reply above this line` 之前的新增内容，忽略 quoted thread、签名档、自动回复和转发内容。
- 对高风险或超出邮件建议范围的指令进入确认队列，不直接执行。
- 真实 IMAP 接入已覆盖 126/163/QQ/custom provider 配置；针对 126/163 这类要求客户端身份声明的服务，收信阶段发送 IMAP `ID` 能力信息以降低 `SELECT Unsafe Login` 类失败。

## Capabilities

### New Capabilities

- `email-driven-session-continuation`: 定义 inbound mail intake、reply command protocol、session binding、minimal mail command ledger、邮件会话管理页和跳转 UX。

### Modified Capabilities

- `conversation-completion-email-notification`: completion email 从完整 final turn 内容调整为可回复的精简摘要，并附带可校验 session metadata/context。
- `email-sending-settings`: 邮箱设置扩展为发送配置、收信监听和邮件会话管理入口，同时保持 secret 隔离和无关邮件不入库。

## 技术方案选项与取舍

### 选项 A：自然语言邮件直接作为 prompt

优点是用户输入最自由，第一版 UI 成本低。缺点是无法稳定区分“继续”“修改”“暂停”“闲聊”，也无法避免引用正文、签名、转发内容导致误执行。

结论：不采用。邮件闭环首先要可控和可审计，自然语言只能作为 `DETAIL`，不能替代结构化 `ACTION`。

### 选项 B：结构化 ACTION 协议 + 签名 session context

优点是简单、稳定、可落地；客户端可以在执行前确认唯一 intent、session 绑定、reply token、过期时间和幂等状态。缺点是要求用户回复时保留少量格式。

结论：作为机器协议保留，但不是用户唯一入口。早期测试表明邮件里要求用户写 `ACTION` 会增加使用成本，所以最终采用“自然语言优先、结构化兼容”的 UX：用户可直接回复一句话；解析层仍把它归一化为 `NEXT`、`CHANGE`、`PAUSE`、`STOP` 或 `STATUS`，并继续执行同一套签名、token、sender、dedupe 校验。

### 选项 C：完整 IMAP 邮箱客户端

优点是功能完整。缺点是范围过大，会引入普通邮件隐私、存储膨胀、附件、HTML、删除/归档同步和多邮箱状态等复杂问题。

结论：不采用。本变更只做 Moss control-plane inbox，不做通用 inbox。

## Impact

- Frontend:
  - Settings 邮箱设置 tab 结构与邮件会话管理 UI。
  - session 跳转能力：workspace/thread/turn anchor。
  - completion email body builder、subject builder、reply command state display。
  - 邮件驱动 runtime hook：周期性 read-only 检查邮箱、领取 queued command、投递到绑定 thread，完成后自动 arm 下一封可回复 completion email。
- Backend / Tauri:
  - inbound mail reader / polling command 或后台 intake loop。
  - outgoing mail ledger、inbound command ledger、token/signature validation、dedupe。
  - typed Tauri bridge for management actions and manual mailbox check.
- Storage:
  - 新增最小邮件 session / command ledger。
  - 不存储无关邮件；疑似 Moss 邮件只在 quarantine 中保存 sanitized metadata 和 reject reason。
- Security / Privacy:
  - reply token 明文不进入普通日志；secret 不进入 frontend diagnostics。
  - 默认只接受默认收件箱或白名单发件人的有效回复。

## 验收标准

- Completion email 正文默认只包含状态、本轮修复信息、下一步建议、回复指令和 Moss context，不再发送完整长回答。
- Completion email subject 必须包含可读 engine、session name、workspace name，并对过长名称做字符安全截断。
- Completion email 正文必须包含本轮用户请求，方便用户在邮箱里理解上下文。
- Completion email 的本轮修复信息来自本轮客户端可见的 assistant 正文块；同一轮内如果存在先输出长结果、末尾再追加短确认的多个 assistant message，必须按顺序合并，不能只取最后一条短消息；仍必须排除 reasoning/thinking、tool call、file change card、diff、command output、review/image card 等非正文内容。
- 可回复邮件具备 headers、Subject Tag、Body Anchor、signed context 的冗余 session binding；任一可用锚点仍必须通过 token/signature/latest 校验。
- 用户回复 `继续`、`下一步`、`ACTION: NEXT` 能继续最新 actionable session；用户直接写自然语言需求时，系统把新增内容作为 `CHANGE` 指令继续当前 session。
- 多 `ACTION`、过期 token、重复 reply、旧邮件 reply、签名失败、非白名单发件人均不会自动执行。
- 普通无关邮件不会被保存、展示或进入 quarantine。
- 邮件会话管理页可以查看有效邮件事件、待确认/异常项，并跳转到对应 workspace/thread/turn。
- 邮件发送设置中的授权码输入框默认 MUST 脱敏；用户 MAY 通过明确的显示/隐藏 icon 临时查看或重新隐藏，且该 UI 状态不得改变 secret 存储或提交 payload。
- 收信监听默认不修改远端邮箱状态；重复检查通过 local cursor 和 dedupe ledger 保证幂等。
- 用户在会话中选择发送 completion email 后，该邮件默认创建可执行 reply target；未选择邮件发送的 session 不会被自动纳入邮件闭环。
- 所有执行路径保留幂等去重和 audit 状态，邮件 side effect 不破坏现有 conversation lifecycle。

## 当前实现回写（2026-05-21）

当前工作区实现与人工验收后的最终 MVP 行为如下：

- `src/features/threads/utils/conversationCompletionEmail.ts` 负责生成邮件标题与正文。标题形态为 `Moss completed - <Engine> · <Session> · <Workspace>`，后端在 actionable 模式下继续追加 `[Moss #<short-session>]` subject tag。正文包含“本轮用户请求 / 本轮修复信息 / 下一步建议 / 如何回复”，并保留 `Reply above this line` 与 `MOSS CONTEXT` fallback。
- 邮件正文只取用户能在客户端最终消息区域看到的文本：以本轮最后完成的 `isFinal` assistant message 为锚点，从本轮 user message 之后按顺序合并所有 assistant message 正文，避免 Codex 在同一轮先输出长项目扫描、末尾再追加短确认时邮件只拿到短确认；file change、tool invocation、diff、command output、review、generated image、thinking/reasoning 卡片都不进入邮件。
- `src-tauri/src/email/session_continuation.rs` 负责 outgoing ledger、reply token hash、signature、Subject Tag、Body Anchor、MOSS CONTEXT、inbound filtering、reply parsing、dedupe 与 command ledger。无关邮件直接 ignored，不保存 subject/body/sender detail；Moss-like rejected candidate 只保存 sanitized reason。
- `src/features/threads/hooks/useThreadCompletionEmail.ts` 中用户点选发送邮件时会创建 `mailDrivenSessionEnabled: true` 的 intent；目标 turn settle 后发送可回复 completion email。若 Codex/Claude 首轮消息落盘与 terminal event 存在短暂竞态，发送逻辑会重试构建，避免第一次点选邮件却没发出。
- `src/features/threads/hooks/useMailDrivenSessionContinuation.ts` 周期性检查 inbox、claim queued command，确认 workspace active 后调用 `sendUserMessageToThread(..., { skipPromptExpansion: true })` 投递到原 thread；执行完成后自动 arm 下一封可回复 completion email，形成邮件驱动闭环。
- 邮件回复驱动下一轮执行时，completion email intent 必须绑定到下一轮新 turn，而不能回退到上一轮 active turn；邮件正文构建必须只使用 intent armed 之后完成的 assistant final message。若新 turn completion event 先到而最终消息尚未进入 `items`，必须进入 build retry，不能复用上一轮 final message 发送重复邮件。
- `src/features/settings/components/settings-view/sections/EmailSenderSettings.tsx` 将设置页拆成 `文档 / 发送配置 / 收信监听 / 邮件会话`。邮件会话 tab 只展示 Moss 相关 session 与 sanitized timeline，支持刷新、清理已处理记录、查看邮件、打开对应 session；普通无关邮件不入库、不展示。
- 当前用户人工测试已覆盖：发送 completion email、邮箱回复继续、直接自然语言回复、收件箱过滤、邮件会话跳转、126 IMAP 收信、标题可读性、正文排除 file/tool/card 信息。
