# Design / 设计

## 0. Design Principles

本 change 的设计原则是 **evidence first, isolate second, refactor last**。

- 先记录 input latency、event route cost、reducer flush cost、Tauri command duration、file refresh queue depth。
- 再切断 source event、blocking I/O、React prop chain 三条传播链。
- 最后才做组件拆分或 virtualization，避免在无证据状态下大改 UI。

所有 feature flag 必须有明确来源。Frontend `localStorage` 只能控制 webview 行为；Rust backend flag 必须来自 app settings、env、或者显式 invoke/update contract，不能假设 Rust 能读取 `ccgui.perf.*` localStorage。

## 1. `realtime-input-render-budget`

### 1.1 目标

解除 `appendAgentDelta` fast path 的 `claude:` 前缀限制，让 codex/gemini/opencode 在满足“末尾 assistant delta、无需 canonicalize、无需 final metadata”的条件下跳过 `prepareThreadItems`。

### 1.2 契约

`canUseLiveAssistantDeltaFastPath` 保留这些必要条件：

```typescript
return (
  INCREMENTAL_DERIVATION_ENABLED &&
  index === list.length - 1 &&
  !shouldCanonicalizeLegacyId &&
  !keepFinalMetadata
);
```

移除的仅是 `threadId.startsWith("claude:")`。slow path 仍负责：

- final message completion
- legacy id canonicalize
- keep final metadata
- non-tail insert/reorder
- tool/reasoning/image anchor 等需要重新派生的场景

### 1.3 测试矩阵

- claude/codex/gemini/opencode 四类 thread id 的 tail delta fast path。
- `completeAgentMessage` / final metadata / canonicalize 仍走 slow path。
- reasoning + assistant interleaving 不改变 item 顺序。
- generated image anchor 不因跳过 `prepareThreadItems` 丢失。
- 1000-delta fixture 中 `prepareThreadItems` 调用次数只允许出现在 terminal/reorder 场景。

### 1.4 Evidence

新增或复用 runtime evidence 字段：

- `prepareThreadItems_calls_per_1000_delta`
- `thread_reducer_flush_ms_p95`
- `realtime_delta_route_ms_p95`

## 2. `backend-file-io-isolation`

### 2.1 目标

把 local file command surface 中的同步 `std::fs` 工作移出 async runtime worker。这里关注的是 workspace/external file commands，不把 `external_changes.rs` 已经使用 `tokio::fs::metadata` 的 signature path 错判为 blocking I/O。

### 2.2 覆盖范围

必须审计并覆盖：

- `read_workspace_file`
- `read_workspace_file_preview`
- `resolve_file_preview_handle`
- `write_workspace_file`
- `create_workspace_directory`
- `trash_workspace_item`
- `copy_workspace_item`
- `duplicate_workspace_item`
- `read_external_spec_file`
- `read_external_absolute_file`
- `write_external_spec_file`
- `write_external_absolute_file`

实施时可以选择两种方式之一：

1. 在 `workspaces_core` 增加统一 blocking helper，并让 workspace core helper 调用它。
2. 对不经过 core helper 的 external spec / absolute path command，直接包 `tokio::task::spawn_blocking` 或抽到同一个 helper。

### 2.3 Helper 契约

建议新增轻量 helper，而不是复制 `.await.map_err(...)`：

```rust
async fn run_blocking_file_io<T, F>(operation_name: &'static str, file_io: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tokio::task::spawn_blocking(file_io)
        .await
        .map_err(|error| format!("{operation_name} file I/O task failed: {error}"))?
}
```

要求：

- 不在 async worker 上执行 `File::open` / `read_to_end` / `std::fs::write` / `copy` / `rename` / `remove` 等同步 I/O。
- `JoinError` 转为 `Err(String)`，不污染 runtime。
- command 的原有 error shape 尽量保持，避免前端错误处理断裂。
- 大文件 read/write 的 wall time 不要求小于 5ms；5ms 级指标只能用于 async-worker stall 或 event delivery delay。

### 2.4 Evidence

不要使用 `file_io_blocking_ms_p95 <= 5ms` 表示真实文件读取耗时，这个指标不现实。改为：

- `file_io_command_wall_ms_p95`
- `file_io_async_worker_stall_ms_p95`
- `file_io_blocking_pool_call_count`
- `tauri_command_during_stream_ms_p95`

## 3. `file-change-event-debounce`

### 3.1 目标

在 watcher emit 端合并重复 file change event，并在前端 file refresh 端防止旧 refresh 覆盖新内容。

### 3.2 Rust debounce 契约

按 `(workspace_id, normalized_path)` 合并，100ms 窗口内同 key 只保留最新事件。跨 path 事件必须全部保留。

顺序要求：

- 不能用普通 `HashMap` 或 `BTreeMap` 声称保持 arrival order。
- 如果需要保序，使用 `VecDeque` 记录 arrival order，并用 `HashMap<key, index>` 更新同 key 的最新事件；或者给 event 分配 monotonic sequence number 后 flush 时排序。
- 不引入新依赖，除非后续实现能证明 `indexmap` 的必要性。

兼容要求：

- batch channel: `detached-external-file-change-batch`
- single channel: `detached-external-file-change`
- 运行时只能选择 batch 或 single 作为主路径，避免 batch 和 single 同时被同一 consumer 处理造成重复 refresh。

### 3.3 Frontend refresh 契约

`useFileExternalSync` 已经有 in-flight/queued refresh 保护，实施时还需要补：

- batch handler 先按 path 合并，再触发 refresh。
- refresh 带 generation/sourceVersion，旧 refresh 完成后如果已过期必须 stale-drop。
- 单文件编辑态不能被外部旧快照覆盖本地 dirty 内容。

