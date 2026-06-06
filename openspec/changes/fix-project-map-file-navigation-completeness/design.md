## Context

`ProjectMapRelationshipSection` 当前把 relationship snapshot 的 file list 同时用于 Graph rail 和 Files workspace。实现上 `relationshipDashboardFilteredFiles` 先按 role / relation count 排序，再通过 `PROJECT_MAP_RELATIONSHIP_LIST_LIMIT` 裁剪到 120；Graph rail 又二次 `slice(0, 32)`。这适合 graph readability，但不适合作为 File Explorer。

用户在数千文件项目中看到 scan summary 已有 3308 files，但左侧 File Tree 只显示 32 个文件，Files workspace 也最多覆盖 120 个文件。这个状态会制造“扫描不全”的错误认知。

## Goals / Non-Goals

**Goals:**

- 将 Graph rail 明确为 bounded Top Files projection。
- 将 Files Explorer 改为 full scan-backed projection。
- 保留现有 filters/search/noise toggle 的行为，但让 count 文案表达清楚：scanned、matching、rendered/top。
- 用轻量分组和默认 per-group cap 控制渲染规模，避免几千文件一次性铺满 DOM。
- 不改变 relationship scanner、storage schema 或 Tauri command contract。

**Non-Goals:**

- 不实现 backend pagination。
- 不改变 ignore policy 或 scanner `maxFiles`。
- 不引入新 UI dependency。
- 不把 scan snapshot 合并进 Project Map semantic graph。

## Decisions

### Decision 1: Split projections instead of increasing the existing list limit

Use separate projections:

- `relationshipDashboardMatchingFiles`: full filtered set after query/role/noise filter.
- `relationshipDashboardTopFiles`: ranked and capped set for graph rail.
- `relationshipDashboardExplorerFiles`: full filtered set for Files Explorer grouping.

Alternatives considered:

- Increase `PROJECT_MAP_RELATIONSHIP_LIST_LIMIT` from 120 to a larger number.
  - Rejected because it keeps one list serving two different UX meanings and will regress again with larger projects.
- Remove all caps everywhere.
  - Rejected because graph and DOM rendering can become noisy and slow.

### Decision 2: Rename graph rail semantics

Graph rail copy becomes `Top Files` / `高相关文件`, with a count that includes top count, matching count, and scanned count.

Alternatives considered:

- Keep `File Tree` copy and only fix Files workspace.
  - Rejected because Graph rail is still bounded and ranked; calling it File Tree remains misleading.

### Decision 3: Keep full explorer frontend-only for this change

The backend already reads `files/chunks-000.json` into the dashboard response, and current observed project size is within a frontend-memory repair range. This change avoids a cross-layer API expansion.

Alternatives considered:

- Add paginated relationship file command now.
  - Deferred because it would require Rust command, service mapping, type contract, and tests. It is valuable for tens-of-thousands-file projects, but unnecessary for this bug fix.

### Decision 4: Group first, cap per group by default

Files Explorer groups by module label or first path segment. Each group can render a bounded subset while counts show group totals; search narrows the full set before grouping.

Alternatives considered:

- Virtualize the full tree immediately.
  - Deferred because current structure is grouped sections, not a flat virtual list. A simple group cap fixes accidental DOM explosion without adding dependency or layout rewrite.

### Decision 5: Top Files rail uses semantic grouping, not flat pagination

The graph rail organizes Top Files as `role -> module/path segment -> files`. Role and module groups are collapsible; each second-level group renders a small bounded subset by default and exposes an additional expand/collapse affordance for files inside that group. The first role/module path opens by default, and a selected file's role/module path stays visible.

Alternatives considered:

- Add global previous/next pagination to the flat list.
  - Rejected because pagination hides the information scent; users still cannot reason about where controllers, services, tests, or modules live.
- Use the full directory tree inside the graph rail.
  - Rejected because the graph rail is still a graph-neighborhood recommendation surface. The full explorer belongs in the Files view.

## Risks / Trade-offs

- [Risk] Full filtered set computation over thousands of files can cost more than the previous capped projection. → Mitigation: keep computations memoized, reuse existing indexes, and only render capped group subsets by default.
- [Risk] Users may still expect every file visible without search. → Mitigation: show explicit group and total counts, and make search/filter operate over full scanned set.
- [Risk] Renaming existing i18n keys may affect tests or snapshots. → Mitigation: update zh/en locale values while preserving key names where possible.
- [Risk] Backend single chunk remains a future scale bottleneck. → Mitigation: proposal records backend pagination as non-goal/future improvement.

## Migration Plan

1. Add the delta spec requirement under `project-xray-panel`.
2. Refactor `ProjectMapRelationshipSection` list derivation into matching/top/explorer projections.
3. Update zh/en locale text for Top Files and Files Explorer counts.
4. Keep existing user state and file selection behavior intact.
5. Rollback is safe by reverting frontend and locale changes; no persisted data migration is involved.

## Open Questions

- Should Files Explorer groups become manually expandable/collapsible in the next iteration?
- Should relationship storage move from one `files/chunks-000.json` response to manifest-driven lazy chunk loading once projects exceed 10k scanned files?
