## Why

GitHub issue #604 的公开可见正文描述的是 Win11 下“大上下文时界面突然空白”：用户关闭并重新打开 ccgui 后，点击原 session 仍然空白，并且系统会自动创建 `agent2`、`agent3` 这类新 session；用户同时说明其他工具仍能读取该 session 的进度。

当前代码调研显示，相关风险不止一个：

- 大上下文 session reopen 后的 history load / render / hydrate 任一环节失败，都可能让 UI 进入空白或不可读状态；
- stale thread recovery 在 `thread not found` 后会尝试自动寻找 replacement，并在恢复成功后持久化 alias；
- Windows `Claude Code` 流式可见性已有 mitigation，但首段体验仍可能在用户感知到卡顿后才进入更强保护。

因此本 change 需要把 issue #604 的可见症状作为 P0，而不是只把 stale alias 误绑当成唯一根因。

## Problem Statement

### P0: 大上下文 session reopen 空白

当大上下文会话在 Windows 上发生空白时，系统必须优先保证用户能继续看到可解释的会话状态：

- 重新打开 session 不应只呈现空白画布；
- 如果原 session 仍在底层可读，UI 应恢复 last-good 或 degraded readable surface；
- 如果必须 fresh continuation，必须显式说明，不能静默创建 `agent2`、`agent3` 让用户误以为旧上下文已恢复。

### P1: stale thread alias 持久化过早

代码层面存在一条合理但需要收紧的风险链：

- `thread not found` 后恢复 replacement thread；
- 候选选择主要依赖 title/source/provider/newly-discovered/history-match 等启发式；
- 恢复成功后直接调用 `rememberThreadAlias(oldThreadId, replacementThreadId)`；
- alias 会被持久化并 canonicalize，误判会长期影响后续 reopen/restore。

这个风险能解释“点旧 session 后跳到新 agent / 错绑 / 重开后持续异常”的一部分现象，但不是 issue #604 的唯一已证实根因。

### P1/P2: Windows Claude Code 吐字慢

现有 `streamLatencyDiagnostics` 已经有 `candidateMitigationProfile` 与 `mitigationProfile`，并且 `resolveActiveThreadStreamMitigation` 会把 candidate profile 也返回给渲染面。问题不在于完全没有 candidate，而是：

- candidate 通常在 first delta 之后才 prime；
- active mitigation / diagnostics 对首段卡顿的分类和阈值仍偏后置；
- `commandExecution` / tool output 已经从 backend 到达时，旧诊断仍可能只因没有 assistant text delta 而报 first-token pending，造成“后端有信息但前端无故卡住”的误判；
- 阈值和触发语义不够可配置，不利于 Windows 用户反馈后的快速校准。

## What Changes

### 0. Finalized native session isolation

2026-05-24 针对 `hnms-osp` 的现场数据复核后，新增一条更明确的根因链：

- 后端 `load_claude_session` 能正常读取相关 Claude JSONL，未复现解析崩溃；
- `list_workspace_sessions` 能列出这些 Claude sessions，且标题来自各自 first real user message；
- 串线发生在前端 realtime binding：`thread_session_id_updated` 曾允许 active 的 finalized thread 从 `claude:old` 重绑到 `claude:new`；
- 该错误重绑还可能写入持久 `threadAliases`，后续点击旧 session 会被 canonical 到新 session，表现为闪屏、打不开或只能打开某一个 session。

处理原则：

- `claude:{sessionId}` / `gemini:{sessionId}` / `opencode:{sessionId}` 是已经落盘的 native session identity，不允许作为 alias source 被自动改绑；
- 只有 pending thread，例如 `claude-pending-* -> claude:{sessionId}`，可以由 native session confirmation 完成一次性绑定；
- 已经写坏的 finalized native alias 在加载或保存 alias map 时应自动过滤，避免历史坏状态继续污染 UI。

### 0A. Catalog partial source is not pagination

2026-05-24 继续观察 `hnms-osp` sidebar 后发现另一个列表数量错觉：

- catalog source 可能返回 `partialSource=claude-scan-cap-reached`，表示扫描质量降级；
- 当 `nextCursor=null` 时，这不代表还有下一页；
- 旧前端把 `partialSource` 也转换成 `catalog::__root__` cursor，导致 sidebar 底部显示“加载更早的...”；
- 用户点击或自动刷新后会重复请求第一页，现象上像“过一会数量对不上 / 有些 session 不显示”。

处理原则：

