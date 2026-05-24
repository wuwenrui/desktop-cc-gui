## Context

`refactor-workspace-session-management` 与 `unify-claude-workspace-session-catalog` 已经把 session catalog 推向 disk-first、owner-aware、source-fact cache 与 shared projection，但当前代码仍暴露出几处边界松动：

- `useThreadActionsSessionCatalog.ts` 的 `loadArchivedSessionMap` 会用 `status: "all"` 翻完整个 catalog，且失败时直接返回 `null`，导致 archived evidence 不可解释。
- `session_management.rs` 的 `build_success_source_status` 在非空 bounded scan 时直接返回 `Complete`，即使 `scanCapReached` 已经为 true。
- `useWorkspaceSessionCatalog.ts` 对 related project source 仍有 `query.engine !== "codex"` 的前端过滤；后端入口也以 `list_project_related_codex_sessions_core` 命名和实现为 Codex-only。
- catalog cursor 仍是 `offset:<n>`，而排序基于 `updatedAt desc + sessionId + workspaceId`；分页期间新增或更新时间变化可能让 offset cursor 跳过或重复。
- `hasHealthyThreadSummaries` 用整列表 health 判定，任一 thread degraded 都会阻止整列表成为 last-good。
- batch folder assignment 已有 per-entry result 类型，但跨 owner workspace 的 metadata mutation 仍可能在 owner group 失败时放大为 request-level error。
- Settings catalog hook 请求 `999`，backend cap 为 `200`；没有把 cap 截断解释给 UI。

这不是一个 UI bug，而是 source truth、metadata overlay、pagination、continuity 的 contract 没完全闭合。

## Goals / Non-Goals

**Goals:**

- 让 source completeness 与 scan cap 语义保守：无法证明完整时绝不返回 authoritative `Complete`。
- 让 archived evidence 有界且状态可见：失败必须成为 degraded evidence，而不是静默 `null`。
- 让 related sessions engine-neutral：Claude/Codex/OpenCode/Gemini 的 inferred related entries 走同一 contract。
- 让 pagination cursor 稳定：cursor chain 不因新增 session 或排序漂移出现跳页/重复。
- 让 last-good continuity 按 engine/source 更新：一个 engine degraded 不污染其它 engine 的健康快照。
- 让 batch mutation 部分失败可恢复：跨 owner workspace 时按 entry 返回成功/失败。
- 让 frontend page-size 与 backend cap 对齐：cap 截断必须可见或可继续分页。

**Non-Goals:**

- 不重写所有 session parser。
- 不引入数据库、daemon、watcher 或长期后台索引。
- 不改变 strict / related / global 的 membership 语义。
- 不做 Settings 会话管理 UI 重新设计。
- 不改聊天 runtime、resume 或 transcript loading 主链路。

## Decisions

### Decision 1: Source status 由 backend 保守生成

Backend `WorkspaceSessionCatalogSourceStatus` 是 completeness truth。`scanCapReached === true`、bounded scan 未能证明无更多候选、cache unavailable、archive evidence failure、timeout/error 都 MUST 输出 `partial` / `degraded` / `uncertain_empty` 或等价非权威状态。

替代方案：让 frontend 看到 `scanCapReached` 后自行降级。
放弃原因：每个 surface 都会重复推断，而且旧 surface 很容易漏掉字段。

### Decision 2: Archived evidence 不再做 silent null

Sidebar 需要 archived map 来过滤 continuity rows，但这条链路不能无界翻页，也不能失败后让 archived row 复活。实现上应优先复用 active projection response 的 source statuses；如果需要 archived evidence，必须：

- 使用 bounded request 或 backend-provided archive evidence；
- 返回 `{map, status}` 或等价结构；
- 失败时标记 degraded，并禁止把失败解释为“没有 archived rows”。

替代方案：保留当前全量翻页，只加 timeout。
放弃原因：timeout 只能止血，仍无法证明 archived evidence 的完整性。

### Decision 3: Related surface 走 engine-neutral projection

`related` 应是 scope/projection 类型，不应是 Codex-only source。后端可以保留旧 Codex helper 作为内部兼容，但对外 contract 应返回 engine-neutral entries，并用 owner evidence 标明 inferred attribution。

替代方案：继续只支持 Codex related，并在 UI 隐藏其它 engine。
放弃原因：主 spec 已要求 project related sessions 独立 surface；Codex-only 会让 Claude 相关会话在管理页不可解释。

### Decision 4: Cursor 从 offset 升级为稳定 continuation token

新的 cursor 应包含排序 anchor，例如 `{updatedAt, sessionId, workspaceId, stableSessionKey}` 的 opaque/base64 token，或等价稳定 continuation。下一页基于 anchor 比较而不是 mutable offset skip。

替代方案：继续 offset，并在 refresh 时重新加载第一页。
放弃原因：大历史和频繁新增 session 下仍会跳页/重复，无法满足真实分页 contract。

### Decision 5: Last-good health 按 engine/source 维护

