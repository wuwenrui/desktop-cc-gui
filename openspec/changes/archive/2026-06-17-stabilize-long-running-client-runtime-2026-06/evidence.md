# Long-Running Client Runtime Evidence (Phase 5.1)

> 每个 `S-LR-*` metric 都标注 evidence class 与 source path。
> proxy 数据来自 jsdom 单测 / fixture / 静态计数;release-grade measured 数据需要在真实 Tauri/WebView trace 里采集(`task 5.4`, currently deferred)。

## S-LR-100 / activeEngineProcessCountAfterClose

- **Source**: `src-tauri/src/engine/commands.rs::get_engine_active_process_diagnostics` + `src-tauri/src/engine/commands_tests.rs`
- **Evidence class**: `measured` (command 返回 registered count); OS liveness 单独走 S-LR-101
- **Validation**:
  - `cargo test --manifest-path src-tauri/Cargo.toml engine_active_process_diagnostics --lib` passed
  - `cargo test --manifest-path src-tauri/Cargo.toml stale_child_candidates_respect_registered_age_threshold --lib` passed
- **Value in this change**: 命令已能聚合 Claude + OpenCode + Gemini 的 registered active count;`total_active_process_count` 是 registered handle 计数,**不等价于** OS 进程退出
- **Resolution**: 关闭 workspace 后,registered count 归零是命令级 measured evidence;但**不能**宣称 OS 进程已退出

## S-LR-101 / sampledOsChildLivenessAfterClose

- **Source**: `EngineActiveProcessDiagnostics.os_child_liveness` 字段
- **Evidence class**: `unsupported`
- **Rationale**: 仓库**没有**跨平台 OS process sampler(no `/proc` reader, no `ps` binding, no Windows API helper)。`os_child_liveness.evidence_class = "unsupported"`,`rationale` 字段给出 bounded explanation
- **Validation**: `commands_tests.rs` 中 `engine_active_process_diagnostics_records_stale_candidates_separately_from_os_liveness` 测试断言 `os_child_liveness.evidence_class == "unsupported"` 且 `rationale.is_some()`

## S-LR-110 / staleEngineChildCandidateCount

- **Source**: `EngineActiveProcessDiagnostics.stale_child_candidates` 数组
- **Evidence class**: `measured` (registry walk + registered-age threshold),progress metadata 缺失的 engine 标 `progress_evidence=unsupported`
- **Validation**:
  - `commands_tests.rs::engine_active_process_diagnostics_records_stale_candidates_separately_from_os_liveness` 验证 stale candidate 与 OS liveness evidence 分离
  - `commands_tests.rs::stale_child_candidates_respect_registered_age_threshold` 验证未满 5min 不报 candidate,达到阈值才报 candidate
- **Reconciler 行为**: diagnostics-only,never auto-kills

## S-LR-200 / moduleSwitchP95Ms

- **Source**: not measured in this change
- **Evidence class**: `unsupported` (jsdom 不能产生真实 module switch latency)
- **Rationale**: 仓库没有跨 jsdom 的 module switch measurement harness;真值需 Tauri/WebView trace
- **Follow-up**: `bash scripts/perf-reproduce-jank.sh` 15-30min trace

## S-LR-210 / visibleListRowCount

- **Source**: `src/features/home/components/HomeChatVirtualization.ts` + `src/features/app/components/sidebarVirtualItems.ts` + `src/features/app/components/ThreadList.tsx` + `src/styles/home-chat.css` + `src/styles/sidebar.css`
- **Evidence class**: `proxy` (jsdom 单测断言);jsdom-level perf baseline 单独跑 `npm run perf:long-list:baseline`
- **Validation**:
  - `HomeChat.test.tsx` 200 workspace 测试断言 `data-virtualized="true"` + `home-chat-workspace-picker-virtual-spacer` 出现 + DOM mounted `.home-chat-workspace-picker-item` 数量 < 200
  - `ThreadList.test.tsx` 200 thread 测试断言 `data-virtualized="true"` + `thread-list-virtual-spacer` 出现 + DOM mounted `.thread-row` 数量 < 200
  - `sidebarVirtualItems.test.ts` 验证 200 row 混合节点 flatten 后 keys 全 unique 且非 index
- **Threshold**: `HOME_CHAT_WORKSPACE_VIRTUALIZATION_MIN_ROWS = 100` 和 `SIDEBAR_LIST_VIRTUALIZATION_MIN_ROWS = 100`
- **Bound**: `SidebarVirtualItem` count >= 100 才启用;row key 必须为 `${workspaceId}:${thread.id}` / `pinned:${workspaceId}:${thread.id}` domain key 形式;virtual spacer/row CSS uses relative/absolute positioning with bounded scroll viewport
- **Perf baseline** (jsdom proxy,run 2026-06-16):
  - `S-LL-200` commit p50 = 9.66 ms, p95 = 9.66 ms, first paint = 35.43 ms
  - `S-LL-500` commit p50 = 13.02 ms, p95 = 13.02 ms, first paint = 32.73 ms
  - `S-LL-1000` commit p50 = 18.13 ms(partial, see `docs/perf/long-list-baseline.json`)
  - 完整数据写在 `docs/perf/long-list-baseline.json`

## S-LR-300 / markdownWorkerPendingRequests

- **Source**: `src/features/markdown/fastMarkdownRenderer/workerAdapterDiagnostics.ts` + `workerAdapter.ts` + `fastMarkdown.worker.ts` + `hookDiagnostics.ts`
- **Evidence class**: `proxy`
- **Validation**: `workerAdapterDiagnostics.test.ts` 验证 `pendingRequestCount == 0` after `disposeFastMarkdownWorker()`;fallback 计数 ≥ 1 when worker not available
- **Request metadata**: worker request now carries content-safe `requestMeta` (`requestId`, `documentKey`, `contentHash`, `optionsHash`, `schemaVersion`, `createdAtMs`)
- **Hook-level stale drop**: exported `getFastMarkdownHookDiagnostics().staleVisibleResultDropCount`,由 `hookDiagnostics.test.tsx` 验证

## S-LR-310 / streamingVisibleLagP95Ms

- **Source**: reuses `chat-stream-render-isolation-2026-06` baseline
- **Evidence class**: `proxy`(继承自 chat-stream 的 jsdom measurement);no fresh runtime trace in this change
- **Rationale**: 本 change 显式继承 chat-stream 的 live streaming lightweight 行为,未做新的 streaming measurement;release-grade 数据待后续 `release-grade-evidence` trace

## Content-safety guarantees

所有 S-LR-* metric payload 都只含:
- ids (workspaceId, threadId, pid, requestId, etc.)
- counts (pendingRequestCount, fallbackCount, etc.)
- durations / timestamps (sampledAtMs, registeredAgeMs)
- evidence class 字符串 (measured / proxy / manual-only / unsupported)
- bounded reason 字符串 (worker-not-available, diagnostics-only-candidate, ...)

**Never include**: prompt text, assistant body, terminal output, tool output, file diff content, raw Markdown body

## Platform qualifier

- macOS 15 开发环境
- `bash scripts/perf-reproduce-jank.sh` 15-30min long-run trace 未在本 change 内真实运行;`task 5.4` remains unchecked and deferred
- Windows / Linux OS process liveness 当前 `unsupported`,需在 `release-grade-evidence` change 里补
