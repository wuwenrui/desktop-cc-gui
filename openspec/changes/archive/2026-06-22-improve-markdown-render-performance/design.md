## Context

当前 Markdown 文件预览有两套路径:

- rich path: `FileMarkdownPreview.tsx` 将文档切成 blocks,每个 block 仍通过 `ReactMarkdown` 渲染,并在 component map 中接入 table/code/Mermaid/KaTeX/image/annotation。
- fast path: `FileMarkdownFastPreview.tsx` 通过 `compileFastMarkdown` 产出 sanitized HTML,再用 delegated events / post-processing 处理 table/link/annotation button。

代码证据:

- `FileMarkdownPreview.tsx` 已有 `progressive` / `bounded` projection,但 visible blocks 仍逐个 mount `ReactMarkdown`。
- `renderAnnotatableBlock()` 每个 annotatable block 会递归 `collectNestedNodeLineRanges()` 并根据 annotation line range 过滤,annotation draft/marker 更新会进入 rich body render path。
- `FileMarkdownPreviewFast.tsx` 当前只要 `annotationDraft !== null || annotations.length > 0` 就设置 `annotation-overlay-rich-fallback`。
- rich path 的 outline 在 wrapper 中会额外调用 `compileFastMarkdown()` 提取 outline,随后再 `querySelectorAll("h1..h6")` 给 rich DOM 补 id,这会产生同内容重复解析和 DOM scan。
- fast renderer 由 env/localStorage feature flag 控制,默认仍容易停留在 rich path。

因此卡顿不是单个函数慢,而是三个因素叠加:ReactMarkdown 子树过多、annotation overlay 与 body render 强耦合、outline/compile 工作重复。

## Goals / Non-Goals

**Goals:**

- 大 Markdown 文件默认进入低成本 renderer profile,不要求用户手动开 localStorage flag。
- annotation 不再天然强制 fast path fallback 到 rich path。
- annotation marker/draft 更新只影响 overlay 或定位层,不重编译/重挂载 Markdown body。
- outline extraction 和 heading id 绑定复用 compile/source-line metadata,避免 same-content 重复 parse + DOM scan。
- 提供 diagnostics,让性能优化可以被测试和观测,而不是靠主观感觉。

**Non-Goals:**

- 不移除 rich ReactMarkdown fallback。
- 不一次性实现全文 block virtualization。
- 不新增第三方 Markdown renderer dependency。
- 不改变 Markdown 语义、annotation 数据模型或后端存储。
- 不把 messages live streaming path 强行切到 file-preview renderer。

## Decisions

### Decision 1:默认大文档优先 fast/bounded HTML renderer

现状 fast renderer 是 opt-in,但长文档卡顿问题正是默认体验问题。将 renderer profile selector 改为:

1. 小文档或需要 rich-only interaction 的文档仍可走 rich path。
2. 超过 line/byte/block/heavy-block 阈值的大文档默认走 fast HTML。
3. 超过更高阈值的大文档走 bounded fast HTML,先提供可读首屏与 outline,再显式 reveal/expand。

备选方案:
- 只调 rich progressive 阈值:改动小,但每个 block 仍是 ReactMarkdown subtree,滚动卡顿难根治。
- 全量 virtualization:理论收益最大,但 heading jump、annotation、image height、browser selection/find 复杂度高。

结论:先让 fast/bounded HTML 成为大文档主线,rich path 作为语义兜底。

### Decision 2:annotation 变成 delegated overlay,不再触发 fast fallback

fast path 已有 source-line attrs,可以把 annotation button/marker/draft 定位到 block 后方或 overlay layer。核心原则:

- Markdown body identity 由 `documentKey + contentHash + rendererProfile` 决定。
- annotation state 不进入 fast compile cache key。
- annotation update 只更新 overlay projection。
- 对无法可靠定位的复杂 nested annotation,只局部 fallback 到 rich island 或显示明确 fallback,不整篇 fallback。

备选方案:
- 保持 annotation fallback rich:简单但正中性能痛点。
- 把 annotation 直接写入 Markdown HTML:会污染 sanitizer/compile cache,并让 annotation 状态改变触发 full compile。

结论:delegated overlay 是最小可控路径。

### Decision 3:rich path 只做兜底,并缓存 expensive placement

rich path 仍需要支持 Mermaid、KaTeX、本地图片、复杂 HTML fallback。为了降低 rich fallback 成本:

- `collectNestedNodeLineRanges()` 结果按 block key + node position/source range 缓存。
- annotation placement index 预先按 line range 建立,block render 只做 bounded lookup。
- rich outline 不再额外 compile + DOM scan;优先复用 parser-derived outline/source-line anchors。

备选方案:
- 不优化 rich fallback:fast path 覆盖不足时用户仍卡。
- 彻底删除 rich annotation:破坏功能。

结论:rich path 要保留,但要减少 same-content update 的 CPU 放大。

### Decision 4:先做可观测指标和 synthetic fixture

性能问题必须有 evidence。新增/扩展 diagnostics:

- selected renderer profile
- fallback reason
- compile duration / sanitize duration
- mounted visible block count
- annotation overlay item count
- fast cache hit/miss
- body remount count 或 equivalent test signal

测试不要求真实浏览器 FPS,但要能证明关键路径没有发生 full compile/full remount。

## Risks / Trade-offs

- [Risk] fast HTML sanitizer 对本地图片、Mermaid、KaTeX、annotation interaction 的支持不完整 → [Mitigation] 按 interaction island / local fallback 分阶段补齐,失败闭环到 rich path。
- [Risk] annotation overlay 定位和 rich nested block placement 不完全一致 → [Mitigation] 先以 source-line anchored block placement 为准,新增 nested list/table/code regression tests。
- [Risk] 默认启用 fast path 改变边缘 Markdown 渲染细节 → [Mitigation] 仅对超过阈值文档默认启用,并保持 fallback reason 可观测。
- [Risk] bounded fast HTML 可能让 outline target 未渲染 → [Mitigation] outline jump 必须先 reveal target range 或提示 target outside projection。

## Migration Plan

1. 增加 diagnostics 与 tests,先锁定当前行为和卡点。
2. 改 renderer selector,让大文档默认 fast/bounded fast。
3. 实现 fast annotation overlay,移除 annotation-only rich fallback。
4. 去重 rich outline compile/DOM scan,缓存 rich annotation placement。
5. 扩展 regression tests 与 synthetic long-document fixture。

Rollback:

- 保留 feature flag / profile override,可将默认大文档选择退回 `rich-react`。
- rich path 继续存在,fast failure/fallback 不会导致空白预览。

## Open Questions

- bounded fast HTML 的默认 line limit 是否沿用当前 `600`,还是根据 outline/heading density 动态调整?
- local image rich fallback 是否可以在 fast path 中通过 delegated `LocalImage` island 逐步补齐?
- 是否需要 Playwright trace 作为最终验收,还是 Vitest synthetic fixture 足够覆盖本 change?
