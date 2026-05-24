## Context

`refactor-workspace-session-management` 已经把 Session Management 推向 disk-first catalog，但右侧工作区会话中的 `Claude Code` 仍存在“被吞”现象。当前链路不是单一 pipeline：

```text
Claude native history scanner
  -> listClaudeSessions
  -> useThreadActions native merge

Workspace session catalog
  -> listWorkspaceSessions
  -> useThreadActionsSessionCatalog
  -> useThreadActions catalog merge

Metadata overlay / archive / folder / title
  -> Settings / Sidebar / Workspace Home 各自解释
```

这会产生几个结构性问题：

- native scanner 能返回“成功但为空”，但前端无法证明这个空结果是 authoritative 还是 uncertain。
- catalog 会根据 cwd / workspace scope 重写 owner，再过滤 projection；如果 evidence 不完整，Claude entry 可能无诊断消失。
- 前端 helper 对 catalog entries 再做 exact `workspaceId` 过滤，project aggregate 或 child/worktree owner entry 可能被吞。
- last-good continuity 是 UI 可读性保护，不是 membership truth；现在它承担了过多事实源职责。
- title 解析分散，低置信度 fallback 有机会覆盖高置信度名称。

本设计目标是让 Claude 与 Codex 一样进入统一 workspace session catalog 事实源，同时保留 Claude native loader 对 transcript restore 的职责。

## Architecture Boundary

本变更把“读取、归属、投影、组织、展示”拆成五层，避免一个 fallback 同时承担多个职责。

```text
Claude disk / JSONL
  -> source scanner: bounded facts + diagnostics
  -> source-fact cache: optional persistent acceleration for unchanged facts
  -> ownership resolver: owner workspace + evidence
  -> catalog projection: strict / related / global membership + source completeness
  -> metadata overlay: archive / folder / custom title
  -> UI surfaces: display window + runtime state + continuity
```

边界规则：

- scanner 可以说“我读到了什么 / 我读不完整 / 这个 transcript 无法归属”，不能说“这个 workspace 没有 Claude 会话”。
- source-fact cache 可以复用 unchanged transcript 的 bounded facts，不能复用最终 workspace membership。
- resolver 可以说“这条 fact 属于哪个 owner / 无法唯一归属”，不能执行 archive/folder/title overlay。
- catalog projection 是默认 membership truth；它必须携带 source status、owner evidence 与 filtered totals。
- metadata overlay 是 organization layer；archive/folder/custom title 不证明 disk existence。
- UI surfaces 不能再用 exact `workspaceId`、native empty 或 title fallback 重算 membership。

## Goals / Non-Goals

**Goals:**

- Sidebar / Workspace Home / Settings 的默认工作区会话 membership 统一来自 `listWorkspaceSessions` active strict projection。
- Claude source adapter 输出 disk facts、ownership evidence、source completeness 和 bounded diagnostics。
- 后端显式区分 `authoritative_empty`、`partial`、`degraded`、`uncertain_empty`。
- Workspace ownership resolver 统一处理 transcript `cwd`、Claude project directory、git root、parent/child/worktree 与 sibling ambiguity。
- 前端移除会吞 child/worktree row 的 exact workspaceId 二次过滤。
- 统一 session title resolver 与 stable metadata key。
- 引入持久 source-fact cache，加速 Claude 大历史扫描与重复刷新，同时保持 membership 由 resolver/projection 当次计算。
- 用 Rust / Vitest 锁住 Claude 被吞的关键回归路径。

**Non-Goals:**

- 不引入后台 daemon、外部数据库或 always-on watcher。
- 不迁移或改写 Claude 原始 JSONL transcript。
- 不改变 Claude realtime / resume / send 主链路。
- 不扩大 strict project membership；related/global 仍是独立 surface。
- 不把 last-good continuity 升级为最终事实源。
- 不把 source-fact cache 当作不可删除的权威数据；cache 必须可重建。

## Decisions

### Decision 1: Catalog 是默认工作区会话 membership 唯一事实源

采用：

```text
Engine source facts
  -> centralized ownership resolver
  -> catalog projection + metadata overlay
  -> frontend surfaces
```

右侧工作区列表不再把 `listClaudeSessions` 与 catalog 当成两个并列 truth source。`listClaudeSessions` 保留用于：

- 打开 Claude curtain / transcript restore。
- 诊断 native history source。
- 在 catalog degraded 时提供受控 continuity seed，但不能直接扩大 membership。

备选方案是继续在前端合并 native list 与 catalog。该方案改动小，但会继续制造 source arrival order、timeout、empty semantics 与 exact filter 的组合问题，因此不采用。

### Decision 2: Claude source adapter 产出 facts，不做最终 membership 决策

Claude adapter 负责扫描 `~/.claude/projects` 或等价 storage，并为每条候选 transcript 产出：

