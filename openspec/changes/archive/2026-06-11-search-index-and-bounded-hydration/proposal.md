# search-index-and-bounded-hydration

## Summary / 摘要

为 unified search 增加 per-workspace normalized indexes、bounded global hydration、query stale guard 和 provider-level timing，避免搜索输入期间反复扫描 raw files/messages/threads/kanban/history/skills。

## Problem / 问题

`P0-09` 指出 `useUnifiedSearch` 会在 debounced query 上跨 files、threads、messages、kanban、history、skills、commands 重新计算；global search 打开时还可能对所有 uncached workspaces `Promise.all(getWorkspaceFiles(workspaceId))`。这会把搜索输入卡顿与 workspace file hydration 绑定在一起。

用户感知问题是：打开 palette 或输入 query 时，UI 应该先响应 active workspace 和已有 index，而不是等所有 workspace 文件扫描、recency map 读取、provider query 全部完成。

## Goals / 目标

- 建立 per-workspace normalized search indexes：file path tokens、thread title tokens、message preview tokens、kanban tokens、command/skill tokens。
- Source version 变化时增量 rebuild，而不是每次 query 扫 raw data。
- `loadSearchRecencyMap()` 移出 hot query compute path。
- Global search hydration 有 concurrency limit：active workspace first，其他 workspace background。
- Provider search 支持 cancellation/stale query guard。
- `reportSearchMetrics` 增加 provider-level timing 与 result candidate count。

## Non-Goals / 非目标

- 不引入外部搜索服务或数据库。
- 不改变用户可见 search result ranking 的核心语义，除非为稳定性修复必要。
- 不一次性实现全文倒排索引的所有高级能力。
- 不把历史消息正文或敏感内容写入长期性能日志。

## Approach / 方案

1. Audit `useUnifiedSearch` providers and data inputs。
2. 定义 normalized index item schema 与 per-provider version key。
3. 将 recency map 缓存从 query compute 中解耦。
4. Active workspace index/hydration 优先，其他 workspace 受 concurrency limit 后台补齐。
5. Query 执行读取 indexes/candidates，并丢弃 stale async results。
6. Provider-level timing 写入 bounded search perf diagnostics。

## Risks / 风险

- Index invalidation 错误会导致 stale/missing results，必须以 source version 和 changed paths 作为 guard。
- Background hydration 不能让用户误以为全局结果已经完整，需要 UI/metrics 能区分 partial/global hydrated state。
- Tokenization/ranking 变化可能影响用户习惯，首期尽量保持 additive and compatible。

## Acceptance Criteria / 验收口径

- Search input remains responsive while global workspace files hydrate。
- Query compute time scales with indexed candidates, not raw all messages/files on every keypress。
- Global search open 不再 unbounded parallel scan all workspaces。
- Provider metrics 能显示慢 provider、candidate count、hydration state。

## Validation / 验证

- Focused search provider/index/hydration tests。
- Search stale query/cancellation tests。
- `npm run typecheck`
- `npm run lint`
- Search performance report or focused metrics fixture。
- `openspec validate search-index-and-bounded-hydration --strict --no-interactive`
