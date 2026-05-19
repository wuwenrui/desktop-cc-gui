# sidebar-list-timeout-fallback Specification Delta

## ADDED Requirements

### Requirement: Sidebar List Engine Subsource Timeout MUST Preserve Last-Good Entries

当 sidebar `listThreadsForWorkspace` 在 full-catalog hydration 中，任一被纳入主链路 mergedById 投递的引擎子源（当前为 Claude、OpenCode）在 `withTimeout` 窗口内返回 `null`，系统 MUST 保留上一轮 last-good 中该引擎的非 archived / 非 shared / 非 pending 条目，并通过统一的 engine-aware seed 路径将其投递回 mergedById，再继续与其他成功子源合并。

#### Scenario: claude subsource timeout preserves last-good claude entries

- **WHEN** sidebar `listThreadsForWorkspace` 处于 full-catalog 阶段
- **AND** `listClaudeSessionsService` 在 `withTimeout` 窗口内 resolve 为 `null`
- **AND** 至少一个其他子源（Codex catalog / OpenCode / Gemini cache）返回非空结果
- **THEN** 最终写入 store 的 thread 列表 MUST 包含上一轮 last-good 中所有 retainable 的 Claude 条目
- **AND** 系统 MUST 通过 `seedLastGoodEngineIntoMerged("claude", ...)` 或行为等价路径完成投递

#### Scenario: opencode subsource timeout preserves last-good opencode entries

- **WHEN** sidebar `listThreadsForWorkspace` 处于 full-catalog 阶段
- **AND** `getOpenCodeSessionListService` 在 `withTimeout` 窗口内 resolve 为 `null`
- **AND** 至少一个其他子源返回非空结果
- **THEN** 最终写入 store 的 thread 列表 MUST 包含上一轮 last-good 中所有 retainable 的 OpenCode 条目
- **AND** 系统 MUST 通过 `seedLastGoodEngineIntoMerged("opencode", ...)` 或行为等价路径完成投递
- **AND** OpenCode 条目 MUST 与其他子源成功结果共同存在于最终列表，按 `updatedAt desc` 排序

#### Scenario: codex catalog timeout does not pollute base entries

- **WHEN** sidebar `listThreadsForWorkspace` 处于 full-catalog 阶段
- **AND** `listWorkspaceSessionsService`（Codex catalog）在 `withTimeout` 窗口内 resolve 为 `null` 或返回空 `sessions`
- **THEN** `mergeCodexCatalogSessionSummaries` MUST 在 `codexSessions.length === 0` 时早退并原样返回 baseSummaries
- **AND** 此时 mergedById 中既有的 Claude / OpenCode 条目 MUST 不被洗掉
- **AND** 系统 MUST NOT 为 Codex 主链路引入额外的 seed 调用（catalog 路径已通过早退实现等价保护）

#### Scenario: gemini async refresh timeout does not touch main merge pipeline

- **WHEN** sidebar `listThreadsForWorkspace` 处于 full-catalog 阶段
- **AND** Gemini 异步 fire-and-forget 任务中的 `withTimeout` resolve 为 `null`
- **THEN** Gemini 任务 MUST 在 timeout 分支直接 `return`，不访问主链路 mergedById
- **AND** 系统 MUST NOT 因 Gemini timeout 而修改其他引擎在主合并管道中已生成的列表
- **AND** 系统 MUST NOT 为 Gemini 主链路引入 seed 调用（并发模型已通过独立任务实现等价保护）

### Requirement: Sidebar List Engine Subsource Rejection MUST Preserve Last-Good Entries And Emit Diagnostics

当被纳入主链路 mergedById 投递的引擎子源（Claude、OpenCode）在 `Promise.allSettled` 中 status 为 `rejected`，系统 MUST 与 timeout 分支等价地保留 last-good 条目，并通过 `rememberPartialSource("<engine>-session-error")` 与 `onDebug` 上报可观测诊断，不得静默吞掉子源失败。

#### Scenario: claude subsource rejection preserves last-good and emits claude-session-error

- **WHEN** `claudeResult.status === "rejected"`
- **THEN** 系统 MUST 调用 `rememberPartialSource("claude-session-error")` 或等价机制
- **AND** 系统 MUST 通过 `onDebug` 投递 `thread/list claude error` 事件，payload 含 `workspaceId` 与 `error` 字段
- **AND** 系统 MUST 通过 `seedLastGoodEngineIntoMerged("claude", ...)` 保留 last-good Claude 条目

#### Scenario: opencode subsource rejection preserves last-good and emits opencode-session-error

- **WHEN** `opencodeResult.status === "rejected"`
- **THEN** 系统 MUST 调用 `rememberPartialSource("opencode-session-error")` 或等价机制
- **AND** 系统 MUST 通过 `onDebug` 投递 `thread/list opencode error` 事件，payload 含 `workspaceId` 与 `error` 字段
- **AND** 系统 MUST 通过 `seedLastGoodEngineIntoMerged("opencode", ...)` 保留 last-good OpenCode 条目

