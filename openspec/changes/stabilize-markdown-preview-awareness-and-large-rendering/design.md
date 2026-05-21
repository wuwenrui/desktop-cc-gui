## Context

主窗口 file view 当前已经把默认 external-change monitoring gate 到 `liveEditPreviewEnabled`，但这让系统在“完全不感知”和“Live Preview 自动覆盖 content”之间二选一。用户阅读 Markdown 时需要稳定 snapshot；AI 修改同一文件时又需要明确感知。

Markdown renderer 侧，`FileMarkdownPreview` 已经支持 GFM、sanitize、frontmatter、code highlight、KaTeX、Mermaid 和 annotation line mapping。但大文档路径仍以 line limit 生成一段 Markdown，再交给 ReactMarkdown 整段 parse/render。progressive 扩容时会重复 parse/reconcile 已渲染内容，这正是大文件越多越卡的主因。

## Goals / Non-Goals

**Goals:**

- 默认阅读态保留外部变化 awareness，但不自动替换 preview content。
- Live Preview 自动跟随变化时 debounce 合并应用，降低闪烁和重绘频率。
- dirty buffer 继续保留冲突保护。
- 大 Markdown 文件按 block 逐步展示，block 内复用现有 ReactMarkdown renderer 和 custom components，保留结构渲染能力。
- 所有 side effect 保持 cleanup / stale response guard。

**Non-Goals:**

- 不改 Tauri command、Rust watcher 或 `services/tauri.ts` 签名。
- 不迁移到 markdown-it 或自研 parser。
- 不改变 detached file explorer 的默认 watcher 语义。
- 不实现完整 diff UI；本次只保证提示、刷新、冲突状态可达。

## Decisions

### Decision 1: external sync 拆成 detect 与 apply

`useFileExternalSync` 保持轮询/监听能力，但新增 apply policy：

- `auto`: 现有语义，clean buffer 自动 `setContent`。
- `manual`: clean buffer 只保存 pending disk snapshot 并显示 change notice，不自动更新 content。

dirty buffer 不受 policy 影响，仍进入 conflict state。

备选方案：

- 完全关闭 monitoring：止血但丢失 AI 修改感知。
- 在 Markdown renderer 内忽略 content 变化：会让 file state 与 preview state 分裂，其他 preview 类型也无法复用。

选择 detect/apply policy，因为它把 side effect contract 留在 hook 内，component 只负责显示状态和触发 action。

### Decision 2: stable preview 默认 manual，Live Preview 使用 auto + debounce

主窗口 file view 在有 active file 时启用 awareness polling；`liveEditPreviewEnabled=false` 时 `externalChangeApplyMode=manual`，`true` 时 `auto`。auto 模式里对 clean snapshot apply 做 debounce，避免短时间连续文件写入触发连续 preview rebuild。

detached explorer 继续传入默认 auto，保持既有外部同步 contract。

### Decision 3: Markdown block segmentation 优先按 block 边界，不切断 fenced code/table

在 `compileFileMarkdownDocument` 阶段生成 `blocks`：

- 每个 block 包含 markdown text、normalized line range、source line range、block key。
- fenced code、table、blockquote/list/paragraph 尽量作为完整 block。
- progressive 渲染以 block count 为单位推进，而不是重新 slice raw line window。

ReactMarkdown 仍用于每个 block，因此 GFM、KaTeX、Mermaid、sanitize 与 custom components 能复用。annotation line mapping 通过 block 的 source offset 保持正确。

备选方案：

- 继续 line projection：实现小，但重复 parse 已渲染内容。
- 全量 token renderer：性能潜力高，但会重写 renderer contract。

选择 block segmentation，作为本次低风险架构升级。

### Decision 4: 跳过 Markdown preview 下的 code-preview 全文件高亮预计算

`highlightedLines` 只在 `code-preview` 分支需要。Markdown preview 不应为整文件 code preview 预先 `split/map/highlightLine`。这能直接降低打开 Markdown 文件的同步 CPU 成本。

## Risks / Trade-offs

- [Risk] manual awareness 仍需要 polling，会有 IPC 成本 → Mitigation: 仅主窗口 active file 一条 polling，不在 scroll/hover 上新增 IPC；后续可替换为 watcher。
- [Risk] block segmentation 可能切分复杂 Markdown 边界不完美 → Mitigation: 不切 fenced code/table，ReactMarkdown 仍按 block 内完整文本解析，focused tests 覆盖结构能力。
- [Risk] 多 block ReactMarkdown instance 有额外 component overhead → Mitigation: progressive 只渲染可见预算内 block，重渲染时稳定 key 避免整段重建。
- [Risk] Live Preview debounce 延迟让用户看到内容稍晚 → Mitigation: 延迟控制在交互可接受范围，优先换取稳定画面。

## Migration Plan

1. 扩展 external sync hook contract：pending clean change、manual refresh action、apply mode、debounce。
2. 主窗口传入 awareness enabled + apply mode；detached 保持默认 auto。
3. 文件面板显示外部变化提示和刷新动作。
4. 增加 Markdown block segmentation 与 block projection。
5. 修改 FileMarkdownPreview 按 block 渲染并移除 line projection 的整段重建。
6. 添加 focused tests 并运行 typecheck。

Rollback:

- `externalChangeApplyMode` 可回滚到 auto-only。
- Markdown block renderer 可保留现有 line projection 作为 fallback；若 block path 有风险，可临时改回整段 projection。

## Open Questions

- 后续是否将主窗口 awareness polling 改为 watcher transport，需要另起 backend/runtime change。
- 是否为用户提供“始终跟随当前文件变化”的持久设置，本次不做。
