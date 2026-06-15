# Tasks / 任务

> 状态语义：
>
> - **Inventory / Contract**：提案阶段的审计与契约修正（已完成，作为提案 review 证据保留）。
> - **Implementation**：本次 change 的产品代码实施状态。
> - **Validation**：本次 change 的验证门状态。
>
> 本次 change 已落地 Step 0 (telemetry) / Step 1 (reducer fast path) / Step 2 (backend file I/O isolation) / Step 3 (Rust event sink batching) / Step 4 (Rust external change debouncer)。Step 3/4 的 frontend 消费与 Step 5 (React shell domain split) 列为 follow-up change `frontend-prop-chain-stability-2026-06`，不在本 change 的勾选项内（保持 [ ] 仅作 history 保留）。

## Inventory / 盘点

- [x] Audit `threadReducerCoreHelpers.ts`，确认 `appendAgentDelta` fast path 被 `threadId.startsWith("claude:")` 限制。
- [x] Audit `useThreadsReducer.ts` 与 `threadItems.ts`，确认 non-claude streaming slow path 会触发 `prepareThreadItems` 管线。
- [x] Audit `services/events.ts`，确认 `app-server-event` 未接入现有 `eventBackpressure`。
- [x] Audit `src-tauri/src/event_sink.rs`，确认 app server event 当前单事件 `app.emit`。
- [x] Audit `external_changes.rs`，确认真实问题是 single emit / no debounce；metadata path 使用 `tokio::fs::metadata`，不是同步 `std::fs::metadata/read_dir`。
- [x] Audit `workspaces_core.rs`，确认 workspace read/write/create/trash core helper 直接执行同步闭包。
- [x] Audit `workspaces/commands.rs`，确认 external spec / external absolute read-write、preview handle、copy/duplicate 等路径也要纳入 I/O 隔离范围。
- [x] Audit `app-shell.tsx` 与 `useAppShellLayoutNodesSection.tsx`，确认 shell context/options 过大，不能只靠巨型 `useMemo` 修复。
- [x] Audit `Sidebar.tsx` / `ThreadList.tsx`，确认无 virtualization，且 status map 变化可能扩大 row rerender。
- [x] Run `openspec validate 2026-06-realtime-input-and-io-isolation --strict --no-interactive` on original artifact，确认格式通过但 change id 不满足 `openspec status` 命名规则。

## Contract / 契约修正

- [x] 将本 change 的实施顺序改为 telemetry first。
- [x] 将 backend file I/O scope 扩展为完整 file command surface，而不是只列 workspace core helper。
- [x] 删除 `external_changes.rs std::fs::metadata/read_dir` 阻塞改造要求，改为 debounce/batch + frontend stale-drop。
- [x] 将 app server batching 从“batch 后逐个原 handler dispatch”改为 batch-aware route / coalesce / budgeted reducer flush。
- [x] 将 frontend prop chain 从“巨型 appShellContext useMemo + deps 白名单”改为 domain context / selector / scoped state。
- [x] 修正 Rust test 任务：使用 inline `#[cfg(test)] mod tests` 或现有 Rust test module，不写 `*.test.rs` / `*.test.ts` 形式的 Rust 测试文件。
- [x] 修正 feature flag 来源：Rust backend flag 必须来自 app settings / env / invoke contract，不来自 frontend `localStorage`。
- [x] 修正 evidence 指标：真实 file read/write wall time 不设 5ms p95，改测 async-worker stall、event delivery、command wall time。

## Implementation / 实施

### Step 0 — Telemetry / Evidence

- [x] 增加 streaming 期间 input latency / long task / event route / reducer dispatch / Tauri command duration 的 evidence 字段。
- [x] 增加 `prepareThreadItems_calls_per_1000_delta`、`thread_reducer_flush_ms_p95`、`realtime_delta_route_ms_p95`。
- [x] 增加 `file_io_command_wall_ms_p95`、`file_io_async_worker_stall_ms_p95`、`file_io_blocking_pool_call_count`。
- [x] 增加 `app_server_event_raw_per_sec`、`app_server_event_ipc_emit_per_sec`、`app_server_event_route_ms_p95`。
- [x] 增加 `fs_event_raw_per_sec`、`fs_event_emitted_per_sec`、`file_refresh_queue_depth_max`、`file_refresh_stale_drop_count`。
- [x] 增加 `composer_render_count_per_streaming_minute`、`sidebar_render_count_per_streaming_minute`、`thread_row_rerender_count_per_1000_delta`、`layout_nodes_recompute_count_per_1000_delta`。

### Step 1 — `realtime-input-render-budget`

