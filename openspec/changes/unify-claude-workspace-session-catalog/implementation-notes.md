# 实现审计备注

本文记录 `unify-claude-workspace-session-catalog` 的实现基线。它不是新的产品规范，规范事实仍以 `proposal.md`、`design.md` 和 `specs/**/spec.md` 为准。

## 1. Session Lifecycle 边界表

| 层 | 输入 | 输出 | 禁止职责 | 当前主要位置 |
| --- | --- | --- | --- | --- |
| Claude source scanner | Claude JSONL path、workspace path、attribution scopes、engine config | bounded source fact、source diagnostic、unresolved candidate | 不决定默认 workspace membership；不静默把不可归属 transcript 变成 authoritative empty | `src-tauri/src/engine/claude_history.rs` |
| Source-fact cache | physical path、mtime、size、scanner/schema version | cache hit/miss/stale/corrupt 以及 bounded facts | 不缓存 ownerWorkspaceId、archive/folder/custom title、strict membership、display window | `src-tauri/src/engine/claude_history.rs` read-through cache |
| Ownership resolver | source fact、workspace graph、cwd、Claude project dir、git/root evidence | owner workspace id、confidence、evidence code，或 unresolved/ambiguous | 不做 archive/folder/title overlay；不做 UI display filter | `session_management.rs` centralized resolver + mutation target resolver |
| Catalog projection | engine facts、owner evidence、scope kind、metadata overlay | strict/related/global membership、source completeness、filtered totals | 不把 metadata 当作 disk existence；不吞 incomplete source | `src-tauri/src/session_management.rs` |
| Metadata overlay | stable key、workspace catalog metadata | archivedAt、folderId、custom title 等组织状态 | 不证明 transcript 仍存在；partial scan 下不做 destructive orphan cleanup | `session_management.rs` + folder count helper |
| Frontend surfaces | catalog page、sourceStatuses、runtime state、last-good continuity | Sidebar / Workspace Home / Settings display rows | 不用 exact workspaceId 重算 membership；native empty 不删除 catalog truth | `src/features/threads/hooks/**` |

## 2. Source Completeness 映射

| completeness | 何时使用 | 是否允许清除 last-good | UI/诊断语义 |
| --- | --- | --- | --- |
| `complete` | engine 成功扫描并返回至少一条 row，或 bounded projection 可证明本页 rows 新鲜 | 仅允许删除 projection 明确排除的 row | fresh |
| `authoritative_empty` | storage 可达、未 timeout/cap、scope 覆盖完整且无 row | 可以清除对应 engine + scope 的 continuity | fresh empty |
| `partial` | 只拿到部分候选、cap 截断、局部 parse 失败但仍有可用 rows | 不可以 | incomplete |
| `degraded` | source 读取失败、权限错误、timeout、cache/store 失败 | 不可以 | degraded |
| `uncertain_empty` | source 返回空，但无法证明 Claude storage / project dir / cwd attribution 覆盖完整 | 不可以 | incomplete empty |

当前已落地的 additive contract：

- Rust: `WorkspaceSessionSourceCompleteness`、`WorkspaceSessionCatalogSourceStatus`、`source_statuses`
- TS: `WorkspaceSessionSourceCompleteness`、`WorkspaceSessionCatalogSourceStatus`、`sourceStatuses`
- Claude empty 保守标记为 `uncertain_empty`，原因 `claude-uncertain-empty`
- Claude source status 可携带 redacted diagnostics 与 cache hit/miss/stale/rebuild/failure metrics。

## 3. Ownership Evidence Codes

| code | 含义 | owner 结果 |
| --- | --- | --- |
| `cwd-exact` | transcript cwd 与 workspace path 完全匹配 | strong owner |
| `cwd-longest` | cwd 命中多个 workspace path，选择最长 path | strong owner |
| `project-dir-direct` | Claude project dir 与 workspace path 编码/路径直接对应 | medium owner |
| `git-root-inferred` | cwd 不在 workspace path 内，但 git/root evidence 指向 workspace | medium owner |
| `ambiguous-sibling` | sibling/worktree 多候选无法唯一归属 | unresolved/ambiguous |
| `cwd-project-conflict` | transcript cwd 与 Claude project dir 指向不同 owner | unresolved conflict |
| `source-incomplete` | source 本身 partial/degraded/uncertain，不能证明 missing 或 owner | unresolved/incomplete |

实现要求：strict projection 不能接收 unresolved owner；main project aggregate 可以展示 child owner row，但 row 必须保留真实 owner。archive / unarchive / delete / move-folder mutation 通过 catalog entry 反解真实 owner 与 stable key，写入 owner workspace metadata，并在 result 中返回 `ownerWorkspaceId` / `stableSessionKey` 给前端 reconcile。

