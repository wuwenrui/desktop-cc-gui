# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 4 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Evidence / 证据先行

- [x] Preflight：确认 Step 3 已合入 `ScanCache<K,V>`、统一 cache key signature、blocking helper、`payloadBudget` metadata；未满足时停止 implementation。
- [x] Audit `workspaces/files.rs` 的 `limit_hit` / `scan_state` / directory children 现有 contract 与 tests。
- [x] Audit `useWorkspaceFiles` snapshot cache、FileTreePanel virtual rows、expanded folder loading 和 partial UI。
- [x] 记录当前 large workspace listing 的 duration、entry count、payload estimate、cache hit/miss 可观测字段缺口。

## Contract / 契约设计

- [x] 定义 initial listing budget metadata：depth、maxEntries、payloadBytes、sourceVersion、scanState、limitHit、cacheState。
- [x] 定义 directory subtree request/response contract，包含 requested path、sourceVersion、pagination cursor 或 large-subtree partial state。
- [x] 定义 shared file index contract：path tokens、directory tokens、sourceVersion、freshness、invalidated paths。
- [x] 定义 feature flag / fallback：pagination 或 shared index 未启用时如何记录 diagnostics。

## Implementation / 实施

- [x] 仅在 preflight 通过后开始业务实现；不得在本 change 内重新发明 `ScanCache` / `payloadBudget`。
- [x] 后端 listing response 增加 budget / sourceVersion / payload metrics，保持旧字段兼容。
- [x] Directory expand 只加载 requested subtree，stale sourceVersion response 丢弃。
- [x] `useWorkspaceFiles` cache key 增加 root / ignore config / sourceVersion signature，并与 watcher invalidation 联动。
- [x] FileTreePanel partial/truncated/loading 状态清晰展示，避免把 unknown subtree 当 empty subtree。
- [x] File tree/search 通过 adapter 共享 per-workspace file index；search change 未完成时保持 guarded fallback。
- [x] `runtime-performance-evidence-gates` 增补 file listing budget 字段。

## Validation / 验证

- [x] Rust listing budget / partial / subtree tests。
- [x] FileTreePanel partial UI 与 expand subtree tests。
- [x] Watcher changed paths invalidation tests（create / modify / delete / rename）。
- [x] Shared index sourceVersion consistency tests。
- [x] Workspace switch 后 listener/cache 引用清理测试。
- [x] `npm run perf:long-list:baseline`
- [x] `npm run perf:long-list:browser-scroll`
- [x] `npm run check:runtime-evidence-gates`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `openspec validate workspace-tree-and-large-file-listing-budget --strict --no-interactive`