- `engine = claude`
- `canonicalSessionId`
- `displaySessionId`
- `physicalPath`
- `existsOnDisk`
- `cwd`
- `claudeProjectDir`
- `parentSessionId`
- `firstRealUserMessage`
- `updatedAt`
- `messageCount` / bounded file metadata
- `sourceHealth`
- `ownershipEvidence`

最终是否进入当前 workspace projection，由统一 ownership resolver 和 projection scope 决定。

这样可以避免 `scan_session_file` 内部直接把 cwd 不匹配的 transcript 过滤成 `None` 后，调用方只能看到“没有 session”。如果一个 transcript 存在但 attribution 不确定，应该作为 unresolved/degraded evidence 返回到 catalog 层，而不是静默消失。

#### Source facts 与 cacheable facts

Claude source fact 是 cache 的最小单位。它可以缓存：

- `engine`
- `canonicalSessionId`
- `physicalPath`
- `fileMtime`
- `fileSize`
- `cwd`
- `claudeProjectDir`
- `parentSessionId`
- `firstRealUserMessage`
- `updatedAt`
- `messageCount`
- `titleEvidenceConfidence`
- `sourceDiagnostics`
- `scannerVersion`
- `schemaVersion`

它不能缓存为最终 truth：

- `ownerWorkspaceId`
- strict / related / global membership
- archive / folder / custom title overlay
- display window position
- frontend runtime selected / processing state

这些必须在每次 catalog projection 时重新计算或重新 overlay。

### Decision 3: Ownership resolver 集中化

Claude ownership resolver 使用稳定优先级：

1. transcript `cwd` exact workspace path match。
2. transcript `cwd` longest workspace path match。
3. Claude project directory 与 workspace path 的直接编码/路径匹配。
4. git root / parent inference。
5. 无法唯一判断时返回 `owner-unresolved` 或 `ambiguous-owner`，不得随意归 parent。

parent `/repo` 与 child `/repo/sub` 同时存在时，`cwd=/repo/sub` 必须归 child；main project aggregate 可以包含 child owner row，但 worktree-only scope 不得混入 parent/sibling。

### Decision 4: Projection completeness 是 API contract

Catalog response 需要携带 source completeness，例如：

```ts
type WorkspaceSessionSourceCompleteness =
  | "complete"
  | "authoritative_empty"
  | "partial"
  | "degraded"
  | "uncertain_empty";
```

建议 response 暴露 per-engine source health，而不是只给全局 partial boolean：

```ts
interface WorkspaceSessionCatalogSourceStatus {
  engine: "claude" | "codex" | "gemini" | "opencode";
  completeness: WorkspaceSessionSourceCompleteness;
  reason?: string;
  scannedCandidates?: number;
  skippedCandidates?: number;
  scanCapReached?: boolean;
}
```

前端规则：

- `authoritative_empty` 可以清除不再合法的 continuity row。
- `partial` / `degraded` / `uncertain_empty` 不能单独证明删除。
- source status 必须能驱动 UI badge / notice，而不是只能写入 console。

#### Completeness 合并规则

`WorkspaceSessionSourceCompleteness` 需要同时支持 per-engine status 与 projection summary。summary 不得把 Claude 的 incomplete evidence 用其它 engine 的成功结果冲掉。

| Claude source state | Entry rows | 前端删除 last-good? | UI 状态 |
|---------------------|------------|---------------------|---------|
| `complete` + rows | 使用 catalog rows | 只删除 projection 明确排除的 row | fresh |
| `authoritative_empty` | 空 | 可以清除当前 strict scope 的 continuity | fresh empty |
| `uncertain_empty` | 空或诊断 rows | 不可以 | incomplete |
| `partial` | 部分 rows | 不可以删除 omitted rows | incomplete |
| `degraded` | 可能有 rows | 不可以，除非 row 另有 authoritative removal | degraded |

Projection summary 应按以下原则保守合并：

- 单个 engine 的 `degraded` / `partial` / `uncertain_empty` MUST 保留在 per-engine status 中。
- 全局 summary MAY 标记 `hasIncompleteSources=true`，但 MUST NOT 把 Claude 描述为 complete。
- `authoritative_empty` 只对对应 engine + requested scope 生效，不能代表其它 engine 或 related/global surface。
- cap、timeout、permission denied、malformed transcript、oversized transcript、storage unavailable 都不能合并成 authoritative empty。

### Decision 5: Metadata 是 overlay，不证明存在性

archive、folder assignment、custom title 只属于组织层。存在性来自 engine disk/session facts。

Metadata key 应从裸 `sessionId` 升级为 stable key：

```text
engine + ownerWorkspaceId + canonicalSessionId
```

兼容策略：

- 读取旧 metadata 时可以继续识别裸 `sessionId`。
- 写入新 metadata 时优先使用 stable key。
- mutation result 必须返回实际 owner workspace，前端 selection key 跟随 stable key。

