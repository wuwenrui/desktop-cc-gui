## Context

当前 Project Map evidence 能力已经有两个层次：

- 节点详情中展示 source/evidence chips，并支持 file-backed chip 打开编辑器。
- Context/impact/governance utilities 可以从节点、relations、changed files、spec/task metadata 派生解释信息。

缺少的是“文件视角”。当用户要审计图谱是否可信时，按节点看 evidence 太碎；按文件聚合才能快速发现高影响文件、孤立 evidence、stale source、以及某个文件支撑了哪些节点。

## Goals / Non-Goals

**Goals:**

- Build a derived file evidence index from loaded Project Map dataset and adjacent projections.
- Add Project Map Evidence Files UI for file grouping, file detail, node reverse focus, and open-file action.
- Preserve read-only semantics and avoid new backend persistence in MVP.
- Handle degraded/non-file evidence explicitly.

**Non-Goals:**

- No semantic embeddings.
- No repository-wide background crawler.
- No automatic Project Map mutation.
- No source file editing feature beyond existing editor navigation.

## Decisions

### 1. Evidence file index is derived, not a new truth source

#### 决策

Add a pure utility such as `buildProjectMapEvidenceFileIndex(dataset, options)` that returns normalized file entries:

```ts
type ProjectMapEvidenceFileEntry = {
  path: string;
  displayPath: string;
  sourceKinds: ProjectMapSourceKind[];
  nodeLinks: ProjectMapEvidenceNodeLink[];
  relationLinks: ProjectMapEvidenceRelationLink[];
  governanceLinks: ProjectMapEvidenceGovernanceLink[];
  lineRefs: ProjectMapEvidenceLineRef[];
  staleCount: number;
  lowConfidenceCount: number;
  degradedCount: number;
};
```

MVP recomputes this index from current panel data via memoization. It is not written as a persisted `.json` semantic artifact.

#### 原因

The source of truth already exists in node sources, related artifacts, relations, governance links, and impact input. Persisting a second evidence-file artifact would create drift before the UX proves stable.

### 2. Path normalization must be workspace-relative and conservative

#### 决策

Only explicit file paths or clearly path-like workspace refs enter the file index. Hashes, conversation ids, spec ids, task ids, package names, and free-text labels stay in a non-file bucket unless a concrete path is present.

#### 原因

The current project already has a rule: do not fake file links. Evidence Files must keep that contract.

### 3. UI uses a compact explorer inside ProjectMapPanel

#### 决策

Add an Evidence Files tab/section in the Project Map side panel:

- File list: path, related node count, evidence count, source-kind badges, stale/low-confidence markers.
- File detail: related nodes, line refs, relation/governance evidence, degraded refs.
- Actions: open file, focus node, highlight related nodes, clear highlight.

The UI should not replace the graph. It adds an evidence browsing mode layered on existing graph highlight/focus state.

#### 原因

Project Map remains the primary graph surface. Evidence Explorer is a companion index, not a new navigation shell.

### 4. Reverse focus uses existing graph selection/focus mechanics

#### 决策

Selecting a related node from file detail should call existing node focus/selection logic. Missing nodes render disabled/degraded links. Highlight state remains panel-local unless existing view-state persistence already supports a safe transient key.

#### 原因

Avoid a second navigation model. Reuse graph selection so tours, path finder, search, impact, and evidence explorer converge.

### 5. Sorting and filtering are deterministic

#### 决策

Default sorting:

1. higher related node count
2. higher evidence count
3. stale/low-confidence markers
4. path lexical order

Filters:

- source kind
- stale / low-confidence / degraded
- selected-node-only
- search path text

#### 原因

This gives users useful ordering without needing model ranking.

## Risks / Trade-offs

- [Risk] Some evidence refs have ambiguous path-like labels.
  - Mitigation: only promote explicit or strongly path-like refs; keep ambiguous refs in non-file evidence.

- [Risk] File explorer adds panel density.
  - Mitigation: use collapsible/compact rows and reuse existing Project Map visual language.

- [Risk] Derived index can become expensive on very large maps.
  - Mitigation: memoize by dataset identity/version and use simple O(nodes + relations + evidence) grouping.

- [Risk] Users may infer file list is a full repository explorer.
  - Mitigation: copy should say Evidence Files, not Project Files.

## Migration Plan

1. Add evidence file index types and utility.
2. Add focused utility tests for path normalization and grouping.
3. Add Evidence Files UI section and empty/degraded states.
4. Wire file -> node reverse focus and related-node highlighting.
5. Wire open-file action through existing Project Map evidence navigation path.
6. Add minimal i18n/styling.
7. Run focused tests, typecheck, and OpenSpec validation when implementation starts.
