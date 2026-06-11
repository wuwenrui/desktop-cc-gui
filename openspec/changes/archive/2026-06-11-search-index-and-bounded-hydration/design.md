# Design / 设计

## Index Model / 索引模型

Per-workspace index should group provider-specific normalized candidates:

- files: path/name tokens, extension, workspace id, source version;
- threads/messages: title/preview tokens, thread id, updated timestamp/version;
- kanban/history/skills/commands: stable id, label tokens, provider kind.

Content-sensitive fields should remain bounded previews or hashes where diagnostics are persisted.

## Hydration Policy / 水合策略

Active workspace hydrates first. Other workspaces use limited concurrency and can continue in background. Query results must expose whether global hydration is partial or complete.

## Query Policy / 查询策略

Query should read cached indexes and provider candidates. Async provider work must carry query/version token and drop stale results when query changes or palette closes.

## Metrics / 指标

`reportSearchMetrics` should record provider elapsed time, candidate count, result count, index hit/miss, hydration state, and stale drop count. Do not record full message/file content.

## Rollback / 回滚

Index use can be disabled provider-by-provider. Bounded hydration should remain even if a provider falls back to raw compute.

## Implementation Notes / 实施记录

### Iteration 1 — index item schema + builders (2026-06-11)

目标：把 `Add per-workspace normalized search index builders` 和前置 `Define index item schema, source version keys, and invalidation rules` 落地，且**不破现有 caller contract**（`useUnifiedSearch` 保持同步、`searchFiles` / `searchThreads` / `searchMessages` / `searchKanbanTasks` / `searchHistory` / `searchSkills` / `searchCommands` signature 不变）。

新增文件：

- `src/features/search/indexing/indexItem.ts`
  - `IndexedItem`: id / matchText / kind / secondaryText / sortKey / workspaceId
  - `SourceVersion`: (workspaceId, provider, version, updatedAt) 失效 key
  - `WorkspaceIndexState`: per-workspace 容器
  - `isIndexStale(state, expected)`: missing / version mismatch 一律算 stale
- `src/features/search/indexing/indexItem.test.ts` — 8 个测试
- `src/features/search/indexing/buildWorkspaceIndex.ts`
  - `buildWorkspaceIndex({ workspaceId, files, threads, threadItemsByThread })`: 纯函数，返回 `WorkspaceIndexState`
  - 现阶段只 normalized workspace-scoped 的 file / thread / message 三个 provider；kanban / history / skills / commands 仍走原 provider，待后续 iteration 再切到 index 路径
  - `sourceVersionKey(workspaceId, provider, input)`: content-aware numeric fingerprint，覆盖 same-count replacement / rename / message edit
- `src/features/search/indexing/buildWorkspaceIndex.test.ts` — 9 个测试

未触达（下一 iteration 才动）：

- `useUnifiedSearch.ts`：仍调用原 provider；后续接入 index 时只把 `collectProviderResults` 的 candidate 列表换成 `state.items[provider]`，ranking / sort 路径不变
- `messageProvider.ts`：当前已是 `buildWorkspaceMessageIndex` + `searchMessages` 两步，index iteration 时把 `IndexedItem` 投影成 `SearchResult`，避免重复 `indexOf` 扫描
- global hydration concurrency / provider-level timing / recency map caching / stale query guard 沿用已有实现（这些 task 之前已闭环）

验证：

- `npx vitest run src/features/search/indexing/` → 19/19 通过
- `npm run lint` → exit 0
- `npx tsc --noEmit -p .` → exit 0（无新增报错）

### Iteration 2 — incremental rebuild (2026-06-11)

目标：把 `Rebuild indexes incrementally when source versions change` 落地，且**不破现有 caller contract**。本轮只新增 `syncWorkspaceIndex` 纯函数 + 配套 helper，**暂不接入 `useUnifiedSearch`**（保守演进，跟 Iteration 1 节奏一致）。

新增文件：