### 3.4 Evidence

- `fs_event_raw_per_sec`
- `fs_event_emitted_per_sec`
- `file_refresh_queue_depth_max`
- `file_refresh_stale_drop_count`

## 4. `app-server-event-batching`

### 4.1 目标

减少 Tauri IPC emit 数量，并降低 webview route/reducer 同步压力。Rust batch 后，frontend 必须 batch-aware；简单 `forEach(event => originalHandler(event))` 只能减少 IPC，不能解决 JS route/reducer 卡顿。

### 4.2 Rust event sink 契约

- 新增 batch channel: `app-server-event-batch`
- 保留 single channel: `app-server-event`
- 按 workspace 或 session key 分桶。
- flush interval 建议 32-50ms。
- batch 内同一 workspace 的 arrival order 必须保持。
- terminal/turn boundary 类事件可以触发立即 flush，但不能 double emit。

数据结构建议：

- `VecDeque<AppServerEvent>` 保序。
- 如果需要按 workspace 分桶，用 `HashMap<WorkspaceKey, VecDeque<AppServerEvent>>`。
- 不用 `BTreeMap` 证明 arrival order；它按 key 排序，不按到达顺序排序。

### 4.3 Feature Flag / Compatibility

Rust backend flag 来源必须明确：

- app setting persisted in backend state
- env var for tests/dev
- frontend invoke 更新 backend runtime config

禁止把 backend 行为写成读取 `localStorage`。

兼容策略：

- 默认新 consumer 优先 batch channel。
- single channel 只作为 fallback。
- 不允许 batch + single 同时被同一 frontend consumer 处理同一事件；过渡期如需双 emit，必须带 event id 或 consumer mode 防重复。

### 4.4 Frontend batch-aware route

`useAppServerEvents` 需要提供 batch route，而不是简单同步循环：

- 先按 thread/session/workspace 合并可合并事件。
- delta 类事件进入现有 realtime buffer，但 flush 必须有 frame budget。
- diagnostics/logging 不能对 batch 内每个 raw event 都同步重算全量统计。
- reducer dispatch 应按 batch 或 normalized ops flush，避免 N 个事件 N 次 React commit。

### 4.5 Evidence

- `app_server_event_raw_per_sec`
- `app_server_event_ipc_emit_per_sec`
- `app_server_event_route_ms_p95`
- `realtime_reducer_dispatches_per_1000_delta`
- `main_thread_long_task_count_during_stream`

## 5. `frontend-prop-chain-stability`

### 5.1 目标

降低 streaming state 对无关 UI 区域的传播。重点不是“把一个巨大的 object 包 useMemo”，而是把 shell context 按职责拆开，让高频状态只被真正需要的组件订阅。

### 5.2 禁止的修法

不要做：

```typescript
const appShellContext = useMemo(() => ({ ...hundredsOfFields }), [
  activeWorkspace?.id,
  activeThreadId,
]);
```

原因：

- deps 白名单极易漏依赖，产生 stale closure / stale data。
- 巨型 context 即使引用稳定，也会继续把不相关 domain 绑在一起。
- React exhaustive-deps 无法可靠保护一个“刻意漏对象依赖”的大 memo。

### 5.3 推荐拆分

把 `appShellContext` 拆成多个 domain object 或 hook input：

- `runtimeThreadContext`
- `workspaceNavigationContext`
- `composerContext`
- `layoutContext`
- `fileEditorContext`
- `settingsContext`

原则：

- 高频 streaming 状态只进入 runtime/message/composer 相关 context。
- Sidebar/ThreadList 通过 selector 订阅当前 workspace/thread 需要的状态，而不是整张 `threadStatusById` map。
- `useLayoutNodes` options 可以 memo，但 deps 必须完整；更好的方向是减少 options 大小。
- callback 稳定化以 exhaustive-deps 为准，不用人为白名单压 lint。

### 5.4 Sidebar / ThreadList

本 change 不强制实现 virtualization，但必须收窄 rerender 面：

- `ThreadRowItem` 已经 memo，继续保证 row props 是 per-row stable。
- 避免把全局 `threadStatusById` 作为每个 row 的变化源；改为 row-level status lookup 或 scoped selector。
- virtualization 可作为后续 change，但本 change 要留下 evidence 判断是否必须做。

### 5.5 Evidence

- `composer_render_count_per_streaming_minute`
- `sidebar_render_count_per_streaming_minute`
- `thread_row_rerender_count_per_1000_delta`
- `layout_nodes_recompute_count_per_1000_delta`

## 6. 实施顺序

1. **Telemetry first**：补齐 evidence 字段，能复现 streaming + typing/open file/switch module。
2. **Reducer hot path**：解除 non-claude fast path 限制并加等价性测试。
3. **Backend I/O isolation**：覆盖完整 local file command surface。
4. **App server batch-aware route**：Rust batch + frontend coalesce/budgeted flush 一起落。
5. **File watcher debounce**：Rust emit debounce + frontend stale-drop。
6. **React shell isolation**：domain context / selector / scoped state，最后用 evidence 决定是否开 Sidebar virtualization / Composer split 后续 change。

## 7. 验证清单

- `openspec validate realtime-input-and-io-isolation-2026-06 --strict --no-interactive`
- reducer fast path targeted Vitest
- `useAppServerEvents` batch route/coalesce tests
- file external sync stale-drop tests
- Rust inline `#[cfg(test)]` tests for event sink batching and file I/O helper
- runtime evidence gates: `npm run check:runtime-evidence-gates`
- realtime perf gates: `npm run perf:realtime:boundary-guard` and `npm run perf:realtime:extended-baseline`
- `npm run typecheck`
- `npm run lint`
