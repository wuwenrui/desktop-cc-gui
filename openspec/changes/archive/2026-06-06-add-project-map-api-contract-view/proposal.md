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
- API tab 复用 relationship dashboard 顶部搜索框，但输入语义切换为 API contract query；命中 endpoint 时保留 module/controller ancestor groups，命中 group 时保留可展开子树。
- API tab 下隐藏文件关系专用的 role/type/noise filters，避免文件角色过滤误导接口视图。
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

## 阶段性评估 / Stage Assessment（2026-06-06）

### 中文导读

本节记录 `add-project-map-api-contract-view` 在阶段推进后的 proposal 校准。
结论：当前方向没有跑偏，但实现状态必须拆成三个层次：`API View Alpha` 已进入可读可交互阶段；`fallback-pattern scanner substrate` 已能产出低到中置信度候选；`mature parser / strong contract adapter / method chain` 仍是下一批 P0 深水区。

### 当前完成度 / Current progress

- OpenSpec task progress：`13 / 48` fully complete。
- Partial substrate progress：`2.3 / 4.0 / 4.1-4.8` 已有代码雏形或 fallback-pattern 覆盖，但尚未满足 task 定义的 mature parser、adapter registry、fixture validation 与 unsupported/no-candidate reason 要求，因此暂不勾选。
- 已完成主链路：
  - Project Map relationship dashboard 已出现第四个 `接口 API` tab。
  - API empty state、scan status summary、localized labels 已落地。
  - API graph mapper 已能把 `ApiContractGraph` artifact 映射为 UI nodes / edges。
  - group-first rendering 已实现，支持 `<=30` endpoint direct、`31-50` selected-group reveal、`>50` group-only first render。
  - group drill-down、explicit zoom/reset/layout、mouse wheel scroll semantics 已进入 API view contract。
  - endpoint inspector 已展示 protocol、method/path、framework、handler、source file、parameters、request/response、description、usage scenario、confidence、redacted evidence。
  - group inspector 已展示 endpoint count、protocol/language/confidence distribution 与 drill-down affordance。
  - API artifact namespace、redaction utility、parser source metadata、independent API scan branch 已有阶段性实现。
  - 后端 `project_map_api_contracts` 已能基于现有 scanned file contents 生成 `api-contracts/latest.json`，并写出 endpoints / groups / schemas / chains 分离索引。
  - 当前 scanner 主要依赖 `fallback-pattern` route detection，覆盖 Java/Kotlin、Python、Go、TypeScript/JavaScript、C#、Rust、C/C++ 的部分 route-like pattern，但这不是完整 adapter matrix。

### 对齐确认 / Alignment check

| Proposal target | Current status | Calibration |
|---|---|---|
| 独立 API contract scan branch | 已开始 | 对齐。API branch 已写入独立 artifact namespace；branch status、ownership mismatch、scope、merge 仍需补强。 |
| 通用 API contract graph | 已开始 | 对齐。UI 已消费统一 graph model；Rust 侧仍以 JSON artifact builder 为主，shared compile-safe domain model、ownership、stale、merge 仍需闭环。 |
| 多语言 adapter 架构 | 部分 substrate | 有 fallback-pattern 多语言候选提取，但尚无 mature parser wrapper、adapter registry、unsupported/no-candidate reason、fixture matrix，不能宣称完成。 |
| 强契约源优先 | 未完成 | 仍是正确方向。OpenAPI / protobuf / GraphQL adapter 还未闭环。 |
| group-first API view | 已实现 Alpha | 对齐。默认不平铺大规模 endpoint。 |
| API Inspector | 已实现 Alpha | 对齐。endpoint/group inspector 已可用；method chain inspector 与 filter/search hierarchy reveal 仍未完成。 |
| evidence/confidence/redaction | 已开始 | 对齐。redaction utility 已完成；fallback-pattern evidence 存在，成熟 parser source evidence 与 strong/weak merge 仍需补全。 |

### 校准发现 / Calibration findings

- 未跑偏：当前 UI 没有把 API endpoint 平铺注入 Project Map semantic graph，仍保留 API contract layer 与 semantic graph 的边界。
- 未跑偏：当前视图坚持 group-first graph + inspector，而不是降级成 endpoint table。
- 已补充：API artifact namespace 与 redaction utility 先行落地，为后续 scanner/parser 接入提供了安全边界。
- 已补充：当前代码已经能从 relationship scan 的 `file_contents` 分支生成 API artifact，并在 manifest 中记录 endpoint/group 计数。
- 已补充：当前后端 scanner 具备 fallback-pattern route extraction，但 parser source 固定偏弱，不能满足 proposal 中“成熟 parser + adapter contract”的完成标准。
- 已补充：API tab 的顶部文本搜索已接入 endpoint/group projection，并隐藏文件关系 role/type/noise filters；完整 protocol/language/framework/controller/confidence filter matrix 仍保持为未完成项。
- 需要保留为风险：canonical endpoint identity、strong contract merge、workspace ownership mismatch、stale/repair metadata 仍未闭环。
- 需要保留为风险：Java / Kotlin、Python、Go、C、C++、TS/JS、C#、Rust 目前只有 fallback-pattern 候选逻辑，尚未形成 adapter skeleton + mature parser + unsupported/no-candidate reason 的完整 matrix，不能宣称多语言扫描已完成。
- 需要保留为风险：method chain 目前仍缺少 evidence-rich chain inspector，不能把 handler 后续链路作为已交付能力。
- 需要保留为风险：filters 与 search result hierarchy reveal 尚未闭环，大型 API graph 的定位能力仍需下一批补齐。
- 需要保留为风险：`callChains` 目前仍为空数组输出，UI 不应展示 synthetic chain narrative。

### 当前阶段判断 / Phase judgement

当前实现可定义为：

`API View Alpha + fallback-pattern scanner substrate: contract graph presentation + group-first drill-down + endpoint inspector + low/medium confidence route candidate artifact`

它已经满足“用户能看到 API tab、理解 group-first 接口图、从分组进入 endpoint、查看接口详情和 redacted evidence”的阶段目标；
也能在部分代码库中从 fallback-pattern route evidence 产出 endpoint/group artifact；
但还不能定义为完整 API discovery 交付，因为 mature parser adapter、strong contract adapter、endpoint merge、method chain、filter/search hierarchy、generation integration、scan scope 与 ownership/stale gate 仍未闭环。

### 下一阶段建议 / Next calibrated batch

1. 优先完成 `1.1 / 1.3 / 2.2 / 2.3 / 2.4 / 4.0`，把 shared data model、ownership、scope、identity merge、adapter skeleton 先闭环。
2. 把现有 fallback-pattern scanner 降级为 adapter fallback，而不是继续让它承担 primary parser 角色。
3. 再推进 OpenAPI / protobuf / GraphQL 强契约 adapter，避免先陷入弱源码推断。
4. 完成 method chain inspector 与 filter/search hierarchy reveal，补齐 API view 的可解释链路与定位能力。
