## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 55/55 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: Claude source-fact cache/tests、`WorkspaceSessionCatalog*` types, source completeness, stable key, owner evidence, listWorkspaceSessions mapping and Settings display-window/page-size adjustments are present. Control-plane `codex app-server` filter has targeted tests.
- **Next action**: 归档前补 catalog projection verification，确认 no raw transcript cache、owner routing、source completeness 与 UI surfaces 一致。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

右侧工作区会话列表里 `Claude Code` 会话仍会被“吞掉”，而 `Codex` 基本正常，说明问题不是单纯的 UI 渲染 bug，而是 Claude 会话读取、归属、catalog projection、前端合并与命名之间缺少单一事实源。

当前实现已经完成过 disk-first session management 重构，但 Claude 在 sidebar / workspace active projection 中仍同时依赖 native history scanner 与 workspace catalog。只要其中一条链路返回“看似成功的空结果”、workspace ownership 被重写、或前端再做一次 exact `workspaceId` 过滤，真实存在的 Claude transcript 就可能从右侧工作区列表消失。

## 目标与边界

本变更目标是把右侧工作区会话中的 Claude listing 重构为可解释、可测试、可恢复、可加速的统一 projection，并按演进顺序同时落地方案 B 与方案 C：

- `workspace session catalog` 成为 Sidebar / Workspace Home / Settings 默认工作区会话列表的唯一 membership 事实源。
- Claude native history scanner 只负责产出 disk facts 与 transcript load，不再由前端把 native list 和 catalog list 作为两个并列事实源互相合并。
- 后端必须区分 `authoritative empty`、`partial/degraded empty` 与 `uncertain empty`，禁止把不完整扫描的空结果当作“没有 Claude 会话”。
- Workspace ownership 必须集中决策，parent workspace、child worktree、git root、Claude project directory 与 transcript `cwd` 的优先级必须稳定。
- Display title 必须集中解析，Sidebar、Settings、Curtain 不能各自生成不同的 Claude 名称。
- 在 membership truth 收敛后，引入持久 source-fact cache，加速 Claude 大历史 cold start 与重复 catalog 刷新。

本变更是 `refactor-workspace-session-management` 的 Claude-focused follow-up。旧变更解决了 disk-first CRUD、folder、archive、delete、management UI 等大面问题；本变更专门处理 Claude 在右侧工作区 projection 中被吞的问题。

## 架构审查优化结论

这次重构的核心不是“多补一条 fallback”，而是把 session lifecycle 的五个概念彻底拆开：

| 层级 | 新边界 | 不能再承担的职责 |
|------|--------|------------------|
| Claude source scanner | 读取磁盘，产出 bounded facts 与 diagnostics | 不能决定默认 workspace membership |
| Ownership resolver | 根据 cwd / project dir / git root / workspace graph 解析 owner | 不能做 UI display filter |
| Workspace catalog projection | 生成 strict/related/global scope 下的 membership truth 与 source completeness | 不能把 metadata 当成 session 存在性 |
| Metadata overlay | 管 archive / folder / custom title 这类组织状态 | 不能证明 transcript 仍存在 |
| Frontend surfaces | 展示 projection、叠加 runtime state、处理 continuity | 不能重新实现 workspace membership 判断 |
| Source-fact cache | 缓存 transcript bounded facts、fingerprint 与 scanner diagnostics | 不能缓存最终 workspace membership truth |

因此新设计边界是：**后端 catalog 决定“谁属于当前 workspace projection”；前端只决定“怎么展示这个 projection”。**
旧设计的问题是 Sidebar 同时信任 native Claude list、workspace catalog、last-good cache 与局部 title fallback，导致任意一条链路返回成功空结果时，都可能把真实 Claude 会话吞掉。

## 新旧设计差异