- [x] 修改 `src/features/threads/hooks/threadReducerCoreHelpers.ts`，移除 `canUseLiveAssistantDeltaFastPath` 的 `threadId.startsWith("claude:")` 条件。
- [x] 保持 `appendAgentDelta` slow path 对 final metadata、canonicalize、non-tail/reorder 场景可达。
- [x] 新增/扩展 Vitest：claude/codex/gemini/opencode tail delta fast path 等价性。
- [x] 新增/扩展 Vitest：reasoning interleaving、tool interleaving、generated image anchor、completeAgentMessage slow path。

### Step 2 — `backend-file-io-isolation`

- [x] 在 `src-tauri/src/shared/workspaces_core.rs` 增加统一 `run_blocking_file_io` helper，或等价地集中封装 `tokio::task::spawn_blocking`。
- [x] 改造 `read_workspace_file_core` / `write_workspace_file_core` / `create_workspace_directory_core` / `trash_workspace_item_core`。
- [x] 改造 `read_workspace_file_preview` / `resolve_file_preview_handle` 涉及的本地同步 I/O 路径。
- [x] 改造 `read_external_spec_file` / `read_external_absolute_file`。
- [x] 改造 `write_external_spec_file` / `write_external_absolute_file`。
- [x] 改造 `copy_workspace_item` / `duplicate_workspace_item` / `paste_workspace_item` / `rename_workspace_item` / `paste_external_workspace_items` 同步 I/O (本轮校准补全 paste/rename/external paste core)。
- [x] 添加 Rust inline `#[cfg(test)]` 覆盖 helper error propagation / panic JoinError 转换 / command path 调用 blocking helper。

### Step 3 — `app-server-event-batching`

- [x] 在 `src-tauri/src/event_sink.rs` 增加 batch sink 或改造 `TauriEventSink`，按 workspace/session key 缓冲 `AppServerEvent`。
- [x] 使用保序结构保存 batch 内 arrival order；禁止用 `BTreeMap` 证明到达顺序。
- [x] 定义 backend runtime config 来源：app setting / env / invoke，不使用 frontend `localStorage`。
- [x] 新增 `app-server-event-batch` channel，同时保留 single channel fallback。
- [x] 设计 event id 或 consumer mode，避免 batch + single 过渡期重复处理。
- [x] 修改 `src/services/events.ts`，新增 batch subscription 与 event hub/backpressure 接入 (frontend consumer 仍走 follow-up change)。
- [x] 修改 `src/features/app/hooks/useAppServerEvents.ts`，实现 batch-aware route：coalesce、budgeted flush、diagnostics 降频。
  > 已在 follow-up change `frontend-prop-chain-stability-2026-06` 完成：新增 `dispatchAppServerEventBatch`，对连续状态快照事件 latest-wins coalesce，并按 FIFO chunk 切片调度，避免大 batch tight loop 和连续 batch interleaving。
- [x] 修改 `useThreadItemEvents` 或相邻 realtime buffer，使 batch delta 不退化成 N 次同步 reducer dispatch。
  > 已在 follow-up change `frontend-prop-chain-stability-2026-06` 完成：batch route 保留 append-only delta，不做 latest-wins；delta 仍进入既有 realtime buffer / fast reducer path。
- [x] 添加 Rust inline `#[cfg(test)]` 覆盖 flush、ordering、fallback、terminal flush。
  > 新增/扩展 `event_sink.rs` tests：per-workspace arrival order、single workspace burst、per-workspace drain isolation、terminal workspace flush、batch env fallback parser。
- [x] 添加 Vitest 覆盖 batch route 不丢、不重、不重复 diagnostics。
  > 已在 `useAppServerEvents.batch-consumer.test.tsx` 覆盖 delta 不合并、状态快照合并、控制事件按序 FIFO chunk dispatch、连续 batch 不 interleave、互斥订阅。

### Step 4 — `file-change-event-debounce`

- [x] 在 `src-tauri/src/workspaces/external_changes.rs` 增加 per-path debounce/batch emitter (`DebouncedExternalChangeEmitter` + 100ms 窗口)。
- [x] 使用 `VecDeque + HashMap<key,index>` 或 sequence number 保序；不要声称 `HashMap` / `BTreeMap` 保 arrival order。
- [x] 新增 `detached-external-file-change-batch` channel，保留 single channel fallback。
- [x] 确保 frontend consumer 只选择 batch 或 single 一条主路径，避免重复 refresh。
  > 已在 follow-up change `frontend-prop-chain-stability-2026-06` 完成。
- [x] 修改 `src/services/events.ts`，新增 detached external file change batch subscription (frontend consumer 仍走 follow-up change)。
- [x] 修改 `src/features/files/hooks/useFileExternalSync.ts`，batch 内合并、in-flight coalesce、generation stale-drop。
  > 已在 follow-up change `frontend-prop-chain-stability-2026-06` 完成：batch 入口按 `(workspaceId, normalizedPath)` latest-wins coalesce 后进入既有 in-flight / stale-drop path。
