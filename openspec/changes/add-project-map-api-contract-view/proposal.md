## Why

Project Map 当前能解释文件关系，但不能稳定回答“这个项目对外暴露了哪些接口、接口入参出参是什么、接口背后的方法链路如何走”。当接口数量增长时，简单列表或全量平铺图会迅速失效，用户需要一个跨语言、可分层 drill-down 的 API contract graph。

## 目标与边界

- 新增 Project Map 第四个 tab：`接口 API`，用于展示项目内可发现的 HTTP / RPC / GraphQL / ABI 风格接口。
- 扫描项目时新增独立 API contract scan branch，不复用或污染现有 file relationship scan 结果。
- API discovery 必须采用通用 adapter 架构，第一阶段覆盖 Java / Kotlin、Python、Go、C、C++、TypeScript / JavaScript、C#、Rust，以及 OpenAPI / Swagger、protobuf / gRPC、GraphQL schema。
- API view 必须支持层级划分，默认按 `协议 -> 微服务/模块/包/namespace -> controller/router/service -> endpoint` 聚合；左侧使用可折叠层级导航承载 service/module 与 controller/router，中心区域只展示 endpoint，不重复渲染 controller 卡片。
- 每个 endpoint 必须尽量展示接口信息、path/query/header/body/cookie 入参、status code/content-type/error response 出参、描述、使用场景、源码位置、证据、置信度和方法链路。
- C / C++ 等语义不统一的语言必须显式标注 `confidence` 与 `evidence`，不能把弱推断伪装成确定事实。
- API scanner 必须复用 workspace ignore 与依赖目录跳过规则，避免扫描 `node_modules`、`target`、`build`、`dist`、`vendor`、generated code、binary 或超大文件。
- API evidence excerpt、schema example、header、cookie、token、password 等敏感内容必须经过 redaction 后再进入 UI。
- API scanner 不允许手写多语言语法 parser。实现应优先使用成熟 parser / compiler API / schema parser 提供 syntax tree 或 descriptor，自研部分限定在 adapter contract、endpoint identity、evidence/confidence、method chain candidate、storage 和 UI graph。

## 非目标

- 不在本变更中引入第三方 graph database。
- 不要求第一阶段对所有框架做到 100% AST 级精确解析。
- 不把 API contract graph 直接混入现有 Project Map semantic nodes。
- 不把接口视图做成单纯 endpoint table；table 只能作为局部辅助，不是主体验。
- 不为某个单一框架写死 UI 字段或扫描模型。

## What Changes

- 新增 API contract discovery pipeline：
  - 优先读取 OpenAPI / Swagger / protobuf / GraphQL schema 等强契约源。
  - 再通过成熟 parser / compiler API 提供的 AST、syntax tree 或 descriptor，让语言 adapter 识别 route annotation、decorator、macro、router registration、handler function 和 request/response model。
  - 输出统一 `ApiEndpoint`、`ApiGroup`、`ApiParameter`、`ApiRequestBody`、`ApiResponse`、`ApiContractGraph`、`ApiCallChain` 数据结构。
  - 使用 canonical endpoint identity 合并强契约源与源码推断结果，避免同一接口重复渲染。
- 新增 parser sourcing 原则：
  - OpenAPI / Swagger 使用成熟 schema parser。
  - protobuf / gRPC 使用 protoc / descriptor / Buf 体系。
  - Python 优先使用官方 `ast`。
  - Go 优先使用官方 `go/parser` / `go/ast`。
  - TypeScript / JavaScript 优先使用 TypeScript Compiler API 或同等级 AST parser。
  - C / C++ 优先使用 libclang / tree-sitter 等成熟 parser。
  - C# 优先使用 Roslyn。
  - Rust 优先使用 syn / rust-analyzer 生态能力或 tree-sitter。
- 新增多语言 scanner adapter contract：
  - Java / Kotlin：Spring MVC、WebFlux、JAX-RS、Micronaut、Quarkus 等。
  - Python：FastAPI、Flask、Django、DRF、typed function contract。
  - Go：net/http、Gin、Echo、Fiber、Chi、gRPC。
  - C：Mongoose、CivetWeb、libmicrohttpd、handler table、C ABI 风格接口。
  - C++：Drogon、Crow、Oat++、Pistache、RESTinio、Boost.Beast、gRPC。
  - TypeScript / JavaScript：Express、Koa、Fastify、NestJS、Next API routes。
  - C#：ASP.NET Core Controller / Minimal API。
  - Rust：Axum、Actix Web、Rocket、Warp。
- 新增 `接口 API` tab：
  - 复用 Project Map X-RAY 视觉语言。
  - 复用显式 zoom、layout、reset、inspector 折叠等图谱控制，但 API 视图的鼠标滚轮只用于滚动，不用于缩放。
  - 左侧默认展示可折叠 service/module -> controller/router 层级树。
  - 中心区域默认只展示 endpoint 卡片，并按 method / operation type / 当前选中分组进行局部聚合，不重复展示 controller grid。
- 新增 API Inspector：
  - 展示 path / method / protocol / framework / handler / source file。
  - 参考 Swagger / OpenAPI 的详情顺序展示 operation summary、path/query/header/body/cookie 入参、request body、request schema、status code、content-type、response schema、error response、description、usage scenario。
  - 展示 method chain / service chain / model chain。
  - 展示 confidence、evidence、redacted excerpt、未识别原因和源码跳转入口。