| 维度 | 旧设计 | 新设计 |
|------|--------|--------|
| Membership 事实源 | Sidebar 前端合并 native list + catalog + last-good | `listWorkspaceSessions` active strict projection 是默认事实源 |
| Claude scanner | 扫描时可能直接过滤 cwd 不匹配 transcript | 产出 facts / unresolved candidates / source diagnostics |
| Empty 语义 | empty 常被当作“没有会话” | `authoritative_empty`、`uncertain_empty`、`partial`、`degraded` 分离 |
| Ownership | scanner、catalog、frontend helper 分散判断 | centralized ownership resolver 单点决策 |
| Frontend filter | 可能用 exact `workspaceId` 二次过滤 | 只做展示 filter，不重算 membership |
| Metadata | 裸 `sessionId` 容易跨 owner/engine 碰撞 | `engine + ownerWorkspaceId + canonicalSessionId` stable key |
| Title | Sidebar / Settings / Curtain 各自 fallback | 统一 resolver，弱 fallback 不覆盖强标题 |
| Continuity | last-good 可能承担事实源职责 | 只在 source incomplete 时保留可读性 |
| Cache | 每次刷新重复扫大历史 | 复用 fingerprint 命中的 bounded source facts，membership 仍由 catalog 当次投影 |

## 演进路线

本变更采用 **方案 B + 方案 C 的演进式落地**：

```text
Phase 1: Correctness
Claude disk facts
  -> centralized ownership resolver
  -> workspace catalog projection
  -> frontend display

Phase 2: Performance
Claude disk facts
  -> persistent source-fact cache
  -> centralized ownership resolver
  -> workspace catalog projection
  -> frontend display

Phase 3: Recovery / Hygiene
cache validation
  -> orphan cleanup
  -> diagnostics
  -> bounded rebuild
```

核心原则：**C 只加速 facts 读取，不替代 B 的 membership contract。**
缓存命中只能跳过重复 JSONL summary parsing；不能跳过 ownership resolver、archive/folder overlay、strict projection、source completeness 合并。

## What Changes

- 收敛 Claude 工作区会话读取路径：
  - 后端 catalog 负责对 Claude transcript 做 source indexing、ownership resolution、archive/folder metadata overlay 与 projection completeness 标注。
  - 前端右侧工作区会话列表只消费共享 active projection；`listClaudeSessions` 保留为 transcript/detail load 或诊断 fallback，不再决定默认 membership。
- 引入 Claude source completeness contract：
  - `authoritative_empty`：扫描完整且确认当前 strict scope 没有 Claude 会话。
  - `partial` / `degraded`：扫描超时、被 cap 截断、某些 transcript 解析失败、native source 不完整。
  - `uncertain_empty`：源返回空，但无法证明 Claude storage、project directory、cwd attribution 都已经完整覆盖。
- 重构 Claude ownership 规则：
  - 优先使用 transcript `cwd` 的 exact / longest workspace path match。
  - 其次使用 Claude project directory 与 workspace path 的直接编码关系。
  - 再考虑 git root / parent inference。
  - sibling ambiguity 必须进入 unresolved/degraded，不得误归 parent，也不得直接从当前 projection 消失且无诊断。
- 修正 projection 过滤边界：
  - 后端返回的 project projection 必须自带 owner scope evidence。
  - 前端不得再用 `entry.workspaceId === currentWorkspaceId` 这类 exact 二次过滤吞掉 child/worktree 归属的合法会话。
- 统一 session identity 与 metadata key：
  - folder/archive/custom title 等 metadata 应使用 `{engine, ownerWorkspaceId, canonicalSessionId}` 或等价稳定 key。
  - 避免只按裸 `sessionId` 造成跨 workspace/engine collision。
- 统一 title resolver：
  - 优先级：custom title > mapped title > native title / first real user message > stable engine fallback。
  - 低置信度 fallback（如 `Claude Session`、`Agent N`）不得覆盖已有高置信度标题。
- 增加测试与诊断：
  - Rust 覆盖 Claude cwd/parent-child/worktree/ambiguous/missing-cwd/direct-project-dir 场景。
  - Vitest 覆盖 sidebar projection 不因 uncertain empty 清空 Claude、不因 exact workspace filter 吞 child/worktree row、Settings 与 Sidebar title 一致。
- 引入持久 source-fact cache：
  - 缓存按 `{engine, physicalPath, mtime, size, scannerVersion, schemaVersion}` 或等价 fingerprint 命中。
  - 缓存内容仅包含 bounded facts、title evidence、source diagnostics、file metadata，不包含完整 transcript、large inline payload 或最终 workspace membership。
  - workspace graph、owner resolver version、engine config home 变化时必须重新计算 owner 或触发 cache namespace/version invalidation。
  - cache miss / stale / corrupt / disabled 时必须 fallback 到 direct scan，并暴露 degraded 或 rebuild diagnostics。
