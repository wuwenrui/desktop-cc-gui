# Tasks: Project Map Relationship Dashboard（细化版）

## 中文导读

这份任务清单是可执行到“开工级别”的最小颗粒度计划。
我把 scope 切成 9 大阶段，每个阶段再拆成 5-8 个独立任务。
每条任务都有明确输入、输出和验收面，支持你按批次下发开发人力。

## 目标确认

- Scope：实现完整闭环，包含 scan -> persist -> dashboard -> impact/stale/repair -> Agent Read Plan -> context-pack consumption。
- 优先级：优先保证关系事实稳定性与 storage 边界。
- Delivery mode：可分批交付，但不缩减总需求。

## OpenSpec 执行任务清单

- [x] Task 0：修正 OpenSpec strict validation 兼容性，确保 requirement 使用 `SHALL/MUST` 规范性措辞。
- [x] Task 1：建立 Project Map Relationship TypeContract，定义 manifest、file、relation、index、repair、impact、Agent Read Plan 类型。
- [x] Task 2：实现后端 `project-map-relations` storage root 解析，默认落点为 `~/.ccgui/project-map-relations/<storage-key>/`。
- [x] Task 3：实现 relationship storage path safety，复用/对齐 Project Map 现有路径白名单、保留名和 ownership 校验策略。
- [x] Task 4：实现 relationship snapshot persistence，支持分层 artifact、atomic write、read summary、clear API。
- [x] Task 5：实现 workspace scanner 输入层，覆盖 active workspace resolve、ignore policy、walker、ignored metadata。
- [x] Task 6：实现 file classifier，生成 language、layer、role、fingerprint、parseStatus。
- [x] Task 7：实现 TS/JS import/export parser，生成 deterministic imports/exports relation evidence。
- [x] Task 8：实现 Rust use/mod parser，生成 backend/module relation evidence。
- [x] Task 9：实现 relation builder，覆盖 tested_by、styled_by、specified_by、documents、configures、contains、bridges_to、related。
- [x] Task 10：实现 validation/repair/quarantine，处理 dangling、duplicate、direction、parse-failed 关系问题。
- [x] Task 11：实现 relationship read API 与 frontend service/hook，读取 manifest、indexes、repair、context-packs。
- [x] Task 12：在 Project Map 视图加入 `Scan Relationships` action、empty CTA、running/success/failure 状态。
- [x] Task 12A：架构纠偏为 Universal Project Relationship Core，确保未知项目先进入 inventory，manifest/config/docs/convention 先生成通用关系，语言 extractor 只作为增强层。
- [x] Task 13：实现 Relationship Dashboard MVP，覆盖 file/module tree、selected neighborhood、relation filters/search。
- [x] Task 13A：推进 Relationship Dashboard IA polish，覆盖默认降噪、角色过滤、关系优先级排序、短句化邻域 relation row。
- [x] Task 13B：固化并实现多视图 Dashboard，支持 UA-like Board / List / Neighborhood 三种 scan snapshot 展示方式。
- [x] Task 14：实现 impact overlay 与 hotspot panel，覆盖 changed/direct/affected/unmapped/risk flags。
- [x] Task 15：实现 Agent Read Plan 与 `context-packs/latest.json` 生成/读取。
- [x] Task 16：实现 stale detection 与 incremental refresh UX，覆盖 git commit、fingerprint、refresh suggestion。
- [x] Task 17：实现 UA-style actions 的 mossx 内化入口，覆盖 explain/diff/guided read/ask/domain 的 context pack 基础。
- [x] Task 18：打通 Composer/Agent resource discovery 对 Project Map relationship context-pack 的消费。
- [x] Task 19：完成 focused validation，更新 specs/tasks 状态，准备 verify/sync/archive。
- [x] Task 20：将 Relationship Dashboard 深化为 UA-like File Relationship Workspace，移除鸡肋 Chain tab，改为 Graph / Files / Read 三视图。
- [x] Task 20A：把 Board role lanes 替换为 path/module file tree，确保用户可以看到全部过滤后的文件。
- [x] Task 20B：把 Chain 一跳列表替换为 persistent Read path，直接展示 context-pack、impact、risk flags 与当前文件 calls/outgoing/incoming。
- [x] Task 20C：压缩 scan chrome 与说明文案，让 Graph 成为默认主视觉，Inspector 承担选中节点/边解释。

## 里程碑与任务

## Phase 0：准备与契约预热（P0）