- 新增大规模接口的层级交互：
  - 左侧以可折叠 service/module tree 管理层级，点击 module 展开或收起 controller/router 子级。
  - 点击 controller/router 后，中心只刷新该局部 endpoint 列表。
  - 支持按 protocol、module、namespace/package、controller/router、risk/confidence 过滤。
  - endpoint 数量超过 50 时必须启用 group-only first render 与聚合计数；31-50 之间可显示 group 与当前选中 group 的 endpoint；30 以内可直接显示 endpoint，但仍必须保留 breadcrumb/group context。

## 技术方案对比

### Option 1: 只做框架专项扫描

- 优点：单框架落地快，例如 Spring Boot / FastAPI 可以很快展示接口。
- 缺点：和用户目标不符，会把 API 视图做成特例堆叠；后续支持 Go / C++ / Rust 时 UI 和数据模型会不断分叉。

### Option 2: 只消费 OpenAPI / proto / GraphQL schema

- 优点：契约强、准确率高、实现稳定。
- 缺点：很多代码库没有维护完整规范文件；无法覆盖隐式 router、handler chain 和实际源码链路。

### Option 3: 通用 API contract graph + 多语言 adapter（推荐）

- 优点：统一数据模型，语言和框架只是 evidence provider；UI 只消费通用 contract graph。
- 优点：可以同时吸收强规范文件和源码推断结果，接口链路可逐步增强。
- 优点：天然支持层级聚合，适合大项目接口规模。
- 缺点：初期实现量更大，必须明确 confidence/evidence，避免误判。

### 选择

选择 Option 3。原因是该需求的核心不是“扫几个接口”，而是为 Project Map 建立跨语言接口契约层。只有 adapter 架构能同时满足通用性、可解释性和后续扩展。

### Parser sourcing decision

选择“成熟 parser + 自研 contract graph”。成熟 parser 负责语法树和 descriptor，自研层负责 API contract normalization、evidence/confidence、canonical identity、method chain candidate、storage artifact 和 group-first UI。这样避免手写 parser 的维护灾难，也避免把外部工具 schema 直接变成 mossx 持久化模型。

## Capabilities

### New Capabilities

- `project-map-api-contract-discovery`: 定义多语言 API contract discovery pipeline、adapter contract、统一 API graph 数据模型、证据与置信度规则。
- `project-map-api-contract-view`: 定义 Project Map `接口 API` tab、层级 graph 展示、API inspector、大规模接口分组与 drill-down 行为。

### Modified Capabilities

- `project-map-incremental-generation`: Project Map generation / scan flow SHALL be able to consume API contract scan artifacts as source-backed evidence without flattening API contracts into existing semantic nodes or deleting existing Project Map knowledge.

## 验收标准

- 扫描项目时，API contract discovery 与 file relationship scan 分支相互独立，任一分支失败不应静默污染另一分支结果。
- 存在 OpenAPI / Swagger / proto / GraphQL schema 时，系统优先从强契约源生成 API endpoints，并保留来源证据。
- 对 Java / Python / Go / C / C++ / TypeScript / JavaScript / C# / Rust 项目，系统至少能通过 adapter 产出可解释的 endpoint 或 handler candidate，并标注 language、framework/protocol、source file、confidence、evidence。
- 对声明支持的每种语言，第一阶段必须至少提供 adapter skeleton、fixture、skip reason 与 handler candidate 输出能力；深度框架识别可分阶段增强，但不能完全缺席 C / C++ 等主流语言。
- 多语言源码解析必须优先使用成熟 parser / compiler API / schema parser；若某语言暂时没有可用 parser adapter，必须记录 unsupported reason，不能回退为大段 regex parser 并冒充 AST 级解析。
- Project Map tab 区域出现第四项 `接口 API`。
- endpoint 数量超过 50 时，接口视图默认只展示层级 group graph 和聚合边，不能直接渲染全部 endpoint 节点。
- 用户可以从 group drill down 到 endpoint，再打开 inspector 查看 path/query/header/body/cookie 入参、status code/content-type/error response 出参、接口信息、描述、使用场景和方法链路。
- 用户在 API 视图中通过左侧可折叠 module/service tree 选择 controller/router 后，中间区域必须只展示接口 endpoint，不允许再额外平铺 controller 卡片。
- 弱推断结果必须显示 confidence 与 evidence，不能与强契约结果混为同等确定性。
- description 与 usageScenario 必须来自 schema summary、doc comment、route name、README/example、test evidence 或显式 inference 标记，不能无来源生成。
- Evidence excerpt 与 examples 必须脱敏后展示，尤其是 Authorization、Cookie、token、password、secret、api key 等字段。
- API graph 必须支持显式 zoom、reset、layout 切换和 inspector 折叠；鼠标滚轮必须保持滚动语义，不得触发 API graph 缩放。
- API scan artifacts 必须保持 workspace ownership，不得因工作区切换写入错误项目。

## Impact

- Frontend：
  - Project Map relationship / X-RAY tab 结构。
  - API graph canvas、group drill-down、API inspector、i18n 文案、large graph rendering。
- Backend / worker：
  - Project scan orchestration。
  - 多语言 API adapter。
  - API contract artifact 持久化、manifest、stale/repair metadata。
- Storage：
  - 新增 API contract scan artifacts，固定落在 `project-map-relations/<storage-key>/api-contracts/` 独立 namespace，复用 relationship storage ownership，但不污染 file relation artifacts。
- Tests / validation：
  - OpenSpec strict validation。
  - 前端类型检查。
  - Rust backend check / focused tests。
  - 重点 adapter fixture tests。
  - 大量 endpoint 的分层渲染 smoke test。