- `src/features/search/indexing/syncWorkspaceIndex.ts`
  - `syncWorkspaceIndex({ workspaceId, files, threads, threadItemsByThread, previous })`: 纯函数
  - 三种输出形态：
    1. 无 `previous` 或 workspaceId 不匹配 → `buildWorkspaceIndex(input)` fresh build
    2. 三个 provider content-aware source version 都未变 → **返回 `previous` 同一引用**（最强优化，零分配）
    3. 单/多 provider stale → 只重算 stale provider，**未 stale provider 的 `items` 与 `sourceVersion` 引用复用**
  - `isProviderStale(state, workspaceId, provider, input)`: 用 `sourceVersionKey` 做 invalidation 比对
  - `versionKeyForProvider(state, provider)`: 探针，签名宽到 `SearchResultKind`（不只 workspace-scoped）
- `src/features/search/indexing/syncWorkspaceIndex.test.ts` — 13 个测试覆盖：fresh build、引用相等、partial rebuild、workspaceId mismatch、count tracking、updatedAt 单调

设计口径修正（Iteration 1 → 2 的一致性收口）：

- Iteration 2 最初采用 count-based invalidation；review 发现 same-count replacement / thread rename / message edit 会复用 stale index。
- 当前统一为 **content-aware numeric source fingerprint**：
  - `SourceVersion.version` 文档注释更新为 normalized indexed fields 的 stable numeric fingerprint，或 caller 显式值。
  - `buildWorkspaceIndex` 与 `syncWorkspaceIndex` 共享 `sourceVersionKey(...)` 计算，确保 build / stale check 口径一致。
  - `isIndexStale` 额外校验 `workspaceId` / provider identity，避免跨 workspace 相同 version 误判 fresh。

未触达（下一 iteration 才动）：

- `useUnifiedSearch.ts`：未切到 `syncWorkspaceIndex` 路径。下一轮要把 `useUnifiedSearch` 内 `useState(() => loadSearchRecencyMap())` 模式扩到 `useRef<Map<workspaceId, WorkspaceIndexState>>`，并把 `computeUnifiedSearchResults` 的 file / thread / message 三个 provider 调用换成 `state.items[provider]`
- 异步 stale / cancellation guard（独立 task，下一轮做）
- id-set diffing 不再是 correctness 前提；content-aware fingerprint 已覆盖同数量内容变化。

验证：

- `npx vitest run src/features/search/indexing/` → 29/29 通过
- `npx vitest run src/features/search/ src/app-shell-parts/useAppShellSearchRadarSection.test.tsx` → 64/64 通过
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `openspec validate search-index-and-bounded-hydration --strict --no-interactive` → valid

### Iteration 3 — query token guard (2026-06-11)

目标：把 `Add cancellation/stale query guard for async provider search` 落地，且**保持 `useUnifiedSearch` / `computeUnifiedSearchResults` 同步 contract 不变**。本轮只新增 token 抽象 + 在 hook 内部用 `discardIfStale` 守门；`computeUnifiedSearchResults` signature 不动。

新增 / 修改文件：

- 新增 `src/features/search/hooks/searchQueryToken.ts`
  - `SearchQueryTokenState`: `{ token, query, bumpKey, updatedAt }`
  - `createInitialQueryToken(query, bumpKey)`: 构造器
  - `isQueryTokenStale(current, captured)`: 纯函数判定
  - `useSearchQueryToken(query, bumpKey)`: React hook，每次 query 或 bumpKey 变 +1 token
  - `discardIfStale(current, captured, value)`: 纯函数 gate，返回 `{ value, staleDropped, captured }`
- 新增 `src/features/search/hooks/searchQueryToken.test.tsx` — 11 个测试覆盖：构造器、stale 判定、hook 推进、bumpKey、多次 rerender、discardIfStale 同/异 token
- 改 `src/features/search/hooks/useUnifiedSearch.ts`
  - 加 `useSearchQueryToken(query)` ref
  - 加 `useRef` 持 `lastCommittedResultsRef`（stale fallback）
  - useMemo 内 capture token → `computeUnifiedSearchResults` → `discardIfStale` gate → stale 时返回 `lastCommittedResultsRef.current`
  - `computeUnifiedSearchResults` signature / 行为 / 公共 contract 完全不变；`useUnifiedSearch` 同步返回值不变
- 改 `src/features/search/hooks/useUnifiedSearch.test.ts`
  - 加 3 个 describe（5 个测试）：快速切 query 不返回旧结果、query 往返不崩、token + discardIfStale 直连验证

保守约束遵守（项目规则）：

