## Why

Session Management 已经完成了 disk-first catalog、Claude source-fact cache、owner-aware projection 与 sidebar timeout fallback，但当前代码里仍有几处 truth boundary 没闭合：不完整 source 被当成 complete、sidebar archived evidence 可能无界扫描且失败静默、related sessions 仍偏 Codex、分页 cursor 依赖 offset。继续在单个 surface 上补 fallback 会让 membership truth 漂移。

本变更把剩余缺陷收束为一次小范围 hardening：先修会导致会话消失、误判完整、误归属或不可恢复的 P1；再把稳定 cursor、per-engine last-good 与批量 mutation 部分失败作为同一契约下的 P2。

## 目标与边界

- 会话存在性、source completeness、workspace ownership、archive/folder overlay、frontend continuity 必须各自有清晰职责。
- 不完整扫描、cap 截断、timeout、cache failure 或 archived evidence 不可用时，系统 MUST 暴露 partial/degraded/uncertain evidence，不能伪装成 authoritative complete。
- Sidebar、Workspace Home、Session Management MUST 继续消费共享 catalog projection；frontend 只能展示和 continuity seed，不能重新证明 membership。
- related sessions MUST 从 Codex-only 演进为 engine-neutral attribution surface，但不能污染 strict project sessions。
- batch folder move / archive / delete MUST 用 per-entry result 表达部分失败，不得让一个 owner workspace 的失败变成 request-level 全失败。
- 本变更不做大规模模块拆分；只修正事实边界、状态语义与最小 UI/service 映射。

## What Changes

- 修正 source status 语义：
  - capped scan、scan cap reached、timeout、cache degraded、source partial MUST 生成 non-authoritative status。
  - `Complete` 只允许在系统能证明对应 source/scope 已完整覆盖时返回。
- 收敛 archived evidence：
  - sidebar refresh 获取 archived map 时 MUST 有界、状态可解释，并在失败时返回 degraded evidence。
  - archived native fallback 不能因为 archived lookup 静默失败而重新出现。
- 扩展 related sessions：
  - inferred related surface MUST 支持 Claude、Codex、OpenCode、Gemini 或等价 engine-neutral entries。
  - Codex-only 过滤只能作为兼容 fallback，不能是最终 contract。
- 稳定分页与 cursor：
  - catalog pagination MUST 使用稳定 continuation token 或等价 anchor，不能只依赖 mutable offset。
  - 新 session 插入或排序变化不应导致同一 cursor chain 跳页或重复。
- 提升 frontend continuity：
  - last-good health MUST 按 engine/source 维度保存和判定。
  - 一个 engine degraded 不得阻止其它健康 engine 的快照更新。
- 细化 mutation 结果：
  - session folder assignment / archive / delete across owner workspaces MUST 返回 per-entry result。
  - request-level error 只用于请求无法解析或全局前置条件失败。
- 对齐 management page limits：
  - frontend 请求的 page size MUST 与 backend cap 明确协商；若 backend cap 截断，UI MUST 展示 cap/degraded 或继续分页，而不是假装 999 条已完整返回。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `workspace-session-catalog-projection`: 收紧 source completeness、archived evidence、bounded pagination 与 stable cursor contract。
- `workspace-session-management`: 收紧 engine-neutral related sessions、batch mutation partial result 与 page-size cap 对齐 contract。
- `sidebar-list-timeout-fallback`: 收紧 per-engine last-good snapshot health，避免 cross-engine degraded 自污染。

## 技术方案取舍

### 方案 A：继续在 sidebar hook 内补 fallback

优点：

- 改动最小，能快速遮住某些 Claude row 消失问题。
- 不需要改 Rust catalog contract。

缺点：

- frontend 无法证明 source 是否完整，只能猜。
- archived、related、cursor、mutation result 仍由不同层各自解释。
- 相同问题会在 Settings / Workspace Home / sidebar 之间继续漂移。

结论：不采用作为主方案。只允许保留为 degraded continuity 的展示层补救。

### 方案 B：修正 catalog truth boundary，再让 frontend 只消费 evidence

优点：

- source completeness、owner evidence、archive/folder overlay、pagination cursor 都能在一个 response contract 内表达。
- Rust 侧更适合处理 path、owner、scan cap、archive metadata 与 stable ordering。
- frontend 可以按 evidence 展示 degraded/partial，而不是重算 membership。

缺点：

- 需要同时触及 backend type、service mapping、thread hooks 和 settings hook。
- 必须补跨层回归测试，否则容易只修一个 surface。

结论：采用。P1 先修 source status、archived evidence、related engine-neutral；P2 再修 stable cursor、per-engine last-good、partial mutation result 与 page-size cap 对齐。

## 非目标

- 不引入数据库、daemon、watcher 或外部索引服务。
- 不重写 Claude/Codex/OpenCode/Gemini 的原始 history parser。
- 不迁移用户已有 metadata 文件格式；如需新 key，应提供兼容读取。
- 不改变聊天发送、resume、streaming、transcript load 主链路。
- 不扩大 strict project sessions 的 membership 范围；related/global 仍必须独立呈现。
- 不做会话管理 UI 大改版，只添加必要的 degraded/cap/partial-result 表达。

## Impact

- Backend:
  - `src-tauri/src/session_management.rs`
  - `src-tauri/src/session_management_catalog_projection.rs`
  - `src-tauri/src/session_management_types.rs`
  - `src-tauri/src/session_management_tests.rs`
- Frontend service:
  - `src/services/tauri/sessionManagement.ts`
  - `src/services/tauri.test.ts`
- Frontend hooks/UI:
  - `src/features/threads/hooks/useThreadActions.ts`
  - `src/features/threads/hooks/useThreadActions.helpers.ts`
  - `src/features/threads/hooks/useThreadActionsSessionCatalog.ts`
  - `src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.ts`
  - `src/features/settings/components/settings-view/sections/SessionManagementSection.tsx`
- Specs:
  - `workspace-session-catalog-projection`
  - `workspace-session-management`
  - `sidebar-list-timeout-fallback`

## Acceptance Criteria

1. scan cap reached / timeout / cache degraded / archived evidence failure 不得返回或渲染为 authoritative complete。
2. sidebar archived map refresh 在大历史下保持有界；失败时保留可解释 degraded evidence，并且 archived row 不因静默失败复活。
3. related sessions 至少覆盖 Claude 与 Codex 的 inferred attribution；strict surface 不混入 related entries。
4. catalog cursor 在新 session 插入或排序变化后不跳过或重复同一 cursor chain 内的既有结果。
5. last-good 快照按 engine/source 维度更新；一个 engine degraded 不影响其它 engine 保存健康快照。
6. batch folder move 跨多个 owner workspaces 时返回 per-entry success/failure；成功项更新，失败项保留并可重试。
7. Settings 请求 page size 超过 backend cap 时，UI 能看到 capped/degraded 或可继续分页状态。
8. `openspec validate stabilize-session-management-truth-boundaries --strict --no-interactive` 与 `openspec validate --all --strict --no-interactive` 通过。

## Implementation Status - 2026-05-23

P1 已落地：source status cap 降级、bounded archive evidence helper、sidebar archived/pending resurrection guard、engine-neutral related projection、service/frontend mapping 与 owner-aware mutation regression 均已实现并验证。

P2 已落地：stable opaque cursor、per-engine last-good snapshot、Settings page cap visibility、batch mutation per-entry partial result 均已实现并验证。