- Task 0.1 定义任务序列与 owner 分配
  - 内容：把需求点拆成可执行任务清单，并确认 owner。
  - 验收：每个任务具备 owner、依赖、验收标准。
- Task 0.2 读写路径与 schema 边界复核
  - 内容：确认 `project-map-relations` 目录是否与现有 `project-map` 平级。
  - 验收：设计文档与实现里使用统一 `storage-key`。
- Task 0.3 UA 学到的坑位复用清单
  - 内容：明确必须避开的 12 个坑位（path、dangle、stale、overwrite）。
  - 验收：对应防线在 task 里有直接映射。

## Phase 1：数据模型与 TypeContract（P1）

- Task 1.1 新建 TypeScript 接口（mossx-native）
  - 产物：`ProjectMapRelationshipManifest` / `ProjectMapScannedFile` / `ProjectMapFileRelation` / `ProjectMapRelationDashboardIndex` / `ProjectMapRepairSummary` / `AgentReadPlan`。
  - 验收：字段覆盖 scan run、source、evidence、stale、repair。
- Task 1.2 完善 `storage-key` 与 workspace identity 规则
  - 产物：统一 workspace 身份提取规则。
  - 验收：同名项目在不同路径有不同 key。
- Task 1.3 新建 `relationship run` 与 `scan run` 契约文件
  - 产物：`runs/latest.json`, `scans/latest.json` schema。
  - 验收：时间戳、runId、fileCount、relationCount、ignoredCount、isFresh。
- Task 1.4 定义 repair schema 与 severity
  - 产物：repair issue type（missing-node/inverted/redundant/duplicate/unresolvable）。
  - 验收：每条 issue 至少包含 fileId/relationId/filePath/severity/message。
- Task 1.5 建立 `index manifest` schema
  - 产物：`files/manifest.json`, `relations/manifest` 的结构定义。
  - 验收：前端可先读 index，再按需加载 chunk。

## Phase 2：后端存储层（Backend Persistence）（P1）

- Task 2.1 实现 storage root 解析与创建
  - 内容：实现 `resolve_project_map_relations_root()`。
  - 验收：返回 `<app-home>/project-map-relations/<storage-key>/`。
- Task 2.2 实现 path 白名单校验
  - 内容：拒绝 `../`, 绝对路径, windows 保留名。
  - 验收：非法写路径直接失败并记录错误。
- Task 2.3 实现文件原子写（temp+rename）
  - 内容：write `*.tmp` 后 rename。
  - 验收：失败不破坏旧快照。
- Task 2.4 实现扫描结果分层落盘
  - 内容：manifest/profile/runs/files/chunks/relations/indexes/impact/context-packs/repair。
  - 验收：关键目录齐全，落盘后可独立读取。
- Task 2.5 实现 clear API 与清理策略
  - 内容：仅清理当前 storage-key 目录。
  - 验收：不会误删其他 workspace 数据。
- Task 2.6 实现读文件列表 API（摘要/全文）
  - 内容：read 返回 manifest + summaries + optional full.
  - 验收：空数据场景可读且稳定。

## Phase 3：扫描输入与 Ignore（P1）

- Task 3.1 实现 workspace 解析
  - 内容：active workspace root 获取与校验。
  - 验收：无 workspace 时返回明确错误。
- Task 3.2 实现 walker 与文件类型过滤
  - 产物：skip list（.git, node_modules, target, dist, build, out, binaries）。
  - 验收：过滤策略可配置，可记录忽略计数。
- Task 3.3 实现 `.gitignore` 覆盖机制
  - 内容：扫描前加载 `.gitignore` 并应用。
  - 验收：统计命中数量。
- Task 3.4 实现关系扫描显式 ignore 配置文件
  - 内容：支持 `project-map-relations.ignore` 或等效路径。
  - 验收：可选配置有效。
- Task 3.5 记录 ignored metadata
  - 内容：summary 中返回 ignore source 与命中明细。
  - 验收：Dashboard 能显示 ignored 的原因。
- Task 3.6 扫描进度事件
  - 内容：emit 阶段事件（scan_start/walk/import_parse/relationships/persist）。
  - 验收：前端可展示 progress。

## Phase 4：解析器与关系构建（P2）

- Task 4.1 TS/JS import/export parser
  - 内容：解析静态 import/export + type-only + re-export。
  - 验收：`imports` 与 `exports` 的方向正确。
- Task 4.2 Rust use/mod parser
  - 内容：解析 module use、mod、pub use。
  - 验收：至少支持基本 use-path 与模块边界。