- `computeUnifiedSearchResults` 是 pure sync function，未引入 async 路径（避免触发 `useUnifiedSearch` caller contract 变更；详见 `openspec/docs/lazy-state-extension-regression-2026-06-11.md` 的"不要为了性能重排同步链路"教训）
- caller `useAppShellSearchRadarSection.ts` 完全未动（`useDeferredValue` / 其它编排保持原样）
- `reportSearchMetrics` 仅多接一个 `staleDropCount` 参数（字段在 Iteration 0 已存在于类型上）

行为说明（重要）：

- 当前 `useUnifiedSearch` 同步，staleDropCount **baseline 永远 0**
- 但 token 机制 + discardIfStale helper 已在位；将来如果 `computeUnifiedSearchResults` 变 async / provider 内部加 setTimeout / setImmediate 等，guard 自动生效，不需要再动 hook contract
- 这对应 proposal 里 "Provider search 支持 cancellation/stale query guard" + spec delta "stale async provider results are dropped" 的**机制层**落地，而非具体 race 触发

未触达（留给后续 iteration）：

- `useUnifiedSearch` 真正接入 `syncWorkspaceIndex` 路径（替换 file/thread/message 三个 provider 的 raw 调用为 indexed items 投影）
- index invalidation regression tests（独立 task）
- query elapsed / candidate evidence fixture（独立 task）

验证：

- `npx vitest run src/features/search/hooks/searchQueryToken.test.tsx` → 11/11
- `npx vitest run src/features/search/hooks/useUnifiedSearch.test.ts` → 10/10
- `npx vitest run src/features/search/ src/app-shell-parts/useAppShellSearchRadarSection.test.tsx` → 80/80
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `openspec validate search-index-and-bounded-hydration --strict --no-interactive` → valid

### Iteration 4 — invalidation + equivalence regression tests (2026-06-11)

目标：把 `Add index invalidation and query result regression tests` 落地，**不破既有 caller contract**。本轮只新增测试文件 + 一个 content-aware invalidation 入口 helper，**不**改 `syncWorkspaceIndex` / `useUnifiedSearch` 公共 contract。

新增 / 修改文件：

- 新增 `src/features/search/indexing/invalidation.regression.test.ts` — 14 个测试，5 个 describe 块：
  - **file provider**：file 新增 / file 删除 / same-count replacement / 引用复用
  - **thread provider**：thread 新增 + same-count rename 必须重建
  - **message provider**：message 新增 / message 删除 / same-count text edit 必须重建
  - **cross-provider isolation**：file/thread/message 三个 provider 在 sync 时互不污染
  - **workspace isolation**：w-a / w-b 不串味
  - **empty / boundary**：空 → 非空 / 非空 → 空 / `isProviderStale` 对 empty content version 的处理
- 新增 `src/features/search/indexing/equivalence.regression.test.ts` — 7 个测试：
  - file / thread / message **index id 集合 == provider id 集合**（结构等价；锁住"未来切到 index 路径时结果 identity 不漂移"）
  - lowercase / 空过滤一致性
  - 跨 workspace 同 thread id 产出不同 index id
- 修改 `src/features/search/indexing/buildWorkspaceIndex.ts`：新增 content-aware fingerprint helpers
  - `sourceVersionKey(...)` 是 build 与 sync 共用的 invalidation 入口
  - `threadFingerprints(threads)` 继续作为可测试的 thread source fingerprint helper，并被 `syncWorkspaceIndex` 间接使用
- 修改 `src/features/search/indexing/syncWorkspaceIndex.test.ts`：3 个测试覆盖 `threadFingerprints`：排序、空过滤、rename 检测

设计 trade-off 文档化（重要）：

- count-only invalidation 已撤回：它会漏掉 same-count content change。
- 当前策略是 lightweight content fingerprint：不保存 full message/file content 到 metrics/evidence，但 source version 会随 indexed fields 变化。
- 对应 proposal 里 "Index invalidation 错误会导致 stale/missing results" 的风险，content-aware source version 是默认 guard。

未触达（留给后续 iteration）：

- `useUnifiedSearch` 真正接入 `syncWorkspaceIndex` 路径（替换 file/thread/message 三个 provider 的 raw 调用为 indexed items 投影）
- query elapsed / candidate evidence fixture（最后一个 task）

验证：

