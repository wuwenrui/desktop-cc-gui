## Context

Project Map 现有关系扫描主要回答“文件之间如何相关”，但 API 理解需要回答另一类问题：项目暴露了哪些外部契约、接口入参出参是什么、handler 后面的调用链如何走、接口在业务里可能承担什么使用场景。

这个能力不能绑定单一语言或框架。真实项目可能同时包含 Java、Python、Go、C、C++、TypeScript、C#、Rust，也可能只有 OpenAPI、protobuf 或 GraphQL schema。设计上必须把语言扫描器降级为 evidence provider，把 UI 绑定到统一 API contract graph。

另一个关键约束是规模。接口数量一多，全量 endpoint 平铺图会变成不可读噪音。因此接口视图必须先展示层级 group，再允许用户逐层 drill down 到 endpoint 和 method chain。

## Goals / Non-Goals

**Goals:**

- 新增独立 API contract scan branch，与 file relationship scan 解耦。
- 建立通用 `ApiContractGraph` 数据模型，覆盖 HTTP / RPC / GraphQL / ABI-style API。
- 建立多语言 adapter contract，第一阶段覆盖 Java / Kotlin、Python、Go、C、C++、TypeScript / JavaScript、C#、Rust，以及 OpenAPI / Swagger、protobuf / gRPC、GraphQL schema。
- 在 Project Map 中新增 `接口 API` tab。
- 大规模 endpoint 默认采用 group-first rendering，不允许直接平铺所有 endpoint。
- Inspector 展示接口信息、入参、出参、描述、使用场景、源码证据、置信度和方法链路。

**Non-Goals:**

- 不引入 graph database。
- 不要求第一阶段对每种语言做到完整 compiler-grade analysis。
- 不把 API contract graph 直接合并进现有 Project Map semantic graph。
- 不做单框架定制 UI。
- 不让弱推断结果伪装为强契约结果。

## Decisions

### Decision 1: API scan 使用独立 artifact namespace

API contract artifacts SHALL 独立于 file relationship artifacts。落点固定为 `project-map-relations/<storage-key>/api-contracts/`，复用 relationship storage 的 workspace ownership 与 stale/repair 机制，但在 artifact namespace、manifest、index、run metadata 上保持隔离。

Alternatives considered:

- 复用现有 file relation artifact：改动小，但会混淆 file dependency 与 API contract。
- 直接写入 Project Map semantic nodes：展示方便，但会污染知识图谱，且难以处理 stale / repair。

选择独立 namespace，因为 API contract 是可扫描事实层，不是人工确认后的知识节点。

### Decision 2: 统一 graph model，adapter 只提供 evidence

核心模型以 `ApiEndpoint`、`ApiGroup`、`ApiSchemaRef`、`ApiCallChain`、`ApiEvidence`、`ApiContractGraph` 表达。adapter 不直接控制 UI，只产出候选 endpoint、schema、group 和 evidence。

推荐模型：

```ts
type ApiProtocol = "http" | "grpc" | "graphql" | "rpc" | "c-abi" | "unknown";

type ApiConfidence = "spec" | "high" | "medium" | "low";

type ApiParameterLocation = "path" | "query" | "header" | "cookie";

interface ApiParameter {
  name: string;
  location: ApiParameterLocation;
  required?: boolean;
  schema?: ApiSchemaRef;
  defaultValue?: string;
  example?: string;
  evidence: ApiEvidence[];
}

interface ApiRequestBody {
  contentType?: string;
  required?: boolean;
  schema?: ApiSchemaRef;
  examples?: string[];
  evidence: ApiEvidence[];
}

interface ApiResponse {
  statusCode?: string;
  contentType?: string;
  schema?: ApiSchemaRef;
  examples?: string[];
  isError?: boolean;
  evidence: ApiEvidence[];
}

interface ApiEndpoint {
  id: string;
  protocol: ApiProtocol;
  language: string;
  framework?: string;
  method?: string;
  path?: string;
  operationName?: string;
  handlerSymbol?: string;
  sourceFile: string;
  parameters: ApiParameter[];
  requestBody?: ApiRequestBody;
  responses: ApiResponse[];
  requestSchema?: ApiSchemaRef;
  responseSchema?: ApiSchemaRef;
  description?: string;
  usageScenario?: string;
  groupIds: string[];
  callChainIds: string[];
  confidence: ApiConfidence;
  evidence: ApiEvidence[];
}
```

Alternatives considered:

- 每种语言一套模型：短期直接，但 UI 会分叉。
- 只保存文本摘要：实现快，但不可搜索、不可过滤、不可做 graph。

