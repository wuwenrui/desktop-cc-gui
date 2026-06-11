## Why

现有 `接口 API` 视图已经能显示 endpoint、group、参数和基础 evidence，但交互和信息密度仍停留在早期概要态：三栏宽度不可精细调整，endpoint card 像 graph node 而不是接口列表，右侧 inspector 缺少 Swagger-like 的请求/响应结构化阅读体验。

该功能尚未上线，因此可以整体重构 API contract view 与 discovery 输出 contract，不需要为旧 UI 形态保留兼容包袱。现在重构可以把多语言 scanner 的输出统一收敛到稳定的 API contract model，避免后续上线后再做破坏性迁移。

## 目标与边界

- 重构 `接口 API` tab 的三栏布局：左侧保持默认宽度，中间接口列表与右侧详情默认对半，三栏均支持拖拽调整。
- 将中间区域从多列 endpoint card 调整为单列 endpoint row：每行一个接口，不换行，不展示底部标签，优先展示中文注释或代码注释摘要。
- 将右侧 inspector 重构为 Swagger-like endpoint detail：接口描述、Swagger/OpenAPI/annotation 描述、请求参数、request body、response body、schema/evidence 分区结构化展示。
- 重构 API discovery 输出，补齐注释、Swagger-like 描述、请求入参结构和返回体结构，让 Java、Python、Go、TypeScript/JavaScript、C#、Rust、C/C++、OpenAPI、protobuf、GraphQL 都遵循统一展示 contract。
- 支持接口文档导出，格式可选 Markdown、HTML、OpenAPI，导出内容按 Swagger-like 结构组织。
- 删除底部无业务价值的 `Repair / Read issues` 红框区域，保留真正有价值的 scan status / evidence / repair metadata 在 inspector 或顶部摘要中展示。

## 非目标

- 不引入 graph database 或全量 compiler-grade 多语言语义分析。
- 不把 API contract graph 合并进 Project Map semantic graph。
- 不实现完整 OpenAPI editor、在线调试、mock server 或 API request runner。
- 不把 OpenAPI 导出伪装成完整人工维护规范；导出只能表达 scanner 已有证据和明确 unavailable。
- 不为每个语言设计独立 UI；语言差异只能进入 scanner adapter 和 evidence metadata。
- 不伪造描述、入参、返回体或调用链。缺少证据时 UI 必须显示 unavailable/unknown，而不是生成推测文案。

## What Changes

- API layout：三栏改为可拖拽 split panes，默认比例为左侧既有宽度、中间和右侧 `1:1`。
- Endpoint list：中间区域改为 group 上下文 + 单列 endpoint rows；endpoint row 显示 HTTP method、path、handler/method name、comment summary；移除现有底部 tags 展示。
- Endpoint detail：右侧 inspector 改为 Swagger-like 分区，包含 Overview、Description、Parameters、Request Body、Responses、Schemas、Evidence、Confidence/Source。
- Scanner contract：`ApiEndpoint` 增加或规范化 description fields、doc comment、annotation description、structured request/response schema fields，normalizer 必须兼容旧 artifact 缺字段。
- Multi-language extraction：Java/Spring 等 annotation、OpenAPI/Swagger schema、protobuf/gRPC、GraphQL、FastAPI/Flask/Django、Express/Nest/Fastify、Go routers、ASP.NET、Rust web frameworks、C/C++ handler table 均输出统一 contract；低置信 fallback 需显式标注 parser source 与 confidence。
- API export：从当前 workspace 的完整统一 `ApiContractGraph` 生成 Markdown、HTML、OpenAPI 3.0 JSON 三种导出内容；Markdown/HTML 面向阅读，OpenAPI JSON 面向机器消费，三者都使用 redacted evidence 和 Swagger-like section。
- Bottom issues removal：删除当前 API tab 底部 `Repair / Read issues` 问题 chip 区域，避免把低价值扫描噪音作为主 UI。

## 技术方案对比