- `npx vitest run src/features/search/indexing/` → 58/58（4 个 indexing test 文件：buildWorkspaceIndex / indexItem / syncWorkspaceIndex / messageIndex + 2 个 regression 文件）
- `npx vitest run src/features/search/ src/app-shell-parts/useAppShellSearchRadarSection.test.tsx` → 123/123
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `openspec validate search-index-and-bounded-hydration --strict --no-interactive` → valid

### Iteration 5 — perf evidence contract + representative fixture (2026-06-11)

目标：把 `Record query elapsed/candidate evidence for representative fixture` 落地，且**完全保持既有 caller contract**。本轮只新增 perf evidence 类型 + 一个**可选**的 `evidenceSink` 参数 + fixture 测试；**不**把 hook 切到 evidence 路径，**不**写 evidence 到磁盘（避开之前 perf baseline 文件被覆盖的旧问题）。

新增 / 修改文件：

- 新增 `src/features/search/perf/evidence.ts`
  - `SearchEvidence`: `{ query, elapsedMs, resultCount, providerTimings, hydrationState, staleDropCount, candidateTotal, capturedAt }`
  - `SearchProviderTiming`: 单 provider 的 `{ provider, elapsedMs, candidateCount, resultCount }`
  - `SearchHydrationState`: `"active-only" | "partial-global" | "global"`（与 spec delta 对齐）
  - `SearchEvidenceBuffer` class：append-only，`push / all / last / clear / size`
  - 工厂函数：`createSearchEvidenceBuffer / recordSearchEvidence / takeLastEvidence`
  - 工具：`sumProviderCandidates / providerIdToKind`
  - 文档化：metrics **必须 content-safe**（与 `.trellis/spec/frontend/quality-guidelines.md` "search performance metrics are bounded and content-safe" 规则一致）
- 新增 `src/features/search/perf/evidence.test.ts` — 7 个测试覆盖 buffer 行为、sum 工具、provider id 映射
- 新增 `src/features/search/perf/evidence.fixture.test.ts` — **representative fixture**：
  - 复用 `SEARCH_PERF_BASELINE_GLOBAL`（8 workspaces × 1500 files），跑 `computeUnifiedSearchResults` 收集 evidence
  - 7 个测试：单次 compute 1 条 record、elapsedMs 在 budget 内、hydrationState === `partial-global`、candidateTotal === Σ timings、workspace-scoped provider 每 workspace 1 条 timing、workspace-agnostic provider 仅 1 条 timing、capturedAt 多次调用单调
  - 复用 `useUnifiedSearch.test.ts > keeps global search latency under baseline for large data` 的 fixture 形状，避免 baseline 漂移
- 修改 `src/features/search/hooks/useUnifiedSearch.ts`
  - `ComputeUnifiedSearchOptions` 新增 `evidenceSink?: (e: SearchEvidence) => void`（**可选**）
  - 末尾 `if (evidenceSink) { evidenceSink({ ... }) }`，**只在传入时**执行
  - signature 向后兼容；现有 hook caller 行为完全不变
  - 顺手把 `providerTimings` 的内联类型换成 `SearchProviderTiming[]` import alias

**关键设计决策**（对应 proposal 的 Risks 节）：

- **不**写 evidence 到磁盘：避免 `docs/perf/baseline.*` / `docs/perf/history/*.json` 被反复覆盖的老问题（详见交接摘要的风险节）
- **不**让 hook 接 `evidenceSink`：保守演进；当前 hook 走 `reportSearchMetrics` 路径（`console.debug`），调用方决定何时启用 evidence
- **复用** `SEARCH_PERF_BASELINE_GLOBAL` 而非新加 fixture：避免 baseline 漂移；evidence fixture 与 `useUnifiedSearch.test.ts` 的 baseline 测试用同一份数据，drift 一眼可见
- evidence 类型**严格不**包含 message body / file content / prompt text（与 `composer-file-reference-index-availability` spec delta "search performance metrics are bounded and content-safe" 一致）

验证：

- `npx vitest run src/features/search/perf/` → 14/14（2 个新文件）
- `npx vitest run src/features/search/ src/app-shell-parts/useAppShellSearchRadarSection.test.tsx` → 118/118
- `npm run typecheck` → exit 0
- `npm run lint` → exit 0
- `openspec validate search-index-and-bounded-hydration --strict --no-interactive` → valid