选择统一模型，因为它把多语言复杂性限制在 adapter 层。

### Decision 2.2: 成熟 parser 负责语法树，自研层负责 contract graph

The implementation SHALL NOT hand-write full programming-language parsers. Language adapters SHALL prefer mature parsers, compiler APIs, or schema parsers:

- OpenAPI / Swagger: mature OpenAPI schema parser.
- protobuf / gRPC: protoc descriptor / Buf-compatible parser flow.
- Python: official `ast`.
- Go: official `go/parser` and `go/ast`.
- TypeScript / JavaScript: TypeScript Compiler API or equivalent AST parser.
- Java / Kotlin: JavaParser / Kotlin compiler PSI / tree-sitter level parser.
- C / C++: libclang or tree-sitter level parser.
- C#: Roslyn.
- Rust: syn / rust-analyzer ecosystem parser or tree-sitter.

Mossx-owned logic SHALL start after syntax/descriptor extraction: adapter contract, framework semantic matching, endpoint identity, evidence/confidence, method chain candidate, artifact storage, and UI graph. Regex MAY be used only as a localized fallback for simple pattern confirmation, not as the primary parser for a language family.

Alternatives considered:

- 手写多语言 parser：不可维护，且边界错误会非常多。
- 直接持久化外部 parser schema：短期省事，但会把 mossx storage 绑定到第三方工具。

选择 mature parser + mossx contract graph，因为它把底层语法复杂性交给成熟生态，同时保留产品语义的稳定控制权。

### Decision 2.1: endpoint identity 使用 protocol-specific canonical key

Endpoint merge SHALL use protocol-specific canonical identity:

- HTTP: `protocol + normalized method + normalized path + operationName/sourceRoot`。
- gRPC: `package + service + method`。
- GraphQL: `operationType + fieldName`。
- C ABI / RPC fallback: `symbol + normalized source/header path`。

Strong contract evidence and source implementation evidence SHALL merge into the same endpoint when identity matches. If identity is ambiguous, the scanner SHALL keep separate candidates and expose ambiguity evidence instead of force-merging.

### Decision 3: 强契约源优先，源码推断补充

扫描顺序 SHALL 为：

1. OpenAPI / Swagger / protobuf / GraphQL schema。
2. 框架语义：annotation、decorator、macro、router registration。
3. AST / symbol / regex fallback：handler function、request/response model、service call candidate。

强契约源的 confidence 可为 `spec`。源码推断根据 evidence 完整度降级为 `high / medium / low`。

Scanner scope SHALL reuse workspace ignore rules and skip dependency/generated/binary-heavy directories such as `node_modules`, `target`, `build`, `dist`, `vendor`, `.git`, generated code, binary files, and files above the configured max scan size. Every skipped bucket SHALL be countable in run metadata with a reason.

Alternatives considered:

- 只做源码推断：覆盖面高但误判多。
- 只做规范文件：准确但覆盖不足。

选择混合策略，因为真实项目的契约信息常常分散在 schema 与源码之间。

### Decision 3.1: description 与 usageScenario 必须 evidence-backed

`description` and `usageScenario` SHALL only come from schema summary/description, doc comments, route names, README/example references, tests, or explicit inference metadata. If no reliable source exists, the UI SHALL show an unavailable state instead of fabricating copy.

### Decision 4: group-first rendering 是默认交互

API view SHALL 默认按以下层级聚合：

`protocol -> module/package/namespace -> controller/router/service -> endpoint`

Rendering thresholds are fixed for the first implementation:

- `endpoint <= 30`: endpoint nodes MAY be shown directly, while breadcrumb/group context remains visible.
- `31 <= endpoint <= 50`: show group nodes and the selected group's endpoint nodes.
- `endpoint > 50`: initial render MUST show group nodes and aggregate edges only.

用户点击 group 后再展开下一层。搜索和过滤可以直接定位 endpoint，但默认图不平铺。这个模式参考成熟 API explorer / service map 的共同经验：先用 namespace/tag/controller 做信息架构，再在局部区域展开 endpoint 和调用链，避免 canvas 退化为节点噪音。

API tab 的文本搜索 SHALL 复用 relationship dashboard 顶部输入框，但语义必须切换为 API contract query。API query 命中 endpoint 时必须保留所属 module/controller ancestor groups；命中 group 时必须保留该 group 的可展开子树。文件关系视图的 role/type/noise filters 不得在 API tab 下继续展示为可用控件，避免误导用户。

Alternatives considered:

- 全量 endpoint graph：小 demo 好看，大项目不可用。
- 纯 table：密度高，但丢失链路和分组结构。

选择 group-first graph + inspector + optional list，因为它兼顾规模、结构和细节。