- Task 4.3 test/style/spec/doc/config 关系识别
  - 内容：基于命名/路径规则 + 语义提示。
  - 验收：可识别 tested_by, styled_by, specified_by, documents, configures。
- Task 4.4 前后端 bridge 关系识别
  - 内容：识别 frontend API → Rust command module。
  - 验收：`bridges_to` 有 evidence。
- Task 4.5 模块 contain 关系构建
  - 内容：folder 或层级模块映射。
  - 验收：module 文件列表和跨模块边界统计可用。
- Task 4.6 fallback related 构建
  - 内容：为低置信度关系给出 conservative `related`。
  - 验收：不污染 high-confidence 关系。

## Phase 5：验证与修复（P2）

- Task 5.1 dangling edge 检测
  - 内容：source/target 指向不存在。
  - 验收：写入 repair 目录，不进入主 index。
- Task 5.2 direction 修复规则
  - 内容：tested_by 方向错误自动翻转。
  - 验收：可逆关系恢复后写入主 index。
- Task 5.3 duplicate dedupe
  - 内容：按 fingerprint/normalized key dedupe。
  - 验收：主 index 无重复 id。
- Task 5.4 invalid fileId 与 parse-failed 标记
  - 内容：记录 parse 失败且不阻塞主扫描。
  - 验收：report 包含 parse失败文件 + 错误。
- Task 5.5 repair summary 可追溯性
  - 内容：每个修复动作记录操作类型和依据。
  - 验收：repair/latest.json 可读。

## Phase 6：前端按钮与扫描状态（P2）

- Task 6.1 在 Project Map 视图加入 `Scan Relationships`
  - 内容：根据 workspace 状态显示启用/禁用。
  - 验收：无 workspace 禁用并展示提示。
- Task 6.2 空态 CTA 与第一次扫描引导
  - 内容：无数据时显示主 CTA。
  - 验收：点击 CTA 启动 scan。
- Task 6.3 扫描执行反馈（状态机）
  - 内容：Pending / Running / Success / Failed。
  - 验收：状态与 message 对齐。
- Task 6.4 扫描阈值确认
  - 内容：大范围扫描前弹确认（如超阈值文件数）。
  - 验收：可取消或继续。
- Task 6.5 错误分类展示
  - 内容：permission/path/parser/storage。
  - 验收：错误原因可读且可行动。
- Task 6.6 重新扫描策略
  - 内容：提供 partial/full/force。
  - 验收：用户可选择。

## Phase 7：Dashboard 渲染与筛选（P3）

- Task 7.1 左侧文件树与模块树
  - 内容：显示模块分组和文件计数。
  - 验收：可选展开收起。
- Task 7.2 中间邻域视图
  - 内容：selected 文件的 incoming/outgoing/tests/specs/styles/bridges。
  - 验收：无关系时显示 empty-state。
- Task 7.3 右侧 impact 面板
  - 内容：changed/affected/missing/unmapped。
  - 验收：与扫描 summary 一致。
- Task 7.4 relation type filter
  - 内容：按 imports/tests/specs/style/bridge/documents/related。
  - 验收：筛选结果仅留匹配关系。
- Task 7.5 搜索能力
  - 内容：按文件名、路径、module、role 搜索。
  - 验收：输入即时过滤。
- Task 7.6 热点面板
  - 内容：many dependents、missing-test、cross-layer-hub、stale。
  - 验收：有 score 与 reason。

## Phase 8：Impact / Read Plan / Context Pack（P3）

- Task 8.1 changed files 采集
  - 内容：来自 git status 或 caller override。
  - 验收：changed 映射到 relation scope。
- Task 8.2 transitive impact 计算
  - 内容：根据 relation graph 计算一阶到 n 阶影响。
  - 验收：可配置深度并有上限。
- Task 8.3 Agent Read Plan 生成
  - 内容：must-read / related / tests / contracts / risk flags。
  - 验收：含 provenance。
- Task 8.4 persistence 到 context-packs/latest.json
  - 内容：持久化 context pack。
  - 验收：可读可更新。
- Task 8.5 Composer 读取桥
  - 内容：若 fresh contextPack，可供 context discovery 复用。
  - 验收：无 fresh 时回退现有逻辑。

## Phase 9：Stale 与增量策略（P3）

- Task 9.1 commit hash 检测
  - 内容：与 manifest 保存 commit 比对。
  - 验收：差异导致 stale 提示。