## 4. Regression Fixture Matrix

| 轴 | 最小 fixture |
| --- | --- |
| owner case | parent `/repo`、child `/repo/sub`、worktree-only、sibling ambiguity、cwd/project-dir conflict、git-root inferred |
| source completeness | complete with rows、authoritative empty、uncertain empty、partial cap、degraded error、malformed transcript |
| metadata state | no metadata、archive、folder assignment、custom title、legacy naked session id、same naked id across workspaces |
| frontend surface | Sidebar active strict、Workspace Home aggregate、Session Management active/archived、Session Curtain title/detail |
| payload safety | large inline image/base64、GUI/Codex/JSON-RPC control-plane messages、subagent parent/child |

最小回归组合：

- main project aggregate 包含 child owner Claude row，worktree-only 不混入 parent/sibling。
- catalog `uncertain_empty` 保留 last-good Claude，`authoritative_empty` 清除 last-good Claude。
- native-only Claude row 不能扩大 complete catalog membership。
- same naked session id 跨 workspace 的 archive/folder/custom title 不碰撞。
- large payload 不进入 summary/cache；control-plane payload 不成为 first real user message。

## 5. 调用点审计

### Membership / Listing

- `src/services/tauri.ts`: `listClaudeSessions` 仍是 native history API；后续只允许 transcript/detail/diagnostic/fallback seed 使用。
- `src/services/tauri/sessionManagement.ts`: `listWorkspaceSessions` 是 workspace session catalog API，默认 membership truth 应来自这里。
- `src/features/threads/hooks/useThreadActions.ts`: 同时调用 catalog 与 native Claude；已开始改为 catalog 有 `sourceStatuses` 时由 catalog 决定 Claude membership。
- `src/features/threads/hooks/useThreadActionsSessionCatalog.ts`: active project catalog loader 已移除 exact `workspaceId` 二次 membership filter。
- `src/features/threads/hooks/useThreadActionsLoadOlder.ts`: older catalog loader 已移除 exact `workspaceId` 二次 membership filter。

### WorkspaceId 二次过滤风险

- 与 thread list 直接相关的 exact filter 已收敛到 display/runtime 逻辑；Sidebar 与 Session Management 都保留 catalog row owner/stable key。
- `WorkspaceHome` 当前不渲染 `recentThreads` 会话 membership；测试锁定其不能从 `recentThreads` 派生独立 session set。若后续重新展示会话，必须接入 `listWorkspaceSessions` active strict projection。
- 全仓大量 `workspaceId === ...` 属于其它 feature scope，不应机械替换；只处理 session membership path。

### Title Fallback

- `src/features/threads/utils/sessionDisplayProjection.ts` 已统一为 custom title > mapped title > native/first real user message > previous meaningful title > stable fallback，并避免弱 fallback 覆盖强标题。
- Sidebar catalog/Gemini/native merge、Settings list、Session Curtain 均接入同一个 display resolver 或 resolver 包装函数。
- Project aggregate 下的 catalog row 会优先用 row owner workspace 查询 custom title，再回退 selected workspace 旧 key，避免 child row rename 显示漂移。
- 后端 catalog 仍只产出 source title evidence，不写回低置信度 fallback。

### Folder / Archive / Stable Key

- `src-tauri/src/session_management_types.rs` 暴露 `stable_session_key`，metadata 写入已前进到 `engine:ownerWorkspaceId:canonicalSessionId`。
- `catalog_metadata_lookup_keys_for_entry` / `catalog_metadata_lookup_keys_for_session` 保留 legacy 裸 `sessionId` 读取兼容。
- Settings selection key 优先使用 stable key；mutation request 按 row owner workspace 分桶。
- Backend mutation result 返回 `ownerWorkspaceId` / `stableSessionKey`；前端 reconcile 优先使用返回 owner/stable key，避免 aggregate 操作后 selection cleanup 漂移。
- Backend cleanup target 保留 `catalog_metadata_lookup_keys_for_entry`，delete/unarchive/move 会清理 legacy 裸 key 与 stable key；新写入只写 stable key。

## 6. Source-Fact Cache Schema

建议 namespace：

```text
workspace-session-source-facts/v1/claude
```

建议 fingerprint：

```text
engine + physicalPath + fileMtime + fileSize + scannerVersion + schemaVersion + cacheNamespace
```

可缓存字段：

- `engine`
- `canonicalSessionId`
- `displaySessionId`
- `physicalPath`
- `fileMtime`
- `fileSize`
- `cwd`
- `claudeProjectDir`
- `parentSessionId`
- `firstRealUserMessage`
- `updatedAt`
- `messageCount`
- `titleEvidenceConfidence`
- `sourceDiagnostics`
- `scannerVersion`
- `schemaVersion`

禁止缓存为最终 truth：