### Decision 5: method chain 以 candidate chain 表达

方法链路 SHALL 由 endpoint handler 出发，追踪 service、repository、model、outbound HTTP/RPC、event publish 等 candidate。第一阶段允许 conservative extraction，不要求跨语言完整调用图。

每条 chain edge MUST 带 evidence、confidence、direction 和 edge kind，不能只给自然语言结论。默认最大链路深度为 4；发现循环时必须截断并记录 `truncatedReason`，避免图谱无限扩张。

Alternatives considered:

- 不做 method chain：实现简单，但无法解释接口背后的代码路径。
- 做全量 call graph：工程量大且容易不稳定。

选择 candidate chain，因为它能先提供可解释价值，同时保留精度边界。

### Decision 6: evidence 展示前必须 redaction

Evidence excerpt, schema examples, headers, cookies, request samples, response samples, and README/test examples SHALL pass through redaction before entering UI artifacts. The redactor SHALL mask Authorization, Cookie, token, password, secret, api key, private key, credential and common env-style sensitive values.

Alternatives considered:

- 原样展示 evidence：调试方便，但容易泄露密钥。
- 完全不展示 excerpt：安全但解释力不足。

选择 redacted evidence，因为它保留可解释性，同时降低敏感信息泄露风险。

## Risks / Trade-offs

- [Risk] 多语言 parser 精度不一致 -> Mitigation: adapter 输出统一 confidence/evidence，UI 显示推断强弱。
- [Risk] C / C++ route 语义分散 -> Mitigation: 优先识别常见框架和 handler table，低置信度结果不作为确定接口。
- [Risk] endpoint 数量过多导致 canvas 卡顿 -> Mitigation: group-first rendering、阈值展开、虚拟化列表、聚合边。
- [Risk] 强契约源和源码推断重复 -> Mitigation: 使用 stable endpoint id 和 source priority merge，schema 来源优先。
- [Risk] 扫描依赖目录导致性能失控 -> Mitigation: workspace ignore、dependency/generated skip、file size cap、skipped reason metadata。
- [Risk] evidence 泄露敏感示例 -> Mitigation: redaction before UI artifacts。
- [Risk] 工作区切换导致 scan 写错位置 -> Mitigation: manifest storageKey 必须匹配启动时 workspace ownership。
- [Risk] API scan 与 file relation scan 失败相互影响 -> Mitigation: 分支隔离，artifact 独立，错误独立呈现。

## Migration Plan

1. 新增 API contract artifact namespace，不迁移现有 relationship artifacts。
2. 在 scan orchestration 中增加 API branch，默认可与 file relation scan 并行或串行执行，但写入互不依赖。
3. 新增 Project Map `接口 API` tab，在无 API artifact 时显示空态和扫描引导。
4. 将 OpenAPI / proto / GraphQL adapter 作为高可信入口，再逐步接入语言 adapter。
5. UI 默认显示 group graph，endpoint 详情只在 drill-down 或搜索命中后展示。
6. 若出现回归，可隐藏 `接口 API` tab 或关闭 API branch，不影响现有 file relationship dashboard。

## Open Questions

- 是否需要把 API graph 结果作为 Agent Read Plan 的高优先级 resource candidate。
- 是否需要为每种 adapter 建独立 fixture directory 与 focused test suite。

## Implementation stage notes（2026-06-06）

### 中文导读

本阶段设计校准的核心判断是：先把 `API contract graph` 的阅读界面做成稳定消费端，再继续补 scanner/parser provider。
这不是偏离原设计，而是把架构切成两个可验证层：`presentation contract` 与 `discovery contract`。

### Current implementation shape

```text
Project Map Relationship Dashboard
  -> API tab
  -> API graph mapper
  -> group-first rendering thresholds
  -> drill-down state
  -> endpoint/group inspector
  -> redacted evidence display

Project Map scan orchestration
  -> independent API branch started
  -> API artifact namespace started
  -> parser source metadata started
  -> redaction utility completed
  -> fallback-pattern route candidate extraction for several language families
  -> endpoints/groups artifact output
  -> empty schemas/chains artifact slots
```

### Design calibration