### Decision 6: 前端移除 exact workspaceId 二次 membership filter

`useThreadActionsSessionCatalog` 不应该再用：

```ts
(entry.workspaceId ?? currentWorkspaceId) === currentWorkspaceId
```

这类逻辑判断是否显示 entry。后端 projection 已经表达 scope，前端只做：

- archive/hidden/status filter 展示层过滤。
- display window 截断。
- runtime state overlay。
- continuity 保护。

如果需要区分 main/project aggregate 与 worktree-only，必须通过请求 scope 和后端返回的 projection metadata，而不是前端猜测。

### Decision 7: Title resolver 统一为纯函数

新增或提炼统一 title resolver：

```text
custom title
  > mapped title
  > native title / first real user message
  > previous meaningful title
  > stable engine fallback
```

弱 fallback 如 `Claude Session`、`Agent N` 不得覆盖已有 meaningful title。Sidebar、Settings、Curtain 使用同一 resolver 或同一映射结果。

### Decision 8: Unresolved ownership 不进入 strict membership

“不静默消失”不等于“塞进当前 workspace strict 列表”。当 Claude transcript 存在但 owner 不能唯一证明时：

- strict active projection MUST NOT 把该 transcript 当作当前 workspace session。
- catalog MUST 暴露 source diagnostic，至少包含 engine、reason、redacted physical locator 或 candidate count。
- related/global surface MAY 显示该 transcript，但必须标记 attribution confidence。
- folder/archive/title mutation MUST reject unresolved owner，避免把组织 metadata 写进错误 workspace。

#### Ownership 决策矩阵

| 输入事实 | 结果 | Evidence |
|----------|------|----------|
| `cwd` exact match known workspace | owner = exact workspace | `cwd-exact` |
| `cwd` 同时命中 parent 与 child | owner = longest path child | `cwd-longest` |
| `cwd` 缺失，Claude project dir 直接编码 workspace path | owner = mapped workspace | `project-dir-direct` |
| `cwd` 与 project dir 指向不同 known workspace | unresolved / conflict | `cwd-project-conflict` |
| 只知道 git root，且只有一个 workspace 匹配 | owner = matched workspace，低置信度 | `git-root-inferred` |
| 多个 sibling 同等匹配 | unresolved / ambiguous | `ambiguous-sibling` |
| storage 可达但 no matching candidate | authoritative empty 前置条件之一 | `scan-complete-no-match` |
| storage 不可达、cap、timeout、permission error | incomplete source | `source-incomplete` |

### Decision 9: C 作为 source-fact cache，而不是 membership index

本变更同时实现方案 C，但 C 的形态必须是 **read-through source-fact cache**：

```text
Claude JSONL
  -> fingerprint check
  -> cache hit: return bounded source facts
  -> cache miss/stale: parse JSONL summary and write cache
  -> ownership resolver
  -> catalog projection
```

缓存 key / fingerprint 使用：

```text
engine + physicalPath + fileMtime + fileSize + scannerVersion + schemaVersion
```

如需支持配置切换，cache namespace 还应包含 effective Claude home 或 engine config fingerprint。
如果未来 cache 记录 owner evidence，也必须带 `ownerResolverVersion` 与 workspace graph fingerprint；本轮更保守，默认不持久化最终 owner。

#### Cache 状态语义

| Cache state | 行为 | Source completeness |
|-------------|------|---------------------|
| hit | 使用 cached bounded facts，继续 resolver/projection | 按 facts 与 scan coverage 计算 |
| miss | direct scan 后写入 cache | 按 scan 结果计算 |
| stale fingerprint | direct rescan，替换 cache | 按 scan 结果计算 |
| corrupt entry | 忽略该 entry，direct rescan；记录 degraded diagnostic | 不得 authoritative empty |
| cache store unavailable | direct scan；记录 cache degraded | 不得因 cache 不可用清空会话 |
| rebuild requested | 删除/忽略旧 cache 后 bounded rescan | rebuild 期间 partial/degraded 可见 |

#### Cache 文件边界

cache 是派生状态，建议存放在 app data / runtime cache 目录，而不是 OpenSpec、Trellis、workspace metadata 或 `.omx` 事实源中。
cache 写入必须是 best-effort：写失败不能阻止 catalog 返回 direct scan 结果。

## Risks / Trade-offs

- [Risk] Backend catalog 改动范围大，可能影响 Codex/Gemini/OpenCode。
  → Mitigation: 先做 Claude source adapter 与 ownership resolver 的 additive refactor，保持现有 entry 字段兼容，Codex 路径只接入 shared type，不改变扫描语义。

- [Risk] 移除前端 native Claude list membership 后，catalog bug 会更直接影响 sidebar。
  → Mitigation: 引入 source completeness；在 `degraded/uncertain_empty` 下允许 last-good continuity，但标注 degraded，且 authoritative removal 仍优先。

