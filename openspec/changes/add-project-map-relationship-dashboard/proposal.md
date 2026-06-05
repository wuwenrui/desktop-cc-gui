# Proposal: Project Map Relationship Dashboard

## 中文导读

这份 proposal 的核心是定义“Project Map Relationship Dashboard”的产品与工程边界：
我们不做体验上的花架子，先把关系事实变成可以稳定消费的 `deterministic substrate`。
按钮、扫描、持久化、仪表盘、impact、stale、repair、Agent Read Plan 都是同一主线的连续链路，不允许做成“有 UI 没有闭环”。

## Context / 背景

当前 Project Map 关系能力虽然已有部分基础，但与实际执行需求（agent read 优先级、变更影响、跨层桥接）之间存在差距：
- 多数关系是非确定性来源。
- 无全局统一扫描入口。
- Dashboard 目前更偏展示，不足以支撑 execution surface。

## Why now / 为什么现在做

- `Task Center`、`Project Map`、`AI generation` 需要统一关系底座，否则上层动作会出现“读文件集合不稳定”。
- 项目规模增长时，LLM-based 推断容易引入不可重复关系。
- 用户明确要求 `Project Map` 深挖，不做 Browser Dock 的支线。

## Goals / 目标

1. 在 Project Map 视图中增加 `Scan Relationships` action。
2. 实现 deterministic scan pipeline（files / imports / exports / tests / styles / specs / docs / bridge）。
3. 将扫描结果写入磁盘 `project-map-relations`，采用分层存储。
4. 显示 relationship dashboard（selected file neighborhood, module/hotspot, impact, stale, repair）。
5. 产出 Agent Read Plan 并持久化。
6. 保留 UA 的有价值 skill 观念（understand/dashboard/diff/explain/onboard/chat/domain）但不引入 UA schema。
7. 实现 full scope（分批交付），不缩范围。

## Non-goals / 非目标

- 不处理 Browser Dock trusted observation。
- 不引入 Understand-Anything 的持久化 schema。
- 不引入第三方 graph storage。
- 不在本轮实现全量行为能力（只做关系 substrate + consumption contracts 的完整闭环）。

## Solution summary / 方案摘要

采用 `storage + scanner + dashboard + context pack` 的四层实现：
- Scanner 产出 deterministic facts。
- Storage 进行 atomic 写入与 repair。
- Dashboard 消费 index summary。
- Agent Context 使用 context-pack 作为默认输入。

## 关键能力映射（Capability Mapping）

- `project-map-relationship-storage`
  - 定义 storage root、manifest、写入边界、schema 与 artifact 集合。
- `project-xray-panel`
  - 提供关系扫描按钮与交互状态、文件邻域、impact 与 stale/repair。
- `project-map-incremental-generation`
  - 将关系 scan 作为 generation 的事实输入，禁止覆写。
- `composer-context-project-resource-discovery`
  - 复用 context packs，避免重复广域扫描。

## Design options（方案对比）

### Option 1: 全量复用现有 `project-map` dataset

- 优点：改动最小。
- 风险：事实与语义混合，难做 repair/stale/incremental。

### Option 2: 引入 UA `knowledge-graph.json`

- 优点：可快速拿到 graph model。
- 风险：绑定外部 schema、维护耦合、迁移负担。

### Option 3: 自有 `project-map-relations` 层（推荐）

- 优点：保持 mossx 领域契约，分层存储。
- 优点：关系事实可单独治理，稳定驱动 dashboard 与 Agent。
- 缺点：初期实现量略大，但可控且可分批。

### 选择

选择 Option 3。

## Product behavior（用户体验）

- 空态：无扫描数据时 dashboard 显示引导 CTA。
- 扫描中：显示运行阶段、文件扫描计数、忽略数量。
- 扫描失败：分类错误（permission/path/parser/storage/timeout）。
- 有数据：展示 selected-file graph neighborhood + filters + hotspots + impact。

## Risk control / 风险控制

- Path safety：强制 root 白名单，拒绝越界。
- ID 稳定性：canonical id。
- Dangling edge：repair quarantined，不污染主索引。
- Stale：manifest + fingerprint + commit。
- 错误处理：可恢复错误给出重试建议。

## Success criteria（验收标准）

- 成功扫描 active workspace 并持久化关键 artifact。
- Dashboard 可展示 selected file neighborhood。
- Impact overlay 可标注 changed / affected / unmapped。
- Stale/repair 可见且可理解。
- Composer 可消费 context pack。
- 与现有 Project Map 数据兼容，不出现高风险破坏。

## 规模与交付承诺 / Scope & Commitment

- 这不是 MVP 裁剪版。虽然可分 batch 并行推进，但 scope 保持完整。
- 文档层面同步后，下一步可直接进入 implementation。


## 中文+English 术语对照（Proposal Glossary）

- Deterministic Scan / 确定性扫描
- Relationship Substrate / 关系事实底座
- Scan Source of Truth / 关系真相源
- Project Resource Discovery / 项目资源发现
- Agent Context / 代理上下文
- Storage Root / 持久化根目录
- Run Metadata / 运行元数据
- Repair Quarantine / 修复隔离区
- Fresh / 最新可用
- Stale / 过期
- Incremental Generation / 增量生成