- 收紧 Claude history control-plane filter：
  - `codex app-server` 只在纯命令形态下视为 control-plane 文本。
  - 正常用户/assistant 文本即使提到 `codex app-server`，也必须作为真实 Claude Code 对话保留。
- 调整 Session Management 默认读取窗口：
  - 设置页会话管理首批 catalog page size 提升到 `999`，用于降低“管理页看不全”的误判。
  - Sidebar 启动列表仍保持独立分页窗口，避免扩大启动加载压力。

## 关键架构约束

- **Strict surface 不接收 unresolved owner**：未能唯一归属的 Claude transcript 不能混入当前 workspace strict 列表；必须以 diagnostics、related/global surface 或 future unassigned surface 的形式可解释。
- **Project aggregate 可包含 child owner row**：main workspace projection 可以展示 child worktree session，但 row 必须保留真实 `ownerWorkspaceId`，mutation 也必须按该 owner 路由。
- **Source completeness 必须按 engine 保守合并**：Claude `uncertain_empty` 不能因为 Codex complete 而被全局 summary 掩盖；UI 必须能看到 Claude 自身的 incomplete evidence。
- **Authoritative empty 需要证明路径完整**：只有 storage 可达、scan 未 cap/timeout、project dir/cwd attribution 覆盖完成，且 strict scope 内没有 match 时，才能清除 continuity。
- **Metadata orphan 只能由 authoritative missing 触发**：partial/degraded/uncertain scan 下不得把 metadata 当作孤儿并提供 destructive cleanup。
- **Loader failure 不改 membership**：打开 transcript 失败只能进入 recoverable load failure；不能把 catalog row 从 workspace membership 中静默删除。
- **Cache 不定义 membership**：持久 cache 只能作为 source fact 加速层；不得把 `ownerWorkspaceId`、strict membership、archive/folder 状态作为最终 truth 持久化后直接复用。
- **Cache 必须可重建**：cache 丢失、损坏或版本不兼容时，系统必须能从 Claude JSONL 重新扫描并恢复 projection。

## 非目标

- 不引入后台 daemon、外部数据库或 always-on watcher；本轮 C 采用 app 内 read-through persistent source-fact cache。
- 不重写 Claude transcript 原始格式，也不迁移用户本地 Claude 历史。
- 不扩大 strict project membership；related/global 历史仍必须与 strict 工作区会话区分。
- 不改变 Claude 聊天发送、resume、realtime streaming 主链路。
- 不把 last-good continuity 作为最终事实源；它只在 source degraded 时提供临时可读性。
- 不把 cache 当作用户不可恢复的数据源；cache 是可删除、可重建的派生数据。

## 方案取舍

### 方案 A：继续在前端 patch native Claude list 与 catalog 合并

优点：

- 改动小，可以快速缓解单个 timeout 或 empty regression。
- 不必马上拆 Rust catalog 结构。

缺点：

- 继续保留两个 membership 事实源，问题会反复出现。
- 前端无法可靠判断“空结果是否可信”，只能堆 last-good fallback。
- parent/worktree ownership 与 metadata key collision 仍然难以测试。

结论：不采用。它是止血方案，不是重构方案。

### 方案 B：以 workspace session catalog 作为唯一 membership 事实源

优点：

- Membership、archive/folder metadata、workspace owner、source health 在同一 response 内可解释。
- Sidebar / Workspace Home / Settings 口径可以统一，Claude 与 Codex 的差异变成 engine source adapter 差异。
- Rust 层更适合处理 path/cwd/git-root/Claude-project-dir 归属规则，测试可控。

缺点：

- 需要拆分 `session_management.rs` 中的 source、ownership、projection、metadata 责任。
- 需要调整前端 hooks，移除一部分历史 fallback 逻辑。

结论：采用，作为 Phase 1。它符合 disk-first catalog 的既定方向，也能从结构上消除 Claude 被吞的主要来源。

### 方案 C：建立持久本地索引缓存

优点：

- 大历史查询性能最好。
- 可以离线记录 source health 与 scan cursor。
- 可以把 cold start / repeated refresh 从全量 JSONL parsing 降为 fingerprint check + cache hit。

缺点：

- 引入新状态源，增加迁移、清理、回滚与数据一致性成本。
- 如果直接缓存最终 membership，会把错误 owner、ghost session、stale title 固化。

结论：采用，作为 Phase 2，但收窄为 **source-fact cache**。它缓存读取 facts，不缓存最终 membership；B 的 resolver/projection 仍是事实源。