- [x] 添加 Rust inline `#[cfg(test)]` 覆盖 same-path coalesce、cross-path delivery、ordering、no empty emit (4 tests added in `external_changes.rs`)。
- [x] 添加 Vitest 覆盖 stale refresh 不覆盖 dirty/local newer state。
  > 已在 follow-up change `frontend-prop-chain-stability-2026-06` 补充：`useFileExternalSync.test.tsx` 覆盖 in-flight refresh late resolve 时不覆盖 dirty local content，并将 disk snapshot 提升为 conflict。

### Step 5 — `frontend-prop-chain-stability`

- [x] 拆分 `appShellContext` 为 runtime/thread/workspace/composer/layout/file/settings 等 domain inputs。
  > follow-up 已完成：`app-shell.tsx` 生产侧 6 域 object、section hook structured input、`renderAppShell` structured input，以及 `useLayoutNodes` grouped options 入口。
- [x] 缩小 `useAppShellLayoutNodesSection` 传给 `useLayoutNodes` 的 options 面；必要对象用完整 deps `useMemo`。
  > 已在 follow-up change `frontend-prop-chain-stability-2026-06` 完成：`useLayoutNodes` 外部入口改为 grouped options，生产调用按 `workspace` / `runtime` / `chrome` / `editor` / `git` / `composer` / `panels` 分组；内部保留 flat adapter 作为过渡层。
- [x] 将 streaming 高频状态从无关 module 的 props 中移除，改为局部 selector/subscription。
  > 本轮收口完成：`ThreadList` / `PinnedThreadList` 共用 `ThreadRowStatusProvider` + `useThreadRowStatus(threadId)` / `useSyncExternalStore`，row badge/status 不再因无关 thread status 更新重渲；保留 `Sidebar` / `WorktreeSection` 的 section-level `threadStatusById` 聚合，仅用于 running/exited toggle 等必要语义，避免另建缓存造成漂移或额外扫描。
- [x] 收窄 Sidebar/ThreadList 的 `threadStatusById` 传播，优先传 row-level status 或 scoped selector。
  > 已在 follow-up change `frontend-prop-chain-stability-2026-06` 完成：`ThreadList.tsx` 新增 `useThreadRowStatus(threadId)` + row-local external store；`ThreadList.test.tsx` 覆盖 1000 次 unrelated status update 后 target row commit count 仍为 1。
- [x] 检查 `useAppShellSearchAndComposerSection` callback 稳定性，所有 `useCallback` 遵守 exhaustive-deps，不使用人为漏依赖白名单。
  > 收口验证通过：`npm run lint` 通过，目标文件未发现 `eslint-disable` / `exhaustive-deps` 白名单压制。
- [x] 用 evidence 判断是否需要后续单独开 Sidebar virtualization / Composer split change。
  > 本轮判断：`docs/perf/runtime-evidence-gates.json` 中 `frontendPropChainStabilitySummary.evidenceClass` 仍为 `unsupported`，且 `docs/perf/realtime-profile.jsonl` 尚未产出；因此本 change 不引入 Sidebar virtualization，不声称 Composer split 已无需推进。后续决策必须先补 measured/proxy profile artifact；Composer 拆分继续由 active change `composer-and-message-row-render-budget` 承接，Sidebar virtualization 仅在 `thread_row_rerender_count_per_1000_delta` 或实测滚动/切换证据超预算时单开。

## Validation / 验证

- [x] `openspec validate realtime-input-and-io-isolation-2026-06 --strict --no-interactive`
- [x] `npm run check:runtime-evidence-gates`
- [x] `npm run perf:realtime:boundary-guard`
- [x] `npm run perf:realtime:extended-baseline`
- [x] targeted Vitest: reducer fast path (8 tests pass) + app-server batch consumer / budgeted route + file external batch coalesce targeted tests pass; shell render evidence 留 follow-up change。
- [x] targeted Rust tests: external change debounce (4 inline tests pass); event sink batch/flush/fallback (5 inline tests pass); `paste_external_workspace_items_core` blocking helper probe passes。
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm run test`

## Rollback / 回滚

- Revert Step 1 by restoring `threadId.startsWith("claude:")`.
- Disable backend file I/O helper through direct command path rollback if helper causes behavior mismatch.
- Disable app server batch via backend config and fall back to single `app-server-event`.
- Disable file change batch via backend config and fall back to single `detached-external-file-change`.
- Revert frontend shell context split by domain, because each domain split must be committed separately.