| 方案 | 做法 | 优点 | 缺点 | 结论 |
|---|---|---|---|---|
| A. 微调现有 card/inspector | 在当前多列 card 和简单 inspector 上追加字段 | 改动最小 | 旧布局的信息架构不适合 Swagger-like detail，后续会继续堆叠复杂度 | 不采用 |
| B. 整体重构 API tab presentation contract | 保留 artifact model，重做三栏 split、endpoint list、Swagger-like detail，并扩展 scanner 字段 | 符合未上线阶段，能一次性建立稳定阅读模型 | 改动面更大，需要 focused tests 锁定 | 采用 |
| C. 引入外部 Swagger UI 组件 | 将 endpoint detail 交给 Swagger UI 类库 | 成熟、视觉接近目标 | 多语言 fallback artifact 不一定是 OpenAPI spec；样式和 Tauri 内嵌集成成本高 | 不采用 |

## Capabilities

### New Capabilities

- 无。本次是在既有 Project Map API capability 上做上线前重构，不引入平行 capability。

### Modified Capabilities

- `project-map-api-contract-view`: 修改 API tab 的布局、endpoint list、endpoint detail、bottom issue 区域和 Swagger-like structured inspector 行为。
- `project-map-api-contract-discovery`: 修改 API scanner 输出 contract，要求提取并保留代码注释、Swagger-like annotation 描述、请求参数结构和返回体结构。

## Impact

- Frontend:
  - `src/features/project-map/components/ProjectMapRelationshipSection.tsx`
  - `src/features/project-map/components/ProjectMapRelationshipWorkspaces.tsx`
  - `src/features/project-map/components/projectMapRelationshipApiModel.ts`
  - API export helper，可放在 `src/features/project-map/components/projectMapRelationshipApiModel.ts` 或 feature-local `utils`
  - `src/features/project-map/utils/relationshipDashboardModel.ts`
  - `src/features/project-map/types.ts`
  - `src/styles/**` 中 Project Map relationship/API 样式
  - `src/i18n/locales/**` API tab 文案
- Backend:
  - `src-tauri/src/project_map_api_contracts.rs`
  - `src-tauri/src/project_map_api_contracts_tests.rs`
  - 如跨层字段变化触及 `src-tauri/src/project_map_relations.rs` 或 context pack，则同步保持旧字段兼容。
- Runtime/storage:
  - API artifact schema 增量扩展；旧 artifact 缺字段时 frontend normalizer 必须 fallback。
  - 不改变 API artifact namespace，不迁移现有 relationship artifacts。
- Dependencies:
  - 默认不新增前端依赖。
  - Scanner 仍优先使用现有 Rust/serde/tree/fallback substrate；如后续引入 parser dependency，需单独评估维护活跃度。

## 验收标准

- API tab 默认呈现左/中/右三栏，左侧默认宽度保持既有体验，中间和右侧默认对半，三栏均可拖拽调整宽度。
- 中间 endpoint 区域一行只展示一个接口，path 不换行，底部 tags 不再出现，存在中文注释或代码注释时展示短描述。
- 右侧 endpoint detail 至少展示接口描述、Swagger-like 描述、parameters、request body、responses、schema/evidence/confidence；参数和返回体必须是结构化 UI，而不是单段文本。
- API tab 提供导出入口，用户可选择 Markdown、HTML 或 OpenAPI JSON 格式；第一版默认导出当前 workspace 的完整 API contract graph，不默认只导出当前选中 group 或当前 filter 结果。
- Markdown/HTML 导出内容按 Swagger-like 文档结构展示接口描述、parameters、request body、responses、schemas、evidence/confidence。
- OpenAPI 导出固定生成 OpenAPI 3.0 JSON document；缺失字段不得编造，低置信或缺证据内容必须保留为扩展 metadata 或 unavailable 信息。
- Scanner 对支持语言输出统一字段：path、method、operation/method name、doc comment、annotation description、parameters、request body、responses、source evidence、confidence。
- 缺少描述、入参或返回体 evidence 时，UI 显示明确 empty state，不生成假数据。
- 底部无意义 `Repair / Read issues` chip 区域从 API tab 主视图移除。
- Focused frontend/Rust tests 覆盖 layout/list/detail/scanner normalizer 的核心行为。
