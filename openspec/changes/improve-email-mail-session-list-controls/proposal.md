## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 21/21 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `EmailMailSessionList`、timeline event、mutate mail session、settings inbound listener/mail sessions surface 与 related tests 已存在。
- **Next action**: 归档前确认 email settings/session list focused tests 与 no-secret/raw-mail storage guard。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

邮件会话列表已经能聚合 Moss 相关邮件事件，但当前管理体验有两个断点：一是用户只能在列表底部看到“查看邮件”结果，内容多时没有明显反馈，也不容易发现详情已经展开；二是“刷新会话”和“清理已处理记录”缺少明确的执行态与结果反馈，用户会误以为按钮不可用。

本次变更要把邮件会话管理从“能看到记录”提升为“可理解、可清理、可定位”的维护界面，同时严格保持真实会话、workspace、thread 与 turn 数据不被邮件记录删除动作影响。

## 目标与边界

- 优化邮件会话列表中的 `查看邮件` UX：点击后必须在用户当前视野附近展示详情，并给出选中态、关闭入口和滚动容器。
- 增加“删除邮件信息”能力：只删除本地邮件 ledger 中该邮件会话对应的 outgoing/inbound 邮件记录，不删除真实会话、thread、workspace 或 runtime session。
- 修复/增强 `刷新会话` 与 `清理已处理记录`：点击后必须有 loading、success、error 反馈，并通过 typed Tauri bridge 调用现有后端能力。
- 保持现有好用功能不回退：`打开会话` 继续跳转到原 workspace/thread/turn；发送配置、收信监听、completion email 与 mail-driven continuation 主链路不改变。
- 所有邮件管理动作默认在本地 ledger 范围内完成，不删除、移动、归档或标记远端邮箱邮件。

## 非目标

- 不把 Moss 做成通用邮件客户端。
- 不展示普通无关邮箱邮件。
- 不删除真实会话、不清空 thread transcript、不移除 workspace session 文件。
- 不新增远端 IMAP 删除/归档/标记已读能力。
- 不重写邮件发送、收信解析、reply token、signature、dedupe 或 mail-driven continuation runtime。

## What Changes

- `邮件会话` tab 的顶部操作区提供可点击且有反馈的刷新与清理按钮：
  - 刷新：重新读取邮件会话列表与 listener 状态。
  - 清理：清理已处理 command 记录，并刷新列表。
  - 两者都展示进行中状态、成功提示和错误提示。
- 每个邮件会话行新增 `删除邮件信息` 操作：
  - 删除该 `sessionId` 关联的本地邮件 outgoing records 与 inbound command records。
  - 保留 session control / state 记录，避免误伤邮件驱动会话控制状态。
  - UI 文案必须明确“只删除邮件信息，不删除会话”。
- `查看邮件` 改为顶部详情面板：
  - 点击后在操作区与列表之间展示当前邮件会话详情，而不是追加到列表最底部。
  - 当前行显示选中态。
  - 详情面板有标题、关闭按钮和内部滚动区域。
  - 邮件事件多时面板内部滚动，页面布局不把内容静默推到不可见底部。
- 继续复用现有 `mutate_email_mail_session` command 与 `src/services/tauri.ts` typed bridge，不新增平行 invoke 路径。

## Capabilities

### New Capabilities

- `email-mail-session-management`: 定义邮件会话列表的本地 ledger 管理行为，包括查看邮件事件、刷新/清理反馈、删除邮件信息边界，以及不删除真实会话的安全契约。

### Modified Capabilities

- `email-sending-settings`: Settings 的邮件管理 tab 需要具备可反馈的刷新/清理操作、清晰的邮件详情展示，以及只删除邮件记录的本地 ledger 管理动作。

## 技术方案对比

### 方案 A：在当前 tab 内做顶部详情面板与 scoped ledger mutation

在 `EmailSenderSettings` 内保留邮件会话列表结构，把 `查看邮件` 详情区移动到列表上方；后端扩展现有 `mutate_mail_session` action，用新的精确 action 删除指定 session 的邮件记录。

优点：
- 改动最小，复用现有 typed bridge、ledger projection 和测试入口。
- 用户点击后反馈就在当前视野范围内，认知成本低。
- 后端 action 语义清晰，能从 contract 上防止误删真实会话。

缺点：
- 详情仍在 Settings 页面内，复杂审计能力不如独立邮件管理页面。

结论：采用。当前需求是局部 UX 与维护动作修复，不需要新页面或新 command。

### 方案 B：新建独立邮件事件管理页面或抽屉

把邮件会话管理从设置页拆出，提供全屏/抽屉式 mail event center。

优点：
- 可承载更复杂的筛选、搜索、批量审计和大列表虚拟化。

缺点：
- 范围显著扩大，会引入路由/布局/状态同步新复杂度。
- 当前用户痛点是按钮反馈、删除邮件信息和详情可见性，独立页面属于过度设计。

结论：不采用，避免为局部修复增加新 surface。

## 验收标准

- 点击 `刷新会话` 后，UI 必须进入刷新态；成功后列表刷新并显示成功提示；失败时显示可读错误。
- 点击 `清理已处理记录` 后，UI 必须进入清理态；成功后列表刷新并显示成功提示；失败时显示可读错误。
- 点击某行 `查看邮件` 后：
  - 详情面板必须出现在列表上方的可见区域。
  - 被查看行必须有选中态。
  - 详情面板必须可关闭。
  - 多条事件必须在详情面板内部滚动，不能只把内容推到页面底部。
- 点击 `删除邮件信息` 后：
  - 只删除该 session 的邮件 outgoing/inbound ledger records。
  - 不删除真实 conversation/thread/workspace/runtime session。
  - 不删除 `sessions` control record。
  - UI 列表和详情状态必须随后刷新；若当前详情属于被删除 session，详情应关闭或变为空态。
- `打开会话` 行为保持不变，仍使用已有 `onOpenMailSession` 跳转契约。
- 前端测试覆盖刷新、清理、查看详情位置/选中态、删除邮件信息 action。
- 后端 Rust 测试覆盖删除邮件记录不删除 session control。

## Impact

- Frontend:
  - `src/features/settings/components/settings-view/sections/EmailSenderSettings.tsx`
  - `src/features/settings/components/settings-view/sections/EmailSenderSettings.test.tsx`
  - `src/i18n/locales/zh.part1.ts`
  - `src/i18n/locales/en.part1.ts`
  - `src/styles/settings.part2.css`
- Shared types / bridge:
  - `src/types.ts`
  - `src/services/tauri.ts` should remain the command boundary; no direct `invoke()` from feature UI.
- Backend:
  - `src-tauri/src/email/session_continuation.rs`
  - No new Tauri command registration is expected.
- Validation:
  - Focused Vitest for `EmailSenderSettings`.
  - Focused Rust email/session continuation tests.
  - `npm run typecheck` if TypeScript contracts change.
