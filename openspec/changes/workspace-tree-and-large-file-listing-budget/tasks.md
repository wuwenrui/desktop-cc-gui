# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 4 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Evidence / 证据先行

- [ ] Audit `workspaces/files.rs` 的 `limit_hit` / `scan_state` / directory children 现有 contract 与 tests。
- [ ] Audit `useWorkspaceFiles` snapshot cache、FileTreePanel virtual rows、expanded folder loading 和 partial UI。
- [ ] 记录当前 large workspace listing 的 duration、entry count、payload estimate、cache hit/miss 可观测字段缺口。

## Contract / 契约设计

- [ ] 定义 initial listing budget metadata：depth、maxEntries、payloadBytes、sourceVersion、scanState、limitHit、cacheState。
- [ ] 定义 directory subtree request/response contract，包含 requested path、sourceVersion、pagination cursor 或 large-subtree partial state。
- [ ] 定义 shared file index contract：path tokens、directory tokens、sourceVersion、freshness、invalidated paths。
- [ ] 定义 feature flag / fallback：pagination 或 shared index 未启用时如何记录 diagnostics。

## Implementation / 实施

- [ ] 后端 listing response 增加 budget / sourceVersion / payload metrics，保持旧字段兼容。
- [ ] Directory expand 只加载 requested subtree，stale sourceVersion response 丢弃。
- [ ] `useWorkspaceFiles` cache key 增加 root / ignore config / sourceVersion signature，并与 watcher invalidation 联动。
- [ ] FileTreePanel partial/truncated/loading 状态清晰展示，避免把 unknown subtree 当 empty subtree。
- [ ] File tree/search 通过 adapter 共享 per-workspace file index；search change 未完成时保持 guarded fallback。
- [ ] `runtime-performance-evidence-gates` 增补 file listing budget 字段。

## Validation / 验证

- [ ] Rust listing budget / partial / subtree tests。
- [ ] FileTreePanel partial UI 与 expand subtree tests。
- [ ] Watcher changed paths invalidation tests（create / modify / delete / rename）。
- [ ] Shared index sourceVersion consistency tests。
- [ ] Workspace switch 后 listener/cache 引用清理测试。
- [ ] `npm run perf:long-list:baseline`
- [ ] `npm run perf:long-list:browser-scroll`
- [ ] `npm run check:runtime-evidence-gates`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `openspec validate workspace-tree-and-large-file-listing-budget --strict --no-interactive`