- 只有真实 `nextCursor` 才能驱动“加载更早的...”；
- `partialSource` 只能作为 degraded diagnostics / continuity input，不得伪造分页 cursor；
- scan-cap 类降级应通过诊断解释，不应暗示用户还能通过 load older 拉到更多当前页外数据。

### 0B. Active sidebar must use full catalog as the fact source

2026-05-24 继续对比 `hnms-osp` Sidebar 与 Strict 项目会话后，发现第三个“数量对不上”来源：

- active workspace 启动时曾为了首屏速度只跑 `first-page` hydration；
- 后续 `full-catalog` 补齐请求可能被新的刷新 / realtime 请求打成 stale；
- 旧 hydration 外层无法知道内部结果已被 stale guard 丢弃，仍把 workspace 标记为 fully hydrated；
- 更关键的是，所谓 `full-catalog` 只请求了 `listWorkspaceSessions(... limit: 200, cursor: null)` 一页；当后端因为 page-size cap 返回 `nextCursor` 时，Sidebar 仍然只掌握第一页子集；
- 结果是 Strict 管理页能持续加载更多页，而 Sidebar 长时间停留在 first page / last-good 子集。

处理原则：

- Sidebar 项目会话主列表不得再使用 startup `first-page` 作为可写入事实源；
- `full-catalog` 必须在内部沿 `nextCursor` 拉完整个 active catalog，直到 `nextCursor=null`、超时或明确 page cap；
- 超时 / page cap / cursor loop 只能标记 degraded partial，不能伪装成完整列表；
- 当前 active workspace 的 `full-catalog` 优先级必须高于无关 workspace 的 idle prewarm。

### 0C. Manual tracked refresh must not downgrade to first-page

2026-05-24 再次复核“过一会又不对应”后，发现第四个覆盖路径：

- `listThreadsForWorkspaceTracked` 既被 startup hydration 使用，也被 Sidebar 快速刷新、重命名后刷新、普通 reload 等手动/业务刷新复用；
- 旧默认值只要发现 workspace 是 active，就把未显式标记的 tracked refresh 当成 `active-workspace first-page`；
- 因此已经对齐 Strict catalog 的完整 Sidebar，会被后续普通刷新重新覆盖成 first-page / last-good 子集；
- 这就是用户看到 session 列表“过一会又少了 / 又变了”的核心前端原因之一。

处理原则：

- 不再保留 startup active `first-page` 写入路径；
- 未带 hydration kind 的 tracked refresh 必须默认 `full-catalog`；
- 手动刷新和业务刷新不得把完整 catalog projection 降级为任何子集快照。

### 1. Large-context blank session recovery guard

- 为大上下文 session reopen 增加可读性保护要求：
  - history load / hydrate / render 失败时，保留 last-good readable snapshot 或 degraded state；
  - 禁止在未说明原因的情况下把旧会话静默切到 fresh session；
  - fresh continuation 必须显式记录 reasonCode，并让 UI 可解释。
- 增加 diagnostics：
  - `large-context-reopen-blank`
  - `history-hydrate-degraded`
  - `fresh-continuation-created`

### 2. Stale thread recovery confidence gates

- 新增 `ThreadRecoveryDecision`：
  - `oldThreadId`
  - `candidateThreadId`
  - `strategy`
  - `confidence`
  - `scoreGap`
  - `featureSignals`
  - `reasonCode`
  - `isPersistent`
- 只有高置信且非歧义的 recovery decision 才允许持久化 alias。
- 低置信 recovery 可以用于当前运行时的可解释候选，但不得污染持久 alias map。
- 后续打开失败或校验不一致时，允许清理错误 alias。

### 3. Windows Claude stream visibility calibration

- 不把 candidate 描述为“完全 inactive”。当前 candidate 已参与渲染面。
- 新增要求：
  - 更早记录 candidate 命中和 first visible latency；
  - 将 candidate / active / diagnostic reason 分开；
  - 把 command/tool 运行态作为 non-text runtime progress，不再把工具执行期误判为 first-token pending；
  - 把关键阈值参数化；
  - 保持非 Windows、非 Claude 路径不受影响。

## Non-Goals

- 不把 issue #604 的根因直接定死为 alias 误绑。
- 不重写 Tauri streaming transport。
- 不迁移 thread/session storage schema；如需新增字段，必须兼容旧数据。
- 不做聊天 UI 大改版。
- 不删除现有 stale-thread manual recovery、first-turn stale draft、Claude Windows visible-stream mitigation 能力。

## Impact