### 最终采用策略：B + C 演进式实现

| 阶段 | 目标 | 关键交付 |
|------|------|----------|
| Phase 1 | 正确性收敛 | Catalog 唯一 membership、source completeness、ownership resolver、stable key、title resolver |
| Phase 2 | 性能加速 | Claude source-fact cache、fingerprint invalidation、cache diagnostics、direct scan fallback |
| Phase 3 | 运维恢复 | cache rebuild、corrupt cache recovery、diagnostic surface、bounded cleanup |

这不是把 C 作为第四个事实源，而是把 C 放在 scanner 下方作为加速层。

## 代码识别与问题证据

当前关键链路如下：

- Claude native scanner：
  - `src-tauri/src/engine/claude_history.rs`
  - `scan_session_file` 会根据 transcript `cwd` 与 attribution scopes 过滤；当 `cwd` 不匹配或缺失且 fallback 不允许时，可能返回 `None`，形成“成功但为空”的假象。
  - 当前每次 listing 仍需要读取候选 JSONL 并解析 summary；大历史或大 payload 下重复刷新成本高，适合引入 source-fact cache。
- Workspace catalog：
  - `src-tauri/src/session_management.rs`
  - `build_workspace_scope_catalog_data` 会聚合 Codex / Claude / Gemini / OpenCode。
  - Claude entry 构建后会经过 strict attribution owner 解析；如果 owner 被重写到当前 projection scope 外，entry 可能被过滤。
  - `folder_assignment_keys_for_session`、folder count 等逻辑存在裸 `session_id` key 的碰撞风险。
- Tauri service：
  - `src/services/tauri.ts` 暴露 `listClaudeSessions` 与 `loadClaudeSession`。
  - `src/services/tauri/sessionManagement.ts` 暴露 `listWorkspaceSessions` 与 catalog 类型。
- Sidebar hook：
  - `src/features/threads/hooks/useThreadActions.ts`
  - 当前同时拉取 native Claude sessions、OpenCode sessions 与 project catalog sessions，再在前端合并。
  - fallback 依赖 last-good、partial-source、timeout marker；逻辑能缓解吞会话，但不能证明 membership。
- Catalog frontend helper：
  - `src/features/threads/hooks/useThreadActionsSessionCatalog.ts`
  - `loadActiveProjectCatalogSessions` 当前会按 exact `workspaceId` 做二次过滤，容易吞掉后端 project projection 中合法的 child/worktree owner row。
- Display / naming：
  - Sidebar、Settings、Curtain 多处各自推导 title。
  - 低置信度 fallback 有机会覆盖已有高质量标题，造成“同一会话不同名字”或“Agent N”重复行。

## Capabilities

### New Capabilities

- `workspace-session-source-fact-cache`: 定义 engine source facts 的持久 read-through cache contract，要求缓存只加速 bounded facts 读取，不成为 workspace membership 事实源。

### Modified Capabilities

- `workspace-session-catalog-projection`: 明确 catalog 是右侧工作区默认会话 membership 的唯一事实源，并要求 projection 携带 Claude source completeness、ownership evidence 与 authoritative-empty 语义。
- `workspace-session-management`: 补充 Claude disk facts、metadata overlay、stable session key、folder/archive/title 组织层与真实存在性分离的要求。
- `claude-session-sidebar-state-parity`: 调整 Claude sidebar listing contract，使 native list 不再绕过 catalog membership；last-good continuity 只能在 degraded/uncertain source 下保留可读性，不能扩大 membership。
- `claude-history-transcript-visibility`: 补充 transcript scanner 与 loader 的职责边界：scanner 产出 bounded metadata 与 source diagnostics，loader 负责 transcript restore，不参与 workspace membership 二次判断。

## Impact

Backend:

- `src-tauri/src/engine/claude_history.rs`
- `src-tauri/src/session_management.rs`
- `src-tauri/src/session_management_types.rs`
- `src-tauri/src/session_management_folder_counts.rs`
- `src-tauri/src/session_management_tests.rs`
- 新增或提炼 cache 模块，例如 `src-tauri/src/session_source_fact_cache.rs` 或等价位置

Frontend services:

- `src/services/tauri.ts`
- `src/services/tauri/sessionManagement.ts`
- `src/services/tauri.test.ts`

Frontend hooks / UI:

- `src/features/threads/hooks/useThreadActions.ts`
- `src/features/threads/hooks/useThreadActions.helpers.ts`
- `src/features/threads/hooks/useThreadActionsSessionCatalog.ts`
- `src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.ts`
- `src/features/settings/components/settings-view/sections/SessionManagementSection.tsx`
- `src/features/settings/components/settings-view/sections/SessionManagementSessionList.tsx`

Specs:

- `openspec/specs/workspace-session-catalog-projection/spec.md`
- `openspec/specs/workspace-session-management/spec.md`
- `openspec/specs/claude-session-sidebar-state-parity/spec.md`
- `openspec/specs/claude-history-transcript-visibility/spec.md`
- `openspec/specs/workspace-session-source-fact-cache/spec.md`

## 实施校准（2026-05-22）

人工验证：右侧工作区会话外观与盲盒前表现接近，核心交互未观察到明显回退。实现按方案 B + C 完成，但边界需要精确记录：

- 方案 B 已覆盖 Claude 与 Codex：统一 catalog membership、stable metadata key、owner-aware mutation routing、Sidebar / Workspace Home / Session Management projection 口径。
- 方案 C 本轮是 Claude 专属 read-through source-fact cache：只缓存 bounded source facts，不缓存 owner、membership、archive/folder/custom title 或 display window。
- Codex 接入 shared catalog contract 与 mutation routing，但不改变 Codex 原有 workspace-scoped summary 扫描语义，也不新增 Codex source-fact cache。
- Claude empty 语义当前采用保守策略：无法完整证明 strict scope 没有 Claude transcript 时返回 `uncertain_empty`；cap / read error / unreadable diagnostics 会进入 `partial` 或 `degraded`，避免误清 last-good continuity。
- 大文件治理已校准：`claude_history.rs` inline tests 拆出，`session_management.rs` catalog projection 构建块拆出，hard gate 从失败降为通过；剩余为 near-threshold watch。

No new runtime dependency is expected.

## Acceptance Criteria

1. 当 Claude transcript 真实存在且归属当前 workspace/worktree/project scope 时，右侧工作区会话列表必须显示该会话，不能被 native empty、catalog empty 或前端 exact workspace filter 吞掉。
2. 当 Claude source timeout、partial、degraded 或 uncertain empty 时，Sidebar 不得仅因本次 omission 清空 last-good Claude row；同时 UI 必须标记当前 projection 不完整。
3. 当后端能够完整证明当前 strict scope 没有 Claude 会话时，前端必须接受 `authoritative_empty` 并移除不再合法的 continuity row。
4. Parent workspace `/repo` 与 child worktree `/repo/sub` 同时存在时，Claude `cwd=/repo/sub` 必须归属 child；不得误归 parent，也不得在 parent project aggregate 中无诊断消失。
5. Sibling ambiguity 必须返回 unresolved/degraded evidence；不得静默选择一个 sibling 或 parent。
6. `SessionManagement`、Sidebar 与 Workspace Home 对同一 active strict projection 的 membership 口径一致；差异只能来自显式展示窗口或 UI filter。
7. Archive、folder assignment、custom title 不得证明 session 存在；metadata orphan 必须可解释且可清理。
8. 同一 Claude 会话在 Sidebar、Settings、Curtain 中显示同一稳定 title；低置信度 fallback 不覆盖高置信度 title。
9. Rust tests 覆盖 Claude ownership、missing cwd fallback、ambiguous ownership、authoritative empty vs uncertain empty、metadata stable key。
10. Vitest 覆盖 sidebar/catelog merge、last-good continuity、exact workspace filter 移除、title resolver 统一。
11. Source completeness 聚合测试证明 Claude incomplete 不会被其它 engine complete 掩盖。
12. Unresolved / ambiguous Claude owner 不进入 strict membership，但 diagnostics 可追踪到 physical path 或 redacted locator。
13. Claude source-fact cache 命中时不重新解析 unchanged JSONL，但仍重新执行 ownership resolver 与 catalog projection。
14. Cache stale、corrupt、schemaVersion mismatch、scannerVersion mismatch、file mtime/size mismatch 时必须 fallback direct scan 或 rebuild，不得返回 authoritative empty。
15. 删除 cache 后系统仍可从 Claude JSONL 重建同等 projection；cache 不得成为唯一事实源。
16. `openspec validate unify-claude-workspace-session-catalog --strict --no-interactive` 通过。