- UI SHOULD continue consuming `ApiContractGraph` as the only stable input model.
- Scanner adapters SHOULD remain evidence providers. They MUST NOT leak parser-specific schemas into persisted mossx artifacts.
- The API view SHOULD tolerate incomplete scanner output by rendering empty, partial, or low-confidence states instead of fabricating endpoint facts.
- Endpoint inspector SHOULD prefer unavailable/unknown states over generated filler copy when `description` or `usageScenario` lacks evidence.
- Group-first rendering remains the default for scale. Filters and search MUST preserve hierarchy rather than replacing the graph with a flat result table.
- Current backend extraction SHOULD be treated as `fallback-pattern` substrate only. It is useful as an early artifact producer, but it MUST NOT be used as evidence that mature parser sourcing or framework adapter coverage is complete.
- `callChains` currently remaining empty is an intentional truth boundary. The UI and generation layer MUST NOT invent method-chain narratives before evidence-rich chain edges exist.
- Existing skipped reason aggregation is useful, but scan scope completion still requires explicit dependency/generated/binary/max-size controls and focused fixtures.

### Next implementation batch

1. Complete domain model and ownership gate before adding more language-specific parser logic.
2. Implement protocol-specific canonical endpoint identity and strong-contract/source merge before deep framework adapters.
3. Register first-stage adapter skeletons for every declared language with explicit parser source metadata and unsupported/no-candidate reason.
4. Implement scan scope controls and skipped reason metadata so API scanning cannot regress into dependency/generated directory traversal.
5. Add method chain inspector after conservative chain extraction exists; do not show synthetic chain narratives before edge evidence is available.
6. Convert current fallback-pattern route detection into the lowest-priority adapter fallback behind OpenAPI/protobuf/GraphQL and mature language parser wrappers.

### Rollback boundary

If API discovery proves unstable in a real workspace, the API tab can continue showing the graph empty/partial state while the API branch is disabled or hidden.
This rollback does not affect existing file relationship scan artifacts or Project Map semantic graph because the artifact namespace and UI state are isolated.

## Parser wrapper plan（2026-06-07 implementation update）

The implementation now treats parser/schema tools as evidence providers behind a stable mossx adapter contract.

- OpenAPI / Swagger:
  - wrapper source: `serde_json` / `serde_yaml` schema document traversal.
  - parser source label: `schema-parser`.
  - persisted output: normalized `ApiEndpoint`, `ApiParameter`, `ApiRequestBody`, `ApiResponse`, `ApiSchemaRef`, and `ApiEvidence`.
- protobuf / gRPC:
  - wrapper source: `.proto` service/RPC contract traversal, with the future seam reserved for protoc/Buf descriptor output.
  - parser source label: `descriptor`.
  - persisted output: gRPC `ApiEndpoint` with request/response schema refs.
- GraphQL:
  - wrapper source: GraphQL schema operation type traversal, with the future seam reserved for a mature GraphQL schema parser.
  - parser source label: `schema-parser`.
  - persisted output: query/mutation/subscription endpoints.
- Language source adapters:
  - wrapper source: first-stage `ApiAdapterDescriptor` registry for Java, Kotlin, Python, Go, C, C++, TypeScript, JavaScript, C#, and Rust.
  - parser source label: currently `fallback-pattern` until compiler API / syntax tree parser wrappers are attached per language.
  - persisted output MUST NOT leak parser-native AST/schema types.

Design review checklist:

- Every adapter emits only shared API contract model fields.
- Every evidence record exposes `parserSource`.
- Strong schema sources may use `spec` confidence.
- Fallback-pattern language evidence cannot masquerade as compiler-grade AST evidence.
- Unsupported or no-candidate adapter states remain visible in artifact metadata.

## Adapter confidence limitations（2026-06-07 rollout note）

- OpenAPI / Swagger confidence:
  - `spec` confidence when endpoints come from `paths` in JSON/YAML contract files.
  - `$ref`, media type, parameters, request body, and response schemas are preserved when present.
  - Full OpenAPI semantic validation is not attempted in this change.
- protobuf / gRPC confidence:
  - `spec` confidence for service/RPC signatures found in `.proto` files.
  - Current implementation keeps a descriptor seam and emits descriptor-labeled evidence, but does not invoke external `protoc` / Buf during scan.
- GraphQL confidence:
  - `spec` confidence for `type Query`, `type Mutation`, and `type Subscription` fields in schema files.
  - Advanced schema constructs such as interfaces, unions, directives, and schema stitching remain best-effort.
- Language adapter confidence:
  - Java/Kotlin, Python, Go, TypeScript/JavaScript, C#, Rust, C, and C++ source adapters currently emit `fallback-pattern` evidence.
  - These adapters are intentionally conservative and cannot claim compiler-grade AST precision until parser wrappers are attached.
  - C and C++ route candidates remain low/medium confidence unless backed by strong schema evidence.
- Method chain confidence:
  - Chain edges are bounded, low-confidence, source-line-backed candidates.
  - Missing chains are explicitly represented with `method-chain-evidence-unavailable`; no synthetic service narratives are generated.