- Task 9.2 file fingerprint 检测
  - 内容：content hash / mtime 变化检测。
  - 验收：局部 stale paths 显示。
- Task 9.3 增量扫描可用性
  - 内容：支持 changed list 增量扫描（可选）。
  - 验收：增量与全量结果一致性在一致阈值内。
- Task 9.4 stale 的扫描建议
  - 内容：显示建议类型（full / partial / ignore-only）。
  - 验收：用户可直接触发。
- Task 9.5 stale marker 渲染
  - 内容：dashboard 头部显示 `isFresh`。
  - 验收：清晰可见 stale。

## Phase 10：UA skill 等价动作（P4）

- Task 10.1 Explain selected file
  - 内容：构建 neighborhood explain pack。
  - 验收：包含 evidence lines。
- Task 10.2 Diff impact action
  - 内容：changed + affected 可视化。
  - 验收：变化范围可追踪。
- Task 10.3 Guided read tour（初版）
  - 内容：给出 entry point 顺序与首读路径。
  - 验收：可选执行。
- Task 10.4 Ask Project Map
  - 内容：通过关系索引回答文件/关系查询。
  - 验收：返回可读摘要 + evidence refs。
- Task 10.5 Domain/capability lens（预留）
  - 内容：基于 module + relation 构建能力分区。
  - 验收：不会改变 storage schema。

## Phase 11：跨层集成与兼容（P4）

- Task 11.1 与现有 Project Map dataset 协同
  - 内容：避免重复 source 覆盖。
  - 验收：现有视图功能不退化。
- Task 11.2 命令与 hook 兼容
  - 内容：scan/read 与现有生命周期对接。
  - 验收：工作流不阻塞其他命令。
- Task 11.3 日志与 metrics（最低可观测性）
  - 内容：记录 scan duration、parsed files、failures。
  - 验收：关键指标可查。
- Task 11.4 迁移与兼容测试方案
  - 内容：老数据无关系时兜底。
  - 验收：第一次进入功能可正常扫描。

## Phase 12：收口、验证与归档（P5）

- Task 12.1 文档与 spec 同步
  - 内容：proposal/design/tasks/spec 变更一致。
  - 验收：无关键冲突。
- Task 12.2 关键路径验收脚本草稿（非必须自动化）
  - 内容：manual script/instructions for verify。
  - 验收：可复现 scan->persist->view->read-plan。
- Task 12.3 用户验收演练
  - 内容：真实项目跑一轮。
  - 验收：按钮可见、扫描成功、关系可读。
- Task 12.4 结果归档提案与下一批排期
  - 内容：生成执行记录与风险清单。
  - 验收：可直接进入下一步实现。

## 任务优先级矩阵

- Must-have: 1,2,3,4,5,6,7,8,9。
- Should-have: 10,11。
- Could-have（后续）：10 中 10.5, 11.4。

## 交付说明

- 每个 phase 可独立提交并演进，但必须满足“扫描->存储->展示->消费”主链条。
- 推荐每阶段至少通过一次 manual smoke 验证：
  - 有 workspace
  - 成功扫描
  - dashboard 可读
  - context-pack 可导出

## 可执行任务卡模板（可复制到开发排期）

每条任务卡建议固定字段：
- 任务名：
- 目标：
- 输入：
- 输出：
- 执行者：
- 验收标准：
- 回滚方案：

示例：
- 任务名：Task 2.4 分层落盘实现
- 目标：实现 relationships/files/symbols/chunks 目录与 manifest 一致落盘
- 输入：扫描内存模型
- 输出：runs/latest、scans/latest、files/chunks、relations/latest、by-file、by-type
- 执行者：Backend
- 验收标准：扫描结束后目录结构满足规范，旧快照不被污染
- 回滚方案：清空该 storage-key 的新快照，复用上一个快照


## 并行任务排期建议（推荐 4 并发组）

> 注：仍按依赖执行，保证功能闭环，不拆减总量。

### Group A：Storage & Contract（后端基础）
- 任务负责人建议：Backend
- 依赖：Phase 0、Phase 1
- 交付前置：Task 1.1,1.2,1.3,1.4,1.5,2.1,2.2,2.3,2.4,2.5,2.6
- 价值：先把关系持久化、路径安全、原子提交、manifest 契约打牢。

### Group B：Scanner Core（后端主干）
- 任务负责人建议：Backend
- 依赖：Group A 完成
- 交付前置：Phase 3 + Phase 4 + Phase 5
- 价值：完成关系事实生成（files/relations/bridges）与修复质量红线。

