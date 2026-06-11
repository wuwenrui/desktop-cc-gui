# Tasks / 任务

## Execution Step / 执行步序

- **Step**: 3 of 5 (P1 串行链)
- **Predecessor 提案**: 见 `proposal.md` 的 Execution Order 段
- **本 change 任务未通过验收前，串行链下游不应启动**


## Inventory / 盘点

- [ ] 列出 high-volume backend commands：session catalog、local usage、Claude history、workspace files、git log/diff/status、project map relations。
- [ ] 对每个 command 记录 current limit/timeout、response item count、payload estimate、是否已有 partial/truncated 语义。
- [ ] 标记 sensitive fields，定义 frontend diagnostics 只允许 hash/id/count/timing/boolean。

## Contract / 契约设计

- [ ] 定义 scan cache adapter interface：key fields、source signature、cache state、invalidation reason、evidence payload。
- [ ] 定义 JSONL append-only fast path 与 fallback full rescan 条件。
- [ ] 定义 bridge payload budget metadata：command、surface id、item count、estimated bytes、partial/truncated、cacheState、evidenceClass。
- [ ] 定义 git log/diff/status pagination/truncation 的 backwards-compatible DTO。

## Implementation / 实施

- [ ] 为 selected scan path 增加 content-safe timing/cache diagnostics，没有 cache 的路径输出 `unsupported` reason。
- [ ] 对至少一个重复 scan 热点接入 cache adapter，并补 invalidation tests。
- [ ] JSONL scan 增加 append-only offset/inode/mtime guard 和 truncate/corrupt fallback。
- [ ] CPU-heavy scan/libgit2/project-map path 统一通过 blocking policy、timeout、partial fallback 记录 evidence。
- [ ] 对 selected git high-volume command 增加 pagination/truncation metadata 和 legacy fallback。
- [ ] Tauri high-volume invoke response 增加 payload budget metadata 或 wrapper。
- [ ] `runtime-performance-evidence-gates` 增补 backend IO / bridge payload budget fields。

## Validation / 验证

- [ ] Cache adapter hit/miss/invalidation tests。
- [ ] JSONL append/truncate/corrupt tests。
- [ ] Blocking timeout partial fallback tests。
- [ ] Git pagination/truncation tests for implemented command。
- [ ] Payload metadata content-safety test：不包含绝对路径/secrets/prompt/body/tool output。
- [ ] Runtime evidence report reads backend / bridge fields。
- [ ] `npm run check:runtime-evidence-gates`
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `cargo test --manifest-path src-tauri/Cargo.toml`
- [ ] `openspec validate backend-io-cache-and-bridge-payload-budget --strict --no-interactive`
