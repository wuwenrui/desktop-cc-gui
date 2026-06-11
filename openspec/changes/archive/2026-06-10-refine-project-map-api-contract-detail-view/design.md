## Context

`接口 API` tab 当前建立在 `ApiContractGraph` artifact 之上，已经具备 endpoint/group/schema/callChain 的基础消费路径。但现有 UI 仍偏向早期 graph/card demo：中间区域多列 endpoint card 信息混杂，右侧 inspector 更像元数据摘要，无法承载用户按 Swagger 方式阅读接口详情的主任务。

本功能尚未正式上线，因此最优解不是在旧 card 上继续打补丁，而是稳定两层 contract：

```text
Scanner adapters
  -> Unified ApiContractGraph artifact
  -> Frontend normalizer
  -> API tab presentation model
  -> Split layout + endpoint list + Swagger-like inspector
```

核心约束：UI 不绑定具体语言，scanner 不输出 UI 专用结构；所有语言只产出统一 contract 与 evidence/confidence。缺少证据时显示 unavailable，不生成假描述。

## Goals / Non-Goals

**Goals:**

- 建立上线前稳定 API tab 信息架构：left navigator、center endpoint list、right Swagger-like detail。
- 支持三栏拖拽布局，默认左侧维持既有宽度，中间与右侧对半。
- 将 endpoint list 从多列 card 改为单列 row，优先展示接口方法、path、handler 和中文/代码注释摘要。
- 将 endpoint detail 分区结构化展示：描述、注解描述、parameters、request body、responses、schemas、evidence、confidence。
- 扩展 scanner 输出字段，统一多语言 API 描述、参数结构、返回结构、Swagger/OpenAPI-like metadata。
- 支持从 `ApiContractGraph` 导出 Markdown、HTML、OpenAPI 三类接口文档，内容参考 Swagger 文档结构。
- 保持旧 artifact 向前兼容：旧字段缺失时 frontend normalizer 提供安全 fallback。

**Non-Goals:**

- 不做 API request runner、mock server、OpenAPI editor。
- 不引入新 graph database 或重做 Project Map semantic graph。
- 不要求第一阶段所有语言达到 compiler-grade analysis。
- 不给每种语言写独立 inspector UI。
- 不把底部 scan/repair 噪音迁移成另一个常驻主面板。
- 不实现在线接口调试、mock server、OpenAPI 可视编辑器或完整 OpenAPI lint/validator。

## Decisions

### Decision 1: API tab 改为 splitter-driven 三栏布局

采用 feature-local splitter state 管理三栏宽度。左侧默认宽度沿用当前模块树视觉宽度；中间与右侧使用剩余宽度 `1:1`。拖拽时对每栏做最小/最大宽度 clamp，并在当前 session 内保持稳定。

Alternatives considered:

- 使用 CSS grid 固定比例：实现简单，但不能满足三栏拖拽。
- 引入 split-pane dependency：功能完整，但当前需求可用少量 feature-local pointer handler 实现，新增依赖收益不足。

选择自研轻量 splitter，因为它只服务该 feature，不增加依赖面。

### Decision 2: 中间区域改为 endpoint list，而不是 graph/card grid

中心区域的主要任务是快速扫 endpoint 并选中详情。使用单列 row 可以避免 path 换行、卡片高度漂移和每行多个接口造成的阅读跳跃。group-first hierarchy 仍由左侧 navigator 承载，中心区域只渲染当前 group 的 endpoint rows。

Alternatives considered:

- 继续多列 card：视觉密度高，但 path/handler/description 会互相挤压。
- 表格：适合密集信息，但描述与 HTTP method badge 的可读性弱，且与现有 Project Map 视觉语言割裂。

选择 endpoint row list，因为它接近 API explorer，又能保留当前设计系统风格。

### Decision 3: Inspector 使用 Swagger-like section model

右侧 detail 不直接拼 JSX，而先构建 `ApiEndpointDetailSection` projection：overview、description、parameters、request body、responses、schemas、evidence。UI 只渲染 projection，normalizer 负责从旧/新 artifact 字段中提取安全值。

Alternatives considered:

- 在组件里直接读取 endpoint 字段：短期快，但会让兼容逻辑、fallback、展示逻辑混在 TSX 中。
- 生成 OpenAPI spec 后嵌 Swagger UI：接近目标，但多语言 fallback artifact 并不总是完整 OpenAPI document，且样式/依赖成本高。

选择 projection model，因为它让 scanner 字段演进和 UI 展示解耦。

### Decision 4: Scanner 扩展统一 comment/annotation/schema contract

`ApiEndpoint` 增量支持以下语义字段：

```ts
interface ApiEndpointDescriptionSource {
  kind: "doc-comment" | "swagger-annotation" | "schema-description" | "route-name" | "fallback";
  text: string;
  language?: string;
  evidence: ApiEvidence[];
}

interface ApiStructuredSchemaField {
  name: string;
  type?: string;
  required?: boolean;
  description?: string;
  children?: ApiStructuredSchemaField[];
  evidence?: ApiEvidence[];
}
```