### Group C：UI State & Scan Flow（前端）
- 任务负责人建议：Frontend
- 依赖：Group A
- 交付前置：Phase 6 + Phase 7
- 价值：按钮、状态流、过滤搜索、关系邻域和热点可视化先行可用。

### Group D：Impact, Stale, Context-Pack（跨层消费）
- 任务负责人建议：Frontend + Backend
- 依赖：Group A + Group B + Group C
- 交付前置：Phase 8 + Phase 9 + Phase 10
- 价值：形成 changed impact、Agent Read Plan、stale 展示和 context-pack 下沉。

### Group E：Cross-layer & Close（收口）
- 任务负责人建议：Frontend + Backend + PM/QA
- 依赖：Group D
- 交付前置：Phase 11 + Phase 12
- 价值：跨层对齐、文档更新、验收演练、归档。

### 分组执行建议（建议你直接下发）
- 第一阶段（T+1）：Group A、Group C（可并行）
- 第二阶段（T+2）：Group B（依赖 Group A）
- 第三阶段（T+3）：Group D（依赖 A/B/C）
- 第四阶段（T+4）：Group E 收口（依赖 D）

## 简化版排产模板（可直接复制）

- 任务ID：
- 分组：
- 负责人：
- 预计耗时（小时）：
- 依赖项：
- 产出文件：
- 失败回退：
- 验收标准：

## Corrective Phase 13：File Relationship Explorer 重构修复（2026-06-05）

### 中文导读

本阶段来自真实项目 smoke test 反馈：原 Dashboard 虽然能扫描，但默认展示过于抽象，刷新可信度不足，i18n 不完整，并且没有围绕“文件链路 / 方法调用链 / evidence line”组织体验。
本阶段目标是把关系视图从 `Relationship Dashboard` 校准为 `File Relationship Explorer`。

- [x] Task 13C.1：修复 refresh scope 语义，`full refresh` 不再继续携带 partial stale scope，避免刷新后仍被旧 changed scope 误导。
- [x] Task 13C.2：把 unmapped changed file 从 stale blocking reason 中拆为 `scan-scope-warning`，避免 ignored / out-of-scope 文件让 full refresh 看起来永远不生效。
- [x] Task 13C.3：补全 relationship i18n 文案，中文采用中文 + English 专业词汇混合，避免界面英文裸露。
- [x] Task 13C.4：重构默认 UI 为三栏 Explorer：左侧文件选择，中间 file/method chain，右侧 evidence inspector。
- [x] Task 13C.5：把 Impact / Hotspot / Agent Read Plan 从默认主视觉降级，不再抢占文件链路阅读。
- [x] Task 13C.6：增加通用 `calls` relation type，并优先展示 method/function call 关系。
- [x] Task 13C.7：实现通用 lightweight symbol/call extractor，覆盖 Java、JS/TS/Vue/Svelte、Python、Go、C/C++、Rust 等语言的基础符号与调用证据，不把 Java 作为唯一中心。
- [x] Task 13C.8：新增 symbols artifact 写入，为后续更强 method-level graph 和 chain reasoning 留出 mossx-native 扩展点。

## Corrective Phase 13D：Chain-first Explorer 体验闭环（2026-06-05）

### 中文导读

用户重新扫描后确认：13C 虽然开始改名为 `File Relationship Explorer`，但默认体验仍容易停留在 Board/统计看板，刷新语义也会被 changed scope 误导。
本阶段把验收标准进一步收紧为：扫描后默认进入 `Chain`，普通扫描必须是 full scan，主视图必须围绕文件链路、方法调用候选和 evidence inspector。

- [x] Task 13D.1：修复普通 `Scan Relationships` 默认携带 `changedFilePaths` 的问题，普通按钮恢复为 full workspace scan；只有 stale suggestion 为 `partial` 时才携带 paths/changedFiles。
- [x] Task 13D.2：扫描成功与读取最新 snapshot 后强制回到 `Chain` 主视图，避免旧 React UI state 继续停在 Board。
- [x] Task 13D.3：调整视图切换顺序为 `Chain -> Board -> List`，明确 Board 是辅助节点看板，不是默认关系阅读入口。
- [x] Task 13D.4：在 relation row 与 evidence inspector 中展示 `call candidate`，让 `calls` relation 至少暴露 method/function candidate，而不是只显示 file -> file。
- [x] Task 13D.5：压缩 scan metrics 视觉权重，扩大三栏 Chain Explorer 的阅读空间，降低统计噪音。
- [x] Task 13D.6：补充中英 i18n 文案，覆盖 Chain-first、Node Board、call candidate 等新 UI 语义。
- [x] Task 13D.7：调整 Chain relation 排序为 `calls -> outgoing -> incoming -> other priority`，确保方法/函数调用链优先于 imports/docs/config 等辅助关系展示。
- [x] Task 13D.8：将 Chain 列表升级为 `Calls / Outgoing / Incoming / Other` 分组阅读，减少混排噪音，让方法调用和文件依赖的阅读路径更清楚。

