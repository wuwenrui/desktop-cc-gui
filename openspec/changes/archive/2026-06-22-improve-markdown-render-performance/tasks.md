## 1. Baseline Evidence And Diagnostics

- [x] 1.1 [P0][depends:none][I: `FileMarkdownPreview.tsx` / `FileMarkdownPreviewFast.tsx` diagnostics points][O: 增加 bounded render diagnostics 字段: rendererProfile, fallbackReason, contentHash, visibleBlockCount, visibleLineCount, fastCacheState, annotationOverlayCount;不记录 raw markdown/annotation body][V: focused test 断言 data attributes 或 diagnostic object 不含正文] 建立可观测基线。
- [x] 1.2 [P0][depends:1.1][I: 新增 synthetic long Markdown fixture/test helper][O: 构造含 6k+ lines、wide table、images、code fences、headings、annotation targets 的 fixture;可复用在 renderer profile/annotation/outline tests][V: fixture unit test 断言 metrics line/block/heavy counts] 长文档测试基线。
- [x] 1.3 [P1][depends:1.1,1.2][I: `FileMarkdownPreview.test.tsx` / `FileMarkdownPreviewFast.test.tsx`][O: 添加当前行为保护测试:滚动不触发 compile、annotation update 不应改变 body identity 的期望先以 TODO/skip 或 failing-first 记录][V: 测试命名清晰,实现前可作为 red/guard] 捕捉卡顿路径。

## 2. Default Renderer Profile Selection

- [x] 2.1 [P0][depends:1.2][I: `resolveFastMarkdownRendererProfile` / `resolveFileMarkdownFastFeatureFlags` / `FileViewPanel.tsx`][O: 大文档默认选择 fast-html 或 bounded-fast-html;小文档保持 rich-react;保留 override/rollback flag][V: `resolveProfile.test.ts` + `FileViewPanel` focused test 覆盖阈值选择] 默认大文档进入低成本路径。
- [x] 2.2 [P0][depends:2.1][I: `FileMarkdownPreviewFast.tsx`][O: renderer profile/fallback reason 通过 DOM data attributes 或 diagnostics 暴露;fast path pending 状态不提前切回 rich][V: `FileMarkdownPreviewFast.test.tsx` 覆盖 profile/fallback 可观测] profile 可观测。
- [x] 2.3 [P1][depends:2.1][I: `FileMarkdownPreviewFast.tsx` bounded path][O: bounded fast profile 使用明确 line limit,outline jump 到未渲染 target 时先 reveal/提示,不静默 no-op][V: outline jump test 覆盖 target outside projection] bounded 语义补齐。

## 3. Fast Annotation Overlay

- [x] 3.1 [P0][depends:1.1,2.1][I: `FileMarkdownPreviewFast.tsx`][O: 移除 `annotationDraft || annotations` 导致的整篇 `annotation-overlay-rich-fallback`;改为 source-line anchored annotation overlay projection][V: test 断言有 annotations 时仍渲染 `file-markdown-fast-preview`] annotation 不再拖回 rich。
- [x] 3.2 [P0][depends:3.1][I: fast preview annotation button/marker/draft layer][O: annotation button、existing marker、draft composer 可根据 `data-source-line-start/end` 定位;draft typing 不改变 fast compile cache key][V: test 覆盖 marker 渲染、draft typing、cache key 不变] delegated overlay 交互。
- [x] 3.3 [P1][depends:3.2][I: nested list/table/code annotation cases][O: 对无法定位的 annotation 做局部降级或隐藏对应 marker,不整篇 fallback;保留可诊断 fallback reason][V: nested annotation tests 覆盖 no duplicate/no overlap] 标注重叠防线。

## 4. Rich Path Cost Reduction

- [x] 4.1 [P0][depends:1.1][I: `FileMarkdownPreviewFast.tsx` rich outline path][O: same-content rich rerender 不再重复 `compileFastMarkdown` + DOM heading scan;复用 cached outline/source-line metadata][V: spy test 断言 annotation update 不重复 compile outline] rich outline 去重。
- [x] 4.2 [P0][depends:1.2][I: `FileMarkdownPreview.tsx` annotation placement][O: nested node line ranges 和 annotation placement index 按 block identity/cacheKey 缓存;annotation update 做 bounded lookup][V: focused test/spy 断言 recursive traversal 调用次数受控] rich annotation 计算降本。
- [x] 4.3 [P1][depends:4.2][I: table/code/Mermaid/KaTeX heavy block lifecycle][O: annotation update 不重置 table scroll、Mermaid rendered/source tab、KaTeX rendered result、heavy block reveal state][V: existing stability tests 扩展 annotation update cases] heavy block 状态稳定。

## 5. Message Markdown Safety Boundary

- [x] 5.1 [P1][depends:1.1][I: `src/features/messages/components/Markdown.tsx` / message precompute utilities][O: live streaming partial deltas 不引入 file-preview fast body renderer;completed large message 可复用 bounded precompute metadata 但不改变 visible semantics][V: existing message streaming tests + new regression for high-frequency partial deltas] messages 不被误伤。
- [x] 5.2 [P1][depends:5.1][I: messages outline extractor/precompute][O: outline extraction throttle/cache by visible source identity;stale partial outline ignored][V: `messageOutlineExtractor` / Markdown tests 覆盖 stale result] live outline bounded。

## 6. Quality Gates And Manual Verification

- [x] 6.1 [P0][depends:1.x,2.x,3.x,4.x,5.x][I: OpenSpec artifacts][O: `openspec validate improve-markdown-render-performance --strict --no-interactive` exit 0][V: command output valid] OpenSpec strict validate。
- [x] 6.2 [P0][depends:1.x,2.x,3.x,4.x,5.x][I: frontend quality gates][O: `npm run typecheck` + `npm run lint` exit 0][V: command exit 0] TS/lint gate。
- [x] 6.3 [P0][depends:1.x,2.x,3.x,4.x,5.x][I: focused tests][O: run fastMarkdownRenderer tests, FileMarkdownPreview tests, FileMarkdownPreviewFast tests, message Markdown streaming tests][V: 0 failure] focused regression。
- [x] 6.4 [P1][depends:6.1,6.2,6.3][I: dev app + long Markdown document][O: 人工验证长文档上下滚动、annotation marker/draft、outline jump、图片/table/Mermaid/KaTeX 交互无明显卡顿/重叠][V: manual pass 记录到 tasks; 2026-06-22 user verified no functional regression / no worse perceived performance] visual/manual perf check。