当前 `hasHealthyThreadSummaries` 拒绝任一 degraded thread，这适合防自污染，但会牺牲健康 engine 的快照更新。新设计应提供 engine-aware snapshot health：Claude degraded 不阻止 OpenCode/Codex/Gemini 保存健康 last-good。

替代方案：保留整列表 health。
放弃原因：这会让一个 engine 的短暂异常扩大成整个 sidebar continuity 的状态污染。

### Decision 6: Batch mutation 失败降级到 entry 结果

跨 owner workspace folder assignment、archive、delete 这类批量操作必须尽量完成可成功项。owner group metadata 写入失败时，该 group 的 entries 返回 failure；其它 group success 仍提交并更新 UI。

替代方案：任何 owner group 失败就让整个 request error。
放弃原因：用户无法区分哪些会话已移动、哪些需要重试，容易造成 UI 与 metadata drift。

### Decision 7: Page-size cap 必须成为 contract 字段或 degraded evidence

Settings 可以请求更大的管理窗口，但 backend cap 为保护性能存在。若 requested limit > actual limit，response MUST 让 frontend 知道 actual limit / cap reached / next cursor，UI 不能把当前页误认为完整全量。

替代方案：frontend 把 `999` 改成 `200`。
放弃原因：只能消除不一致，不能解释过滤后还有更多数据的事实。

## Risks / Trade-offs

- **Risk: stable cursor 与现有 offset cursor 不兼容** → Mitigation: backend 同时接受旧 offset cursor，返回新 opaque cursor；旧 cursor 仅作兼容入口。
- **Risk: more degraded markers may make UI look less “clean”** → Mitigation: 只在 source incomplete、cap 或 evidence failure 时展示短提示；healthy path 不增加噪音。
- **Risk: engine-neutral related surface scope 变宽** → Mitigation: strict surface 不变；related entries 必须带 inferred evidence，mutation 仍按真实 owner routing。
- **Risk: per-engine last-good 增加 hook 状态复杂度** → Mitigation: 抽 helper，测试只覆盖 engine health、seed 与 cleanup，不扩大 UI snapshot。
- **Risk: partial mutation result 与现有错误 toast 冲突** → Mitigation: 保持 request-level error 仅用于请求不可执行；业务失败进入 result list。

## Migration Plan

1. Backend 先修 source status 与 cursor response，保持字段 additive。
2. Tauri service mapping 接收新增 cap/cursor/status 字段，旧字段继续保留。
3. Frontend hooks 消费新的 source status，不再把 missing evidence 当 empty truth。
4. Related surface 先支持 Codex + Claude，保留其它 engine 的 graceful degraded/unsupported reason，再扩展 OpenCode/Gemini。
5. Batch mutation 改为 per-entry result 后，UI 只移除 success entries，failure entries 保留选中态。
6. 验证通过后再同步 main specs / archive。

Rollback：所有新增字段为 additive；若 stable cursor 有问题，backend 可继续接受 offset cursor 并临时返回 offset-style next cursor，同时保留 degraded marker。

## Implementation Notes - 2026-05-23

- P1 source status 选择最小修复：`scanCapReached` 会把 bounded non-empty success 从 `Complete` 降为 `Partial`，并通过 normalization 防止 capped source 被重新抬升为 authoritative complete。
- Archived evidence 选择单独 bounded helper：`list_workspace_session_archive_evidence` 只读取 session-management metadata，不扫描完整 catalog；metadata 读失败返回 `archive-metadata-unavailable` degraded status。
- Sidebar 只消费 evidence：archive evidence timeout/error 返回 explicit partial source；最终 visible list 统一过滤 archived 与 pending，避免 degraded continuity 或 last-good seed 复活不可展示 row。
- Related sessions 对外改为 engine-neutral `list_project_related_sessions`；旧 `list_project_related_codex_sessions` 保留为兼容入口并复用新 core。
- Review hardening: archive evidence 与 related projection 拆到 `session_management_archive_evidence.rs` / `session_management_related.rs`，让 `session_management.rs` 回落到 large-file hard gate 以内。
- Archive evidence completeness 现在要求至少一个 source status；空或缺失 `sourceStatuses` 只能作为 incomplete evidence，不能被 `every()` vacuous truth 误判为完整。
- P2 stable cursor 使用 base64 opaque token，编码 ordering anchor、stable session key、workspace、query fingerprint 与 offset hint；旧 `offset:` cursor 仅作为兼容输入。
- Sidebar last-good 改为 per-engine snapshot：Claude degraded 不再阻止健康 Codex/OpenCode/Gemini snapshot 更新；seed 仍经过 archived/hidden/pending retainable 过滤。
- Session Management page response 暴露 `requestedLimit`、`effectiveLimit` 与 `limitCapped`，Settings UI 在 backend cap 截断时展示继续加载提示。
- Batch mutation owner-group metadata failures 降级为 per-entry failure；request-level error 继续保留给 workspace 缺失、请求不可解析等全局前置条件失败。
- Large-file hardening: batch folder assignment 拆到 `session_management_batch_assign.rs`，`session_management.rs` 保持在 hard gate 下方。

## Open Questions

- archived evidence 最终应由 active catalog response 携带，还是单独新增 bounded archive evidence endpoint。