## Corrective Phase 13E：UA-like Graph Dashboard 图形化闭环（2026-06-05）

### 中文导读

用户明确反馈：关系视图不应继续走 list-first / chain-first，期望更接近 Understand-Anything 的图形化 dashboard。
本阶段将默认体验改为 `Graph-first`：文件是节点，关系是边，左侧文件导航辅助定位，右侧 Inspector 解释当前节点或边。
13D 的 Chain 分组保留为辅助视图，但不再作为默认主体验。

- [x] Task 13E.1：新增 `Graph 图谱` 视图并放到视图切换第一位，扫描成功与读取 latest snapshot 后默认进入 Graph。
- [x] Task 13E.2：把 scan snapshot 投影为 mossx-native graph view model，不引入 UA schema，不改变 `project-map-relations` artifact。
- [x] Task 13E.3：实现 UA-like 文件节点卡片：role color bar、type badge、basename、language/layer、in/out/all 统计、selected/neighbor/secondary 状态。
- [x] Task 13E.4：实现关系边可视化：SVG edge、arrow marker、edge label、calls 高亮、选中边高亮。
- [x] Task 13E.5：实现左侧文件导航 rail，点击文件后图谱聚焦该文件的一跳邻域。
- [x] Task 13E.6：实现右侧 Relationship Inspector，选中边时展示 source/target/call candidate/evidence，未选边时展示选中文件摘要。
- [x] Task 13E.7：保留 Board/List/Chain 作为辅助视图，Board 点击文件后回到 Graph，而不是继续进入 list-style Chain。
- [x] Task 13E.8：补充 Graph-first 中英 i18n 文案。
- [x] Task 13E.9：补充 proposal/design 中对 UA-like Graph Dashboard 的详细产品契约、复刻映射、验收标准和剩余 follow-up。
- [x] Task 13E.10：补充 graph lane labels 与 relation legend，让图谱方向和边类型更接近 UA 的图形化阅读体验。
- [x] Task 13E.11：补充 lightweight MiniMap，让图形化 dashboard 更接近 UA 的空间导航体验，同时不引入 ReactFlow 或 UA schema。
- [x] Task 13E.12：实现高密度关系降噪，限制每侧可见邻居节点并用 `+N incoming/outgoing` 聚合节点表示被折叠关系，避免大项目图谱变成线团。

## Corrective Phase 13F：Graph Fidelity / 图谱拟真度补强（2026-06-05）

### 中文导读

用户继续校准：当前关系视图需要更像 UA 的图形化 dashboard，而不是“节点边的静态截图”。
本阶段把 graph 聚合点、legend、density control 做成可操作控件，让用户在图上完成探索，而不是频繁回到列表或下拉框。

- [x] Task 13F.1：补充 proposal/design 对 `Graph Fidelity` 的产品契约，明确 aggregate node 与 relation legend 的交互语义。
- [x] Task 13F.2：实现 aggregate node 展开/折叠，`+N incoming/outgoing` 可控制对应方向的 visible neighborhood density。
- [x] Task 13F.3：实现 relation legend 过滤入口，点击 `All / calls / imports / tested_by` 直接复用现有 type filter。
- [x] Task 13F.4：补齐 Graph Fidelity i18n 文案，中文保持中文 + English professional terms。
- [x] Task 13F.5：补齐 Graph Fidelity CSS 状态，确保 aggregate control、legend active state、expanded hint 在视觉上清楚但不制造噪音。
- [x] Task 13F.6：选中关系 edge 时高亮 source/target endpoint nodes，并同步到 lightweight MiniMap，形成 `edge -> nodes -> inspector` 的阅读闭环。

## Corrective Phase 13G：Graph Workspace Layout / 图谱工作台布局（2026-06-05）

### 中文导读

用户确认 Graph-first 方向正确，但当前 UI 空间被辅助模块挤压，图谱看不全。
本阶段补齐“图谱工作台”基本能力：模块折叠、自适应视口、视图内拖拽平移。

