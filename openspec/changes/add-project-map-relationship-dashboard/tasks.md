# Tasks: Project Map Relationship Dashboard（细化版）

## 中文导读

这份任务清单是可执行到“开工级别”的最小颗粒度计划。
我把 scope 切成 9 大阶段，每个阶段再拆成 5-8 个独立任务。
每条任务都有明确输入、输出和验收面，支持你按批次下发开发人力。

## 目标确认

- Scope：实现完整闭环，包含 scan -> persist -> dashboard -> impact/stale/repair -> Agent Read Plan -> context-pack consumption。
- 优先级：优先保证关系事实稳定性与 storage 边界。
- Delivery mode：可分批交付，但不缩减总需求。

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