- [Risk] stable metadata key 与旧裸 sessionId metadata 并存会带来迁移复杂度。
  → Mitigation: read compatibility + write-forward；只在 mutation/cleanup 时渐进清理旧 key，不做一次性全量迁移。

- [Risk] Claude transcript cwd 缺失时无法准确归属。
  → Mitigation: 使用 Claude project directory direct match 作为 fallback；仍无法唯一判断时返回 unresolved/degraded，不误归 owner。

- [Risk] bounded scan 下无法证明完整性。
  → Mitigation: cap 命中必须暴露 `partial`，前端不能把 omission 当 deletion。

- [Risk] source-fact cache 引入新状态源，可能固化错误 facts。
  → Mitigation: cache 只存 bounded source facts；membership、owner、metadata overlay 每次重新计算；cache entry 必须带 schema/scanner/fingerprint version。

- [Risk] corrupt cache 或 cache store unavailable 影响 listing。
  → Mitigation: cache 是 read-through acceleration，任何 cache 失败都 fallback direct scan，并暴露 cache degraded diagnostic。

- [Risk] cache 写放大或大历史首次 rebuild 影响前台响应。
  → Mitigation: page/cap 保持 bounded；cache write best-effort；首屏允许 partial/degraded，后续刷新继续补齐。

## Migration Plan

1. Contract baseline：补 spec delta、source status enum、owner evidence code、cache fact schema、fixture matrix。
2. Backend source facts：让 Claude scanner 返回 bounded facts / diagnostics / unresolved candidates。
3. Ownership resolver：集中 cwd、project dir、git root、workspace graph 的归属判断。
4. Catalog projection：接入 per-engine completeness、owner evidence、stable session key。
5. Metadata overlay：read compatibility + write-forward stable key，保持 existence 与 organization 分离。
6. Frontend projection consumption：移除 exact workspaceId filter，Sidebar 默认 membership 只消费 catalog。
7. Continuity/title：source-completeness aware continuity + shared title resolver。
8. Source-fact cache：加入 read-through cache、fingerprint invalidation、corrupt fallback、cache diagnostics。
9. Cache operations：提供 bounded rebuild / clear cache / diagnostic hooks，确保 cache 可删除可重建。
10. Regression gates：Rust fixtures、Vitest hooks/service/title/cache tests、typecheck/runtime contracts。
11. Closeout：更新 Trellis implementation guide，记录 residual 与 rollback 条件。

## Rollback

所有 API 字段按 additive 设计，旧前端可忽略新增 source health。若前端收敛后出现严重 regression，可以临时恢复 native Claude membership merge，但保留后端 source completeness 与 ownership diagnostics，以便继续定位。不得回滚到“successful empty 等于 authoritative empty”的语义。

Cache rollback 必须更简单：可以关闭 cache read/write 或删除 cache store，系统回到 direct scan + catalog projection。关闭 cache 不得改变 membership 语义，只允许影响性能。

## Implementation Calibration

- B 与 C 均已落地，但 C 被约束为 Claude source-fact cache，而不是 membership index。
- Codex 覆盖 B 的 shared catalog contract：类型、projection、stable key、metadata mutation routing 与 frontend display 均走同一口径；Codex scanner 语义保持原样，未引入 Codex cache。
- Source completeness 现在同时存在于 page-level `sourceStatuses` 与 entry-level `sourceCompleteness`。entry-level 用于单行 freshness，page-level 用于 last-good continuity 是否可清除。
- Claude authoritative empty 暂不激进生成。当前实现优先返回 `uncertain_empty`；如果 scan cap、invalid UTF-8/read error、unreadable path 或 malformed candidate 出现，则标记 `partial` / `degraded`，禁止把 omission 当作 deletion。
- Cache store 使用 app storage 下的 `session-management/source-fact-cache/<engine>` 派生目录。cache 丢失、损坏、fingerprint 缺失或 schema/version 不兼容都回退 direct scan。
- 大文件治理采用低风险拆分：测试从 `claude_history.rs` 移到 `claude_history_inline_tests.rs`，catalog projection 构建从 `session_management.rs` 移到 `session_management_catalog_projection.rs`，不改变 runtime API。

## Open Questions

- Claude transcript 缺失 `cwd` 且 Claude project dir 也无法唯一匹配时，UI 是否需要一个显式 `Unassigned Claude Sessions` surface，还是仅在 global history 中显示？
- stable metadata key 是否需要在 Settings UI 暴露 debug 字段，便于定位跨 workspace collision？
- 是否需要 Settings 中的 “Rebuild Claude session cache” 操作？本轮未做用户入口；cache 删除后可自动 direct scan 重建，后续如加入口应放 diagnostics 而不是默认工作流。