- [x] Task 13G.1：补充 proposal/design 对 Graph Workspace Layout 的产品契约，明确 collapse、auto-fit、drag-to-pan 的边界。
- [x] Task 13G.2：实现 File Tree 与 Inspector 模块折叠，折叠后 graph canvas 自动回收空间。
- [x] Task 13G.3：实现 relationship graph canvas 的 presentation-only pan state，支持空白区域拖拽平移。
- [x] Task 13G.4：实现 graph content responsive wrapper，让 logical graph 在可用空间内自适应展示。
- [x] Task 13G.5：补齐 Graph Workspace Layout i18n 文案。
- [x] Task 13G.6：补齐折叠、拖拽、自适应相关 CSS，减少视觉噪音并扩大图谱可读区域。
- [x] Task 13G.7：将 graph layout controls 调整为单行 `icon + 文案` ghost action，避免按钮换行和视觉抢占。
- [x] Task 13G.8：将 graph layout controls 从 canvas header 移到 Graph Dashboard 上方独立 toolbar，避免与标题、聚焦文案和画布内容重叠。
- [x] Task 13G.9：将 Graph view switch row 与 layout controls 合并为同一视觉行，左侧切换视图、右侧控制 Files/Inspector/Reset，减少空白占位。
- [x] Task 13G.10：为 scan status / explorer rule / search-filter chrome 增加折叠控制，折叠后保留 compact summary，进一步释放 Graph canvas 空间。
- [x] Task 13G.11：将 Graph 视图下的 scan chrome 默认设为折叠 mini-header，并在 stale 时保留轻量 refresh 入口，确保释放画布空间但不隐藏关键恢复动作。
- [x] Task 13G.12：扩大 relationship graph logical canvas 到 `1320x760`，让 dense project 节点有足够布局空间。
- [x] Task 13G.13：重写 incoming/outgoing lane 的 Y 坐标计算，按 lane 可用高度分配节点间距，并把 aggregate node 放入底部保留区。
- [x] Task 13G.14：收紧 expanded side visible limit，避免点击展开后立即出现节点重叠，剩余关系继续通过 `+N` aggregate 表达。
- [x] Task 13G.15：强化 drag-to-pan：空白画布拖拽移动 graph stage，edge/node/legend/control click 不触发 pan，并增加 panning 视觉反馈。
- [x] Task 13G.16：将 file search 提升到 Graph toolbar 常驻入口，并在搜索命中时自动聚焦首个匹配文件，修复“列表过滤但图谱不变”的体验问题。
- [x] Task 13G.17：新增 Graph zoom in / zoom out / reset controls，使用 `auto-fit scale * user zoom` 模型，保留响应式自适应同时支持手动缩放。
- [x] Task 20D：修复 UA-like Graph 画布布局回归，确保 Files / Inspector 折叠时 graph canvas 占满主区域，不被 focused grid 覆盖压成左侧窄列。
- [x] Task 20E：升级 Graph 右侧 Inspector 为文件详情面板，展示选中文件 metadata、关系分组、edge evidence、context-pack 快捷入口，并接入现有打开文件能力。
- [x] Task 20F：精简 Graph Inspector 文件详情交互，移除顶部打开按钮，将 source/target 打开改为 icon action，并让 incoming/outgoing/total metrics 可点击反向定位关系。
- [x] Task 20G：增强 Graph Inspector 打开文件定位，source/target action 在 evidence path 匹配时携带 evidence line，Evidence 卡片继续直达具体证据行。

## Corrective Phase 13H：Explorer Chrome / Navigation Intent Split / Editor Feedback（2026-06-06）

### 中文导读

本阶段来自用户连续确认后的 UI/交互细化：文件关系视图已经进入 graph-first workspace，但顶部 chrome、节点点击语义、source/target 打开定位和主题/i18n 仍需要收口。
本阶段目标是把 `File Relationship Explorer` 作为 Project Map 内的独立 deterministic scan workspace 固化下来：进入文件关系时隐藏旧 semantic-map 噪音，Graph 点击只做详情，显式 icon 才做链路跳转，source/target 打开能回到具体代码行，并且目标行有短时视觉反馈。

- [x] Task 20H：将 `文件关系 / File Relations` 选中态移动到 Project Map 左侧主槽位，替换 `总览`，让用户进入关系视图后第一视觉就是 `File Relationship Explorer`。
  - 输入：Project Map 顶部 active entry state。
  - 输出：relationship active 时显示 `文件关系 Explorer` 摘要。
  - 验收：文件关系选中后，左侧不再显示 `总览` 作为主入口。

