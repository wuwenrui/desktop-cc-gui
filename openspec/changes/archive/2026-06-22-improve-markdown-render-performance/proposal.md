## Why

Markdown 文件预览在长文档、大表格、多图片、Mermaid/KaTeX/代码块混合场景下仍可能出现首屏渲染重、上下滚动卡顿和交互延迟。当前 rich ReactMarkdown path 已有 progressive/bounded rendering 与 heavy block defer,但长文档仍会为可见 block 创建大量 ReactMarkdown 子树;同时 AI annotation overlay 会让 fast HTML path 直接 fallback 到 rich path,导致"标注给 AI"越多,越容易回到最重路径。

这次变更的目标是把 Markdown 预览性能从"局部缓解"推进到"可证据化、可降级、可保持交互语义的稳定渲染体系"。

## 目标与边界

### 目标

- 降低长 Markdown 文件首屏渲染和上下滚动时的 main-thread work。
- 保持文件预览 Markdown 的现有语义: GFM table/list/task-list、KaTeX、Mermaid、本地图片、outline、AI annotation、外链打开。
- 让 AI annotation 不再天然触发整篇文档 fallback 到 rich ReactMarkdown path。
- 为 Markdown 渲染建立可观测指标: profile 选择、compile duration、DOM mount size、visible block count、fallback reason、annotation overlay count。
- 用 focused tests 和至少一组 synthetic long-document fixture 验证优化没有破坏渲染语义。

### 非目标

- 不重写整个 Markdown 引擎。
- 不删除现有 rich ReactMarkdown fallback;它仍是安全兜底。
- 不在本 change 中改变 Markdown 内容语义或用户可见文案。
- 不做通用虚拟列表框架迁移,除非证据显示必须。
- 不解决所有消息流 Markdown 性能问题;messages surface 只纳入必要的 precompute/cache 复用和诊断边界,主要焦点是 file-preview 长文档。

## What Changes

- File Markdown preview renderer selection:
  - 对大文档默认优先选择 fast/bounded fast HTML path,而不是仅通过 localStorage/env flag opt-in。
  - 保留 deterministic threshold,使用 byte length、line count、block count、heavy block count、annotation state 等输入。
- Fast path annotation support:
  - 将 AI annotation 从"导致 fast path fallback"改为 delegated / overlay interaction layer。
  - fast HTML surface 使用 `data-source-line-start/end` 与 stable block id 定位 annotation button、marker、draft。
  - annotation draft/marker 更新只更新 overlay,不重编译 Markdown body。
- Rich path cost reduction:
  - 避免 rich outline 额外 `compileFastMarkdown` 与 DOM heading scan 在每次 same-content rerender 中重复执行。
  - 将 annotation placement 的 nested range 计算缓存到 block identity,减少每个 block render 时的 recursive traversal。
  - 对大图片、table、code、Mermaid/KaTeX 等 heavy block 保持 lazy/deferred lifecycle。
- Diagnostics and evidence:
  - 暴露 Markdown render profile、fallback reason、compile duration、mounted block count、annotation overlay count。
  - 增加 synthetic long Markdown fixture,覆盖滚动/annotation/outline/large image/table 的性能防线。

## 技术方案对比

| 方案 | 做法 | 优点 | 风险 / 代价 | 结论 |
|---|---|---|---|---|
| A. 继续加强 rich ReactMarkdown progressive rendering | 保持每个 block 都走 ReactMarkdown,只调阈值和 chunk cadence | 改动小,语义风险低 | DOM/React 子树仍重;annotation 仍和 body render 耦合;长文档滚动卡顿难根治 | 不作为主线,只保留为 fallback |
| B. 默认启用 fast/bounded HTML renderer + delegated interaction islands | 大文档优先 sanitized HTML,annotation/outline/table/link 走 delegated events 或局部 overlay | DOM mount 更轻;annotation 可脱离 body re-render;与现有 fast pipeline 方向一致 | 需要补齐本地图片、annotation、Mermaid island 的 fallback/局部 hydration 契约 | 作为主线 |
| C. 全文虚拟化 Markdown blocks | 只 mount viewport 附近 blocks,rich/fast 都可用 | 滚动时 DOM 最少 | heading jump、annotation line range、table height、image load height、browser find/selection 都更复杂 | 作为后续备选,本 change 只做证据预留 |

## Capabilities

### New Capabilities

- _None._

### Modified Capabilities

- `file-markdown-preview-render-architecture`: 强化 large Markdown renderer selection、fast path annotation overlay、outline/precompute 去重、diagnostics requirement。
- `file-view-rendering-runtime-stability`: 强化长文档滚动和 preview interaction 不阻塞 file view runtime 的要求。
- `markdown-parse-pipeline`: 强化 file-preview fast compile/cache/worker diagnostics 与 stale result handling。
- `message-markdown-streaming-compatibility`: 补充 completed large Markdown 与 worker/cache 复用边界,避免 messages surface 被 file-preview 优化误伤。

## Impact

- 主要代码:
  - `src/features/files/components/FileMarkdownPreview.tsx`
  - `src/features/files/components/FileMarkdownPreviewFast.tsx`
  - `src/features/markdown/fastMarkdownRenderer/*`
  - `src/features/files/utils/fileMarkdownDocument.ts`
  - `src/features/files/components/FileViewPanel.tsx`
  - `src/features/files/components/FileViewBody.tsx`
- 测试:
  - `FileMarkdownPreview.test.tsx`
  - `FileMarkdownPreviewFast.test.tsx`
  - `fastMarkdownRenderer` compile/hook/worker tests
  - 新增长文档 synthetic fixture/perf guard tests
- 不新增 runtime dependency。
- 不涉及 Rust/backend 数据模型变更。

## 验收标准

- 大文档默认 renderer profile 可通过 data attributes/diagnostics 观察,并且不再依赖手动 localStorage flag 才进入 fast path。
- 有 annotation draft/marker 时,fast path 不再仅因 annotation state fallback 到 rich path。
- annotation update 不触发 Markdown body compile/cache miss。
- rich path same-content rerender 不重复 outline compile + DOM heading scan。
- focused tests 覆盖:
  - long Markdown profile selection
  - annotation overlay on fast path
  - rich outline compile/cache reuse
  - local image + fast fallback compatibility
  - Mermaid/KaTeX/table correctness
- `npm run typecheck`, `npm run lint`, focused Vitest, `openspec validate improve-markdown-render-performance --strict --no-interactive` 通过。
