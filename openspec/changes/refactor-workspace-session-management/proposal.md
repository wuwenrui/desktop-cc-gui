# Proposal: Refactor Workspace Session Management

## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 62/62 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `session_management.rs/types/catalog_projection`、workspace session service mapping、folder counts、source statuses、batch mutations 与 catalog tests 已存在。
- **Next action**: 归档前补 full session management verification，并明确与 `unify-claude-workspace-session-catalog` 的边界。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Summary

重构 workspace / project 会话管理链路，解决 P0 级 session 消失、project catalog 与磁盘真实 session 不一致、父子会话归属漂移、查询慢、物理删除失败后无法自愈，以及会话整理缺少项目层级入口的问题。

本变更把“磁盘 session 文件”定义为存在性事实源，把 workspace session metadata 定义为组织与归档 projection。会话管理页必须基于统一 session index 展示项目树、session folder tree、父子会话和一致性状态，并在 delete / archive / folder assignment 后保持 sidebar、Workspace Home 与 Settings 的口径一致。

## Problem

当前实现已经有 `SessionManagementSection`、workspace session catalog、folder assignment、archive/delete 命令，但这些能力仍是拼接态：

- 会话列表每次跨 Codex / Claude / Gemini / OpenCode 扫描并组合，缺少统一 index result 和可解释的 reconciliation status。
- metadata 中的 archive / folder assignment 可能引用磁盘上已不存在的 session，UI 仍可能展示或删除失败。
- delete 对不同 engine 的“not found”语义有 best-effort 处理，但没有把“物理不存在，metadata 已清理”的结果作为一等状态返回给前端。
- Settings 会话管理只有顶部 workspace picker，没有左侧 project/worktree/folder 层级菜单，用户无法按项目结构整理会话。
- 父子会话已有 `parentSessionId` 字段，但 UI 没有稳定树化展示与删除边界说明。
- 大项目查询在 filter / status 下容易进入 exhaustive scan；用户感知为慢，且 partial/degraded 状态不够明确。

## Goals

- Session catalog MUST return disk existence, owner workspace, parent session, folder assignment, inconsistency status and deletion capability in one normalized entry.
- Delete MUST physically delete disk session when present, then cleanup archive/folder metadata; if disk file is already missing, delete MUST settle as idempotent cleanup success with an explicit code.
- Session Management MUST render a left project hierarchy: project/worktree rows, each row showing folder tree and session counts for the selected scope.
- Session list MUST support parent-child display for native parent/subagent sessions without changing ownership.
- Query MUST stay bounded for first-page loads, expose partial/degraded status, and avoid treating degraded omissions as authoritative deletion.
- Folder assignment MUST remain organization-only; cross-project moves remain rejected.
- Sidebar / Workspace Home / Settings MUST share the same strict project/worktree membership semantics.

## Non-Goals

- 不引入数据库或外部索引服务。
- 不重写所有 engine history parser。
- 不改变 engine 原始 transcript 格式。
- 不支持跨 project 移动 session。
- 不重做完整聊天发送链路；会话幕布本轮定位为只读查看器，继续聊天能力留给后续独立变更。

## Impact

- Backend:
  - `src-tauri/src/session_management.rs`
  - `src-tauri/src/session_management_tests.rs`
  - `src-tauri/src/local_usage/session_delete.rs`
- Frontend service:
  - `src/services/tauri/sessionManagement.ts`
  - `src/services/tauri.test.ts`
- Frontend UI / hooks:
  - `src/features/settings/components/settings-view/sections/SessionManagementSection.tsx`
  - `src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.ts`
  - `src/features/app/utils/workspaceSessionFolders.ts`
- Specs:
  - `workspace-session-management`
  - `workspace-session-catalog-projection`
  - `workspace-session-folder-tree`

## Acceptance Criteria

1. 删除磁盘存在的 Codex / Claude / Gemini / OpenCode session 后，真实 session 文件消失，metadata 中 archive / folder assignment 同步清理。
2. 删除 metadata 指向但磁盘已不存在的 session 时，UI 显示“已清理失效索引”，不再保留失败项反复重试。
3. 父 session 与 child/subagent session 能在会话管理列表中树化展示；删除 child 不影响 parent，删除 parent 不静默删除 child，除非后端明确返回级联结果。
4. 左侧项目层级菜单展示 project、worktree、folder 和 count/degraded badge；选择项目后右侧 session list 与当前 strict projection 一致。
5. 大项目 first page 不强制全量 exhaust；filter/status 需要 exhaustive 时必须暴露 loading/degraded/partial 事实。
6. `openspec validate refactor-workspace-session-management --strict --no-interactive` 通过。
7. Targeted Rust / Vitest / TypeScript 验证通过；若全仓已有无关 typecheck 失败，必须明确隔离。