实际落盘可复用现有 `description`、`usageScenario`、`parameters`、`requestBody`、`responses`、`schema` 字段，但 scanner 和 normalizer 必须把 comment/annotation/source evidence 保留下来。新字段全部 optional，旧 artifact 不需要迁移。

Alternatives considered:

- 每种语言输出自己的 DTO model：scanner 实现快，但 frontend 会持续分叉。
- 只输出文本摘要：展示简单，但无法结构化 parameters/responses。

选择统一结构化 schema field，因为它是 Swagger-like detail 的最小公共语言。

### Decision 5: 删除底部 issue chip，保留证据到 detail/status

底部 `Repair / Read issues` chip 对 API 阅读没有直接帮助，且占据主视图注意力。删除常驻底部区域后，真正有价值的信息迁移到：顶部 scan summary、右侧 evidence/confidence、空态 repair hint。

Alternatives considered:

- 保留但折叠：仍然增加布局复杂度。
- 移到右侧 inspector：只有和当前 endpoint/group 相关的 evidence 才进入 inspector。

选择删除主区域底部 chip，减少噪音。

### Decision 6: API export 从统一 contract projection 生成

导出能力不直接读取 React DOM，也不从 scanner 重新拼文本；它从 normalized `ApiContractGraph` 构建 `ApiContractExportDocument` projection，再分别渲染 Markdown、HTML、OpenAPI 3.0 JSON。第一版默认导出当前 workspace 的完整 API contract graph，不默认导出当前选中 group 或当前 filter 结果。

推荐 pipeline：

```text
ProjectMapApiContractGraph
  -> ApiContractExportDocument
  -> renderMarkdown()
  -> renderHtml()
  -> renderOpenApiJsonDocument()
```

Markdown/HTML 面向人读，结构参考 Swagger endpoint detail：标题、接口描述、HTTP method/path、Parameters、Request Body、Responses、Schemas、Evidence/Confidence。OpenAPI 面向机器消费，固定生成 `openapi: 3.0.x` JSON document；无法表达的 confidence、source evidence、parser source、unavailable reason 进入 `x-mossx-*` extension 字段，禁止伪造 required schema。YAML、copy-to-clipboard、filtered export 可作为后续增强，不进入第一版。

Alternatives considered:

- 从右侧 inspector DOM 导出：看起来快，但会把导出绑定到 UI 结构，难测试且不可生成 OpenAPI。
- 后端重新扫描并导出：可以减少前端逻辑，但会引入异步扫描状态和 workspace IO，用户看到的内容可能和当前 UI 不一致。

选择 frontend projection export，因为它保证“所见即所导出”，且三种格式共享同一事实来源。

## Risks / Trade-offs

- [Risk] 三栏 splitter 引入 pointer event 边界问题 → Mitigation: 使用 feature-local helper，clamp 宽度，测试拖拽后 DOM class/state，不碰全局 layout。
- [Risk] Scanner 字段扩展导致旧 artifact 解析失败 → Mitigation: frontend normalizer 只读 optional fields，缺失时 fallback 到现有 description/usageScenario/sourceFile。
- [Risk] 结构化 schema 在语言 fallback 中不完整 → Mitigation: UI 明确显示 unknown/unavailable，confidence/evidence 不伪装。
- [Risk] OpenAPI 导出被误认为完整 authoritative spec → Mitigation: 对 fallback/low-confidence/unavailable 信息写入 `x-mossx-*` metadata，不补不存在的 schema。
- [Risk] HTML 导出引入 XSS 风险 → Mitigation: HTML renderer 必须 escape 所有 artifact 文本，不直接拼未转义 evidence。
- [Risk] Inspector JSX 变大 → Mitigation: 抽 `ApiEndpointDetail` / projection helper，避免继续膨胀主 section。
- [Risk] 删除底部 issues 影响 repair 入口 → Mitigation: 保留 API scan status 和 repair metadata 的入口，但不作为常驻底部噪音展示。

## Migration Plan

1. 先扩展 TypeScript/Rust 类型和 frontend normalizer，保持旧 artifact 可读。
2. 重构 API tab presentation：split layout、endpoint rows、detail projection。
3. 扩展 scanner comment/annotation/schema extraction，补 Rust fixture。
4. 增加 API export projection 与 Markdown/HTML/OpenAPI renderer。
5. 删除底部 issue chip 区域，保留 scan summary/empty state。
6. 补 focused tests，最后运行 OpenSpec、typecheck、focused Vitest、focused Rust tests。

Rollback:

- 如 scanner 扩展不稳定，可保留 UI 重构，先关闭新字段 extraction；UI 继续以旧 artifact fallback 展示 unknown state。
- 如 splitter 出现交互回归，可退回固定 CSS grid，但保留 endpoint list 与 inspector projection。
- 如导出格式不稳定，可先隐藏导出入口，不影响 API tab 阅读能力和 scanner artifact。隐藏时不删除 `src/features/project-map/utils/apiContractExport.ts` 的 pure renderer，方便继续 focused 修复。

## Open Questions

- 三栏宽度是否需要持久化到 client store，还是先保持 session-local。建议先 session-local，避免未上线功能过早引入持久状态迁移。
- 导出入口第一阶段采用下载文件还是复制到剪贴板。建议优先下载文件，复制可后续补充。