- [x] Task 20I：隐藏 relationship-focused header 中的旧 semantic-map counters。
  - 输入：active entry 为 `fileRelations`。
  - 输出：节点、Lens、候选等旧统计在文件关系 focused 状态下隐藏。
  - 验收：用户不会把 deterministic file relationship snapshot 与 Project Map semantic graph 统计混读。

- [x] Task 20J：合并 relationship summary 到单排 header，并去掉独立边框/卡片感。
  - 输入：relationship scan summary、metrics、fresh/stale state。
  - 输出：一排 compact status metadata。
  - 验收：顶部不再出现“选中 tab 后下面又多一行边框卡片”的视觉断层。

- [x] Task 20K：移除 relationship inline summary 内重复的 `扫描关系 / Scan Relationships` 按钮。
  - 输入：全局 Project Map toolbar 已存在 scan action。
  - 输出：relationship summary 不重复渲染 scan button。
  - 验收：扫描入口只保留在全局/top recovery path，避免冗余按钮并排。

- [x] Task 20L：拆分 graph node 点击语义，节点 body click 只切换右侧 Inspector 详情。
  - 输入：Graph node card click。
  - 输出：`inspectedRelationshipFileId` 更新，`selectedRelationshipFileId` 不被普通点击强制改写。
  - 验收：用户可以连续点不同节点查看右侧详情，而不会每次都触发 graph focus/link traversal。

- [x] Task 20M：在 graph node 右侧新增 jump icon，并让 icon click 同时负责 graph focus 和 Inspector 同步。
  - 输入：Graph node jump icon click。
  - 输出：设置 selected file、inspected file，并清空 selected edge。
  - 验收：显式点击 icon 才做链路跳转；跳转后右侧详情与图谱焦点一致。

- [x] Task 20N：为 relationship graph edges 增加方向箭头效果。
  - 输入：visible direct edges / aggregate edges。
  - 输出：SVG edge 上显示 direction arrow。
  - 验收：用户能直接看出 source -> target 方向，而不是只看到无向线段。

- [x] Task 20O：替换 `Graph 图谱` view switch 的 radio-like 圆点 icon 为 mini graph glyph。
  - 输入：Graph view switch button。
  - 输出：图谱语义 icon。
  - 验收：图标不再像未选中的 radio control，视觉语义更贴近关系图谱。

- [x] Task 20P：核实并补齐文件关系视图 i18n。
  - 输入：relationship graph/read/inspector/action/context 可见文案。
  - 输出：新增/替换 locale keys，中文界面使用中文 + English professional terms。
  - 验收：关系视图无主要硬编码英文裸露；中英语言切换语义一致。

- [x] Task 20Q：核实并补齐文件关系视图深色、浅色、自定义主题适配。
  - 输入：Project Map relationship CSS、inspector CSS、Project Map root theme tokens。
  - 输出：relation calls/imports/tests/inspected/info/core 等颜色抽成 CSS variables，并减少 naked color 直接散落。
  - 验收：dark/light/custom theme 下 arrow、edge label、selected/inspected node、legend、inspector 状态可见。

- [x] Task 20R：修复 Inspector `Open Target` 未跳到目标方法定义行的问题。
  - 输入：selected `ProjectMapFileRelation`、call candidate、relationship `symbols` artifact、target file。
  - 输出：优先解析 target symbol line 并通过 `onOpenEvidenceFile(path, { line, column })` 打开。
  - 验收：有 target symbol 时打开 target 文件直接定位到方法/函数定义行；无 symbol 时 fallback 到 evidence line 或只打开文件。

- [x] Task 20S：为编辑器文件打开跳行增加单行背景闪烁反馈。
  - 输入：editor navigation target line。
  - 输出：CodeMirror transient line decoration，2 秒内闪烁 3 次后自动清除。
  - 验收：打开文件并跳行后，用户能一眼看到目标行；闪烁不污染 Git markers、annotations、diff markers 或持久编辑器状态。

- [x] Task 20T：固化本轮实现事实到 proposal / design / tasks。
  - 输入：本轮已完成 UI、navigation、theme、i18n、editor feedback 改动。
  - 输出：OpenSpec artifact 记录产品校准、设计契约和完成任务。
  - 验收：后续 verify/archive 能直接引用 `13H` 作为本轮校准依据。
