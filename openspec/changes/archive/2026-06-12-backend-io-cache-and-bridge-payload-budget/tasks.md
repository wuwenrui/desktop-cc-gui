# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 3 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Inventory / 盘点

- [x] 列出 high-volume backend commands：session catalog、local usage、Claude history、workspace files、git log/diff/status、project map relations。
- [x] 对每个 command 记录 current limit/timeout、response item count、payload estimate、是否已有 partial/truncated 语义。
- [x] 标记 sensitive fields，定义 frontend diagnostics 只允许 hash/id/count/timing/boolean。

## Contract / 契约设计

- [x] 定义公共后端 substrate：`ScanCache<K,V>`、统一 cache key signature、blocking helper、`payloadBudget` metadata contract；Step 4 必须能直接复用。
- [x] 定义 scan cache adapter interface：key fields、source signature、cache state、invalidation reason、evidence payload。
- [x] 定义 JSONL append-only fast path 与 fallback full rescan 条件。
- [x] 定义 bridge payload budget metadata：command、surface id、item count、estimated bytes、partial/truncated、cacheState、evidenceClass。
- [x] 定义 git log/diff/status pagination/truncation 的 backwards-compatible DTO。

## Implementation / 实施

- [x] 先落公共 substrate skeleton + focused tests，再接入任何业务 scan path。
- [x] 为 selected scan path 增加 content-safe timing/cache diagnostics，没有 cache 的路径输出 `unsupported` reason。
- [x] 对至少一个重复 scan 热点接入 cache adapter，并补 invalidation tests。
- [x] JSONL scan 增加 append-only offset/inode/mtime guard 和 truncate/corrupt fallback。
- [x] CPU-heavy scan/libgit2/project-map path 统一通过 blocking policy、timeout、partial fallback 记录 evidence。
- [x] 对 selected git high-volume command 增加 pagination/truncation metadata 和 legacy fallback。
- [x] Tauri high-volume invoke response 增加 payload budget metadata 或 wrapper；`workspaces/files.rs` 仅允许接入 metadata / substrate，不实现 Step 4 的分页与 subtree contract。
- [x] `runtime-performance-evidence-gates` 增补 backend IO / bridge payload budget fields。

## Validation / 验证

- [x] Cache adapter hit/miss/invalidation tests。
- [x] JSONL append/truncate/corrupt tests。
- [x] Blocking timeout partial fallback tests。
- [x] Git pagination/truncation tests for implemented command。
- [x] Payload metadata content-safety test：不包含绝对路径/secrets/prompt/body/tool output。
- [x] Runtime evidence report reads backend / bridge fields。
- [x] `npm run check:runtime-evidence-gates`
- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `cargo test --manifest-path src-tauri/Cargo.toml`
- [x] `openspec validate backend-io-cache-and-bridge-payload-budget --strict --no-interactive`