- Frontend recovery:
  - `src/app-shell-parts/useWorkspaceThreadListHydration.ts`
  - `src/app-shell-parts/useWorkspaceThreadListHydration.test.tsx`
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/threads/hooks/useThreadActions.helpers.ts`
  - `src/features/threads/hooks/useThreadActions.test.tsx`
  - `src/features/threads/utils/threadStorage.ts`
  - `src/features/threads/utils/threadStorage.test.ts`
- Frontend streaming diagnostics:
  - `src/features/threads/utils/streamLatencyDiagnostics.ts`
  - `src/features/threads/utils/streamLatencyDiagnostics.test.ts`
  - `src/features/messages/components/Messages.tsx`
  - `src/features/messages/components/MessagesRows.tsx`
  - `src/features/messages/components/Messages.windows-render-mitigation.test.tsx`
- Backend observation only:
  - `src-tauri/src/engine/claude.rs`
- Specs:
  - `codex-stale-thread-binding-recovery`
  - `claude-code-realtime-stream-visibility`
  - `conversation-stream-latency-diagnostics`

## Acceptance Criteria

0. finalized native thread 不得被 realtime session update 或 persisted alias 改绑到另一个 finalized native thread。
0A. catalog `partialSource` 在没有 `nextCursor` 时不得显示 load-older cursor。
0B. active workspace Sidebar 必须直接以同源 `full-catalog` 为事实源；`full-catalog` 必须内部拉完 catalog cursor，不能只取 200 条第一页。
0C. 手动或业务触发的 tracked thread-list refresh 不得默认走 `first-page` 或任何子集写入，不得覆盖已对齐的 full-catalog Sidebar。
1. 大上下文 session reopen 失败时，UI 不得只有空白；必须展示 last-good、degraded 或 fresh-continuation explanation。
2. 自动创建 `agent2` / `agent3` 类 fresh session 时，必须显式标记原因，且 UI 不得暗示旧上下文已完整恢复。
3. `thread not found` 自动 recovery 只有在高置信、非歧义时才持久化 alias。
4. 低置信或歧义候选不得写入持久 alias map。
5. 错误 alias 可被后续失败或校验不一致触发清理。
6. Windows Claude stream diagnostics 能区分 candidate prime、active mitigation、first-visible latency 和 non-text runtime progress。
7. `openspec validate fix-stale-thread-recovery-confidence-gates --strict --no-interactive` 通过。

## Implementation Status

2026-05-24 已完成代码与自动化验证回写：

- finalized native session isolation 已实现：`claude:` / `gemini:` / `opencode:` 这类已落盘 native session 不再被 realtime `sessionId` update 或历史 `threadAliases` 改绑到另一个 finalized session。
- catalog partial / pagination 边界已实现：`partialSource` 不再被当作分页 cursor，只有真实 `nextCursor` 才能驱动 Sidebar load-older。
- active Sidebar full-catalog fact source 已实现：启动 active workspace 不再写入 `first-page` 子集，`full-catalog` 会在内部消费 catalog `nextCursor`，直到无下一页或进入明确 degraded stop。
- manual tracked refresh 降级问题已实现：未显式声明 kind 的 active workspace refresh 默认 `on-demand / full-catalog`，不会把已对齐的 Sidebar 覆盖成子集。
- Windows Claude non-text runtime progress 已实现：command / tool / file / terminal 类事件被视为运行态进展，不再仅因没有 assistant text delta 就误判 first-token pending。

已执行验证：

- `npx vitest run src/features/threads/hooks/useThreadActionsSessionCatalog.test.tsx src/app-shell-parts/useWorkspaceThreadListHydration.test.tsx src/features/threads/hooks/useThreadActions.test.tsx src/features/threads/hooks/useThreadActions.threadList.test.ts src/features/threads/hooks/useThreadActions.helpers.test.ts`
- `npm run typecheck`
- `openspec validate fix-stale-thread-recovery-confidence-gates --strict --no-interactive`

平台证据限定：

- Windows + Claude Code 手工烟测 qualifier 已记录在 tasks / closeout 文档中，范围包括 large-context reopen、command-progress waiting、slow visible text、Sidebar/Strict count alignment、manual tracked refresh stability。
- 当前状态应视为“代码、自动化验证、平台证据缺口记录已完成；真实 Windows 手工验收待外部机器或 CI 补证”，不是宣称所有用户环境都已完成实测。
- 缺少 Windows 实机不再表示本 change 的代码/proposal 校准未完成；归档时仍必须保留该 qualifier，不能写成 Windows 已通过。

## Notes

本 change 已包含运行时代码修改与测试。后续如果继续遇到 Claude session 闪屏，应优先检查是否还有其它路径写入 finalized native alias，或 backend 是否返回了与 explicit `--resume <sessionId>` 不一致的 session event。