#### Scenario: rejection path MUST NOT silently drop the subsource

- **WHEN** Claude 或 OpenCode 子源 rejected
- **THEN** 系统 MUST NOT 让该子源沉默——既无 partial-source 记录又无 onDebug 事件
- **AND** UI 层 MUST 能据此呈现 degraded badge 或 recovery state（如已有该展示）

### Requirement: Sidebar Last-Good Seed Resolution MUST Be Engine-Aware Through A Unified Mechanism

系统 MUST 通过单一的 engine-aware 接口（`seedLastGoodEngineIntoMerged(engine, ...)` 与 `isRetainableEngineContinuitySummary(engine, summary)`）实现引擎归一化的 last-good seed 与 retainable 判定；引擎特定的薄包装可作为向后兼容存在，但行为 MUST 与通用接口完全等价。

#### Scenario: engine-aware seed is parameterized by engine identity

- **WHEN** 系统需要把 last-good 条目 seed 进 mergedById
- **THEN** 系统 MUST 调用 `seedLastGoodEngineIntoMerged(engine, mergedById, lastGoodSummaries, excludedThreadIds)` 或其薄包装
- **AND** 该接口 MUST 在内部根据 `engine` 参数应用对应的 `isRetainableEngineContinuitySummary` 过滤
- **AND** 接口的 engine 联合类型 MUST 仅包含已纳入主链路 seed 的引擎（当前为 `"claude" | "opencode"`）

#### Scenario: retainable filter is engine-scoped and rejects archived shared pending entries

- **WHEN** `isRetainableEngineContinuitySummary(engine, summary)` 判定一个候选 last-good 条目
- **THEN** 系统 MUST 拒绝 `summary.archivedAt > 0` 的条目
- **AND** 系统 MUST 拒绝 `summary.threadKind === "shared"` 的条目
- **AND** 系统 MUST 拒绝 pending 前缀的 thread id（如 `claude-pending-*` / `opencode-pending-*` / `codex-pending-*`）
- **AND** 系统 MUST 拒绝引擎识别（`inferThreadEngineSource(summary.id, summary)`）与传入 `engine` 不匹配的条目

#### Scenario: legacy claude wrapper preserves identical behavior

- **WHEN** 既有代码调用 `seedLastGoodClaudeIntoMerged(mergedById, lastGood, excluded)`
- **THEN** 行为 MUST 与 `seedLastGoodEngineIntoMerged("claude", mergedById, lastGood, excluded)` 完全等价
- **AND** 既有 `useThreadActions.timeout-fallback.test.tsx` 中所有针对 Claude 的 case MUST 零退化

### Requirement: Sidebar Last-Good Snapshot MUST Resist Cross-Engine Self-Pollution

last-good 快照解析路径 MUST 在多引擎共存时维持引擎间隔离，不得让一个引擎的 degraded 状态污染其他引擎 last-good 条目的可用性；连续多次同一引擎 timeout 时，last-good 视图 MUST 不递减。

#### Scenario: consecutive opencode timeouts do not progressively drop sessions

- **WHEN** 同一 workspace 下连续两次 `listThreadsForWorkspace` 都让 OpenCode 子源 timeout
- **THEN** 第二次执行时 `getLastGoodThreadSummaries` 取到的 last-good 中 OpenCode 条目数 MUST 与首次完整列表的 OpenCode 条目数相等
- **AND** 第二次写入 store 的 OpenCode 条目数 MUST 不少于首次写入 store 的 OpenCode 条目数

#### Scenario: one engine degraded marker does not contaminate another engine last-good resolution

- **WHEN** Claude 子源 timeout 触发本轮 partial-source 标记
- **AND** OpenCode 子源同一轮正常返回非空结果
- **THEN** 下一轮 `getLastGoodThreadSummaries` 时 OpenCode 条目 MUST 仍被视为 healthy 可用
- **AND** `isRetainableEngineContinuitySummary("opencode", summary)` MUST NOT 因 Claude degraded 标记而拒绝 OpenCode 条目

#### Scenario: mixed engine fixture confirms seed independence

- **WHEN** last-good 列表包含 healthy Claude + degraded Codex + last-good OpenCode 三类条目
- **AND** 当前轮 OpenCode 子源 timeout
- **THEN** `seedLastGoodEngineIntoMerged("opencode", ...)` MUST 仅 seed last-good 中的 OpenCode 条目
- **AND** Codex 的 degraded 标记 MUST NOT 影响 OpenCode 条目的 retainable 判定
- **AND** Claude 的 healthy 条目 MUST NOT 被误 seed 为 OpenCode
