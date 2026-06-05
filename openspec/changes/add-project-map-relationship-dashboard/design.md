# Design: Project Map Relationship Dashboard

## 中文导读

本设计把 Project Map 的关系能力定义为一条 `scan -> persist -> view -> consume` 的闭环链路。
技术上以“分层持久化 + immutable snapshot + deterministic source 标记 + repair quarantine”为核心，避免关系事实随 AI 输出漂移。

## Context / 当前系统背景

mossx 已有 Project Map 的基础关系与分析能力，但关系资产在本次需求下要满足 4 个强约束：
1. 一键扫描当前 workspace。
2. 本地磁盘落盘（全局 sibling root）。
3. 前端仪表盘快速展示。
4. 能为 Agent 提供可执行的上下文输入。

## System goals（系统目标）

- 建立 `project-map-relations` 关系扫描子系统。
- 提供关系 Dashboard 的读取体验，不牺牲现有性能。
- 与现有 AI generation 形成 clear boundary。
- 为未来的 explain/diff/onboard/chat/domain 动作提供事实底座。

## Non-goals（明确不做）

- 不依赖 UA schema。
- 不将关系扫描直接写入现有 semantic dataset。
- 不替代现有 tests/style/spec 的现成能力。
- 不在本轮扩展到 Browser Dock。

## Architecture overview

```text
[Frontend UI]
  -> [project-map panel command invoker]
  -> [Tauri command: project_map_relationship_scan]
     -> [Ignore/Walker]
     -> [Language parsers]
     -> [Relation builder]
     -> [Validation + Repair]
     -> [Layered persistence]
  -> [Persistence read API]
  -> [Dashboard state]
  -> [Impact + Read Plan service]
  -> [Composer/Agent context bridge]
```

## 关系数据契约（Data Contract）

### 命名约束

- `ProjectMapRelationshipManifest`
- `ProjectMapScannedFile`
- `ProjectMapFileRelation`
- `ProjectMapRelationDashboardIndex`
- `ProjectMapRepairSummary`
- `ProjectMapImpactSummary`
- `AgentReadPlan`

### 主动声明字段群

- 所有关系 edge 都应有 `sourceKind: deterministic`。
- 每条关系有 `evidence[]`，包含文件路径、行号、证据片段。
- `generatedAt`, `scanRunId` 必须携带。
- `language/layer/role` 允许 `unknown`，但要记录 `parseStatus`。

## Backend design（Backend）

### 模块分解（建议）

- `src-tauri/src/project_map_relations/`
  - `mod.rs`: 对外入口、command 注册。
  - `commands.rs`: scan/read/clear。
  - `scanner.rs`: 文件遍历 + ignore。
  - `classifier.rs`: language/layer/role 分类。
  - `import_parser.rs`: TS/JS imports/exports。
  - `rust_parser.rs`: use/mod、module 分析。
  - `relation_builder.rs`: 文件关系组装。
  - `indexes.rs`: by-file/by-type 模块索引。
  - `impact.rs`: changed files 影响计算。
  - `persistence.rs`: atomic write/read/clear。
  - `validation.rs`: dangling / duplicate / inverted / unresolved。

### Storage design（存储）

- 采用目录化 artifact：manifest + files + relations + indexes + impact + repair + runs + context-packs。
- 使用固定 root：`project-map-relations/<storage-key>/`。
- `runs/latest.json` 指向最近一次扫描元数据。
- 文件内容分片（chunks）与 manifest 组合，前端按需加载。

### 命令 API（Tauri command）

- `project_map_relationship_scan(workspace_id, options)`
  - 入参包含：`forceFull`, `maxFiles`, `includeIgnoredHints`, `scanTimeoutMs`, `paths`。
- `project_map_relationship_read(workspace_id)`
  - 返回 summary/index + latest scan run。
- `project_map_relationship_clear(workspace_id)`
  - 安全清理关系数据。

### 错误模型

- `InvalidWorkspace`：未选择 active workspace。
- `PathViolation`：非法路径。
- `ParseFailure`：局部 parser 失败，不应中断整个扫描。
- `PersistenceFailure`：写入失败，返回可恢复信息，保留旧快照。
- `ValidationFailure`：记录到 repair，不阻塞主展示。

## Frontend design（前端）

### 交互流

1. 打开 Project Map。
2. 若未扫描，显示空态 CTA。
3. 点击 `Scan Relationships`。
4. 扫描中：状态条 + 阶段提示 + workspace 信息。
5. 扫描完成：刷新 dashboard data。
6. 选择文件：展示 neighborhood。
7. 可切换 filter/search。
8. 展示 impact/stale/repair。

### 组件与状态模型

- `ProjectMapRelationshipsPanel`（主容器）
- `RelationshipsScanButton`（按钮 + confirm/threshold）
- `RelationshipSummaryBanner`（generatedAt、runId、fileCount）
- `RelationshipTree`（files + module 按照索引树）
- `SelectedNeighborhoodView`
- `RelationFilterBar`
- `RelationshipHotspotPanel`
- `ImpactStaleRepairPanel`

### 性能约束

- Dashboard 优先读取 summary/index，不一次性加载所有 chunks。
- 支持分页/虚拟滚动（文件很多时）。
- 大文件展示采用渐进加载。

## Cross-layer consistency（跨层一致性）

- `storage summary` 与 `UI state` 应共享 `schemaVersion`。
- 若前端读到的 manifest 无法解析，不回退到旧数据。
- 失败退化：显示“重新扫描建议”，不展示虚假关系。

## UA lessons 复用点（实施映射）

- `understand` -> `scan action`
- `dashboard` -> `relationship panel`
- `diff` -> impact overlay
- `explain` -> selected neighborhood explain pack（关系证据）
- `onboard` -> guided read plan（后续）
- `chat` -> relationship-aware query input（后续）
- `domain` -> capability lens（后续）

## Security & safety（安全）

- 只读扫描，不执行任意代码。
- 严格路径白名单。
- 对非法路径/非法文件名直接拦截。
- 写入失败必须可恢复且幂等。

## Rollout / Migration

- 初始只支持 ts/js/rust 的关系解析；其他语言先进入 unknown/skip。
- 关系类型逐步扩展，不破坏既有 artifact contract。
- 前向兼容：解析器版本 + schema version 在 manifest 与每个文件中记录。


## 中文+English 术语对照（Design Glossary）

- Atomic Snapshot / 原子快照
- Relationship Graph / 关系图
- Evidence-anchored Edges / 证据锚定边
- Scan Pipeline / 扫描流水线
- Repair Pipeline / 修复流水线
- Dashboard Index / 看板索引
- Stale Reason / 陈旧原因
- Change Impact / 变更影响
- Bridge Relation / 桥接关系
- Context Pack / 上下文包
- Schema Contract / schema 契约

