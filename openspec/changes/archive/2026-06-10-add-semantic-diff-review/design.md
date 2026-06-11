## Design Goals

- 让用户在会话活动中直接知道“第几轮对话改了哪些文件，以及为什么改这些文件”。
- 把 file-change noise 压缩成 turn-level 产物列表，避免同一轮里重复出现 `File change` 卡片和文件行。
- 语义 diff 必须和对应对话轮次绑定，而不是作为全局 Git diff viewer 面板。
- 摘要必须展示 evidence boundary，禁止伪造“AI 已理解/已验证”。
- 先以确定性规则实现 MVP，后续可替换或增强为 LLM-assisted review。

## Data Flow

```text
WorkspaceSessionActivityPanel.groupedTimeline
  -> buildTurnArtifactSummary(group.events)
  -> deduped turn files + buildSemanticDiffSummary(entries)
  -> turn artifact module tabs: Artifacts / Semantic diff
  -> file row opens traditional diff preview when needed
```

## Turn Artifact Model

每个 turn group 从 `fileChange` events 中派生一个 `TurnArtifactSummary`：

- `files`: 按 normalized file path 去重后的文件列表。
- `additions/deletions`: 压缩后文件列表的统计。
- `turnSemantic`: 从该 turn 的用户消息提取并压缩后的本轮语义文本。
- `semanticSummary`: 基于该轮文件 diff 派生的语义摘要。

同一路径重复出现时：

- status 按删除、新增、重命名、修改的优先级合并。
- additions/deletions 使用可见条目中的最大值，避免重复累计同一文件。
- diff 优先保留非空最新 entry。
- line/markers 保留已有定位信息，用于打开文件或高亮。

## Summary Model

语义摘要包含四组：

- `intent`: 优先从 hunk 中的 concrete code tokens 推断改动意图，例如 annotation、method、endpoint、declaration、export。
- `behavior`: 优先从 hunk 中的 concrete behavior tokens 推断行为影响，例如 exception -> HTTP status mapping、response envelope、route handler。
- `risk`: 从删除、配置、大 diff、缺少测试/规格等证据推断风险。
- `validation`: 只展示 diff evidence 能证明的验证信号；没有外部验证命令时明确标为未接入。

每条 item 带：

- `textKey` and `values`: 用户可读描述的 i18n key 与 concrete values。
- `evidenceKey`: 推断来源，例如 affected files、test files、config files、path:line。
- `confidence`: `high | medium | low`。

## Extraction Boundary

- 文件类型、行数、源码/配置分类只能作为兜底或风险提示。
- 若 hunk 中能抽取具体事实，摘要 MUST NOT 退化为“更新 N 个代码文件”。
- Spring / Java MVP 至少覆盖 `@ExceptionHandler`、`HttpStatus.*`、`ApiResponse.error(...)` 与 common mapping annotations。
- 如果没有抽取到具体事实，UI 只能说明“没有抽取到具体代码事实，需要看 hunk”，不能编造业务意图。

## UI Placement

- 顶部活动 tab label 使用“产物 / Artifacts”，不再叫“文件 / File”。
- 每个展开的 turn group 内，在其他 command/task/reasoning events 前渲染 turn artifact module。
- module 内使用 `产物 / 语义 diff` tabs：
  - `产物`: 只显示去重后的文件列表与 diff preview action。
  - `语义 diff`: 显示本轮文件改动的 intent / behavior / risk / validation facts。
- `fileChange` events 不再作为独立 timeline card 渲染。
- artifact module header 将 kicker、title、文件统计与 tabs 合并到一行，减少垂直占用。
- artifact module 使用极简平铺视觉：外层不渲染 card border、圆角、投影或 inset；tab rail 和 active tab 不使用胶囊边框或阴影；语义 section 不使用卡片底色制造凹凸层级。
- artifact module 左侧缩进应小于普通 nested card 缩进，文件行内部 padding/gap 应保持 compact，使产物列表靠近当前 turn 的内容主体。
- `产物 / 语义 diff` tabs 使用 leading icon + label 的形式，在去除边框 chrome 后仍能快速区分 file artifacts 与 semantic review。
- `语义 diff` tab 使用单列 section layout，避免“左标题 + 右内容”在窄面板里浪费空间。
- `语义 diff` tab 顶部展示“本轮语义”，内容来自当前 turn 的用户消息压缩文本，并通过 React text node 渲染，由 UI 自动转义尖括号等字符。
- Standalone Git diff viewer 继续只负责传统 line diff 与文件级 review 操作。

## Risk Boundary

- MVP 不宣称真实业务语义，仅提供 evidence-based review hints。
- 验证命令结果不在本次接入；UI 必须写明 validation evidence not connected。
- 后续接入模型审查时，模型输出必须走结构化输出 normalization 与 validator，不得直接 `JSON.parse` raw model output。

## Rollback

- 在 turn group 中移除 `renderTurnArtifacts(group)` 并恢复 `fileChange` card rendering 即可回到旧活动列表。
- 无后端或持久化迁移。