- `ownerWorkspaceId`
- strict / related / global membership
- archive / folder / custom title overlay
- display window、selection、processing state
- full transcript body
- large inline media payload / base64 body
- `.omx/**` 或其它 local-only runtime state

cache 失败策略：

- hit: 返回 bounded facts，但仍重新执行 ownership resolver、metadata overlay、projection。
- miss/stale/schema mismatch: direct scan 后 best-effort write。
- corrupt/unavailable: direct scan，并暴露 degraded cache diagnostic；不能因此清空 listing。
- clear/rebuild: 删除 cache 后下一次 catalog refresh 能从 Claude JSONL 重建 facts。

## 7. 实现证据

- `openspec validate unify-claude-workspace-session-catalog --strict --no-interactive`
- `cargo test --manifest-path src-tauri/Cargo.toml scan_session_source_file -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml shared_attribution_resolver -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml source_fact_cache -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml session_management -- --nocapture`
- `npx vitest run src/services/tauri.test.ts src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.test.tsx src/features/settings/components/settings-view/sections/sessionManagementSectionUtils.test.ts src/features/threads/hooks/useThreadActions.helpers.test.ts src/features/threads/utils/sessionDisplayProjection.test.ts src/features/threads/hooks/useThreadActions.threadList.test.ts src/features/workspaces/components/WorkspaceHome.test.tsx`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `npm run typecheck -- --pretty false`
- `npm run check:runtime-contracts`

Trellis 长期约束已落库：

- `.trellis/spec/guides/workspace-session-catalog-contract.md`
- `.trellis/spec/guides/index.md`

## 8. Review 校准记录（2026-05-22）

人工 smoke：

- 用户验证右侧工作区会话外观与盲盒前近似，无明显视觉/交互回退。

本轮 review 修复：

- 大文件 hard gate：`src-tauri/src/engine/claude_history.rs` 拆出 `claude_history_inline_tests.rs`，`src-tauri/src/session_management.rs` 拆出 `session_management_catalog_projection.rs`；`check:large-files:gate` 从 2 个 hard fail 降为 0。
- Claude scanner 边界：JSONL 行读取错误（例如 invalid UTF-8）不再静默停止并返回 complete，而是产生 `unreadable-file` diagnostic，已有可用 fact 时标记 `partial`。
- Claude cache 边界：拿不到 `fileSize` 或 `fileMtime` 时不读写 source-fact cache，避免无法失效的 stale cache。
- Source completeness 边界：空结果若由 scan cap 导致，标记 `partial`；存在 unreadable diagnostic 时标记 `degraded`，不再被 `uncertain_empty` 覆盖。
- Frontend boundary mapping：`normalizeProjectCatalogSession` 对 optional string 做 trim / empty-to-null，并拒绝未知 `sourceCompleteness` enum，避免异常 payload 进入 UI 状态。

门禁补充：

- `npm run check:large-files:near-threshold` 仍有 watch 项：`session_management.rs`、`claude_history.rs` 等接近阈值，但无 hard fail。
- `npm run check:heavy-test-noise` 已跑完整 batched Vitest，531 个 test files 完成，只有既有 npm config warning，无 act/stdout/stderr payload noise。

## 9. Review 收紧记录（2026-05-23）

本轮问题：

- 后端 Claude history scanner 与前端 fallback loader 仍存在 keyword-only 风险：文本中只要包含 `codex app-server`，就可能被判为 control-plane，从而误吞正常 Claude Code 对话。
- Settings / Session Management 首批 catalog window 为 `100`，管理页容易被误判为“展示不全”；但 Sidebar 启动窗口不应同步放大。

本轮修复：

- Backend `is_codex_app_server_text` 改为 command-token 判断：只接受 `app-server` 单独文本，或 `codex/codex.exe/codex.cmd/codex.bat app-server` 这类纯命令形态。
- Frontend fallback `isCodexAppServerControlPlaneText` 使用同等 command-token 判断，保持 backend / legacy loader 口径一致。
- 正常自然语言 `Please inspect why codex app-server appears in logs.` 会保留为真实对话，不再被 control-plane filter 吞掉。
- `src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.ts` 的 Session Management catalog page size 从 `100` 调整为 `999`；Sidebar 的 `SESSION_CATALOG_PAGE_SIZE = 200` 保持不变。

验证证据：

- `pnpm vitest run src/features/threads/loaders/claudeHistoryLoader.test.ts src/features/settings/components/settings-view/hooks/useWorkspaceSessionCatalog.test.tsx src/features/settings/components/SettingsView.test.tsx`
  - 3 files / 84 tests passed
- `cargo test --manifest-path src-tauri/Cargo.toml claude_history -- --nocapture`
  - lib: 45 passed
  - daemon: 33 passed
