## Why

mossx 当前在两条 Markdown 渲染 surface 上存在两个独立的体验缺口,都直接对标 Yank Note 已稳定的实现:

**缺口 1:消息与文件预览里的图片是裸 `<img>`,无全屏**
- `src/components/common/LocalImage.tsx`(被 `src/features/messages/components/Markdown.tsx:1797` 和 `src/features/files/components/FileMarkdownPreview.tsx` 复用)只处理"本地路径 fallback",`onError` 走 `readLocalImageDataUrl` 兜底,**没有 onClick 全屏入口**
- AI 回复里出现的代码截图、产物图、文件预览大图,用户要"放大看细节"时只能:
  - 浏览器自带 Ctrl/Cmd + 滚轮(整页缩放,UI/文字/代码一起缩,体验割裂)
  - 右键 → 在新标签页打开图片(脱离应用上下文,丢失文件关联)
- 参考项目 `@/Users/chenxiangning/code/AI/github/yn` 已用 `viewerjs@^1.11.6` 在 `src/renderer/plugins/image-viewer.tsx`(line 48-71)稳定实现:8 按钮 toolbar(zoomIn/zoomOut/oneToOne/reset/rotateLeft/rotateRight/flipHorizontal/flipVertical),与 mermaid 同一套 viewerjs 基建
- mossx 在 `2026-06-22-add-mermaid-block-fullscreen-viewer` 已落地 viewerjs + portal + singleton + 主题适配 + panel-lock + reduced-motion 全套基建,**图片 viewer 是这套基建最自然的复用场景**

**缺口 2:消息流(messages surface)没有 Outline / TOC 入口**
- 文件预览侧 `src/features/files/components/PreviewOutlineSidebar.tsx` 已有一套完整的 outline 侧栏(可折叠、可钉住、鼠标 hover 离开自动收起)
- `src/features/markdown/fastMarkdownRenderer/parserOutline.ts` 已经在 worker 里产出 `MarkdownOutlineEntry[]`,自带 `id / depth / title / startLine / endLine / anchor / ordinal`
- `compile.ts:168-185` 已经把 outline 透传到 `FastMarkdownRenderResult.outline`,类型完备
- 但消息侧 `src/features/messages/components/Markdown.tsx` 走 rich ReactMarkdown runtime,当前没有 fast worker result 可直接消费,长对话/长文档场景下用户要靠滚动条硬找章节
- 本 change 在 messages rich renderer 内新增轻量 `extractOutlineFromMarkdown()` raw Markdown 扫描,输出兼容 `MarkdownOutlineEntry[]` 的数据结构,避免为了 TOC 把整条 messages render pipeline 切到 fast worker path

## 目标与边界

### 目标

**目标 1:Image Fullscreen Viewer**
- `LocalImage` 增加 onClick 透传 prop,`Markdown.tsx:1797` 的 `img` 渲染 hook 与 `FileMarkdownPreview.tsx` 的对应 `img` 节点把 `onClick` 接入
- 复用 `mermaidFullscreen/` 同款 viewerjs 基建:`Viewer` + portal + `activeViewer` singleton + `preloadViewerjs` + viewerjs 主题色覆盖 CSS
- 新建 `src/features/markdown/imageFullscreen/ImageFullscreenViewer.tsx`,接收 `{ open, src, alt, workspaceId, onClose }` props
- toolbar 沿用 viewerjs 8 按钮(zoomIn/zoomOut/oneToOne/reset/rotateLeft/rotateRight/flipHorizontal/flipVertical),**额外打开 `prev/next`**(单页多图场景,yn 同款行为)
- 新建 `src/features/markdown/imageFullscreen/srcToDataUrl.ts`,优先用 `URL` 直传(无 dataURL 编码成本);仅当 `src` 是 `file://` 或本地相对路径时,走 `readLocalImageDataUrl` 兜底
- 大图(>2MB)不转 dataURL,直接传 URL 给 viewerjs(viewerjs 自带 img 加载,避免 6.7MB base64 字符串爆内存)
- 新增 OpenSpec capability `markdown-image-fullscreen-viewer`

**目标 2:Messages Outline Floater**
- 新建 `src/features/messages/components/MessagesOutlineFloater.tsx`,默认折叠,点击展开后 hover-pin,借鉴 `PreviewOutlineSidebar` 的 `collapsed/pinned/onMouseLeave` 三态
- 数据源:`Markdown.tsx` 在 messages rich renderer 内调用 `extractOutlineFromMarkdown(throttledValue)`,通过 `onOutlineReady?: (outline: MarkdownOutlineEntry[]) => void` callback 上抛到 `MessagesTimeline`,`MessagesTimeline` 维护当前 live assistant message 的 outline 状态
- 滚动监听:基于 messages timeline root `getBoundingClientRect()` + outline `startLine/endLine` 比例反推 active heading;不依赖 `IntersectionObserver`
- 仅对当前正在展示 outline 的单条 assistant message 计算 active heading(单文档语义,yn 一致);**不做整窗聚合**
- 消息没有 heading(纯代码/纯工具调用)时,浮窗入口直接隐藏,不出空框
- 新建 `src/features/messages/hooks/useMessageOutlineActive.ts`,封装 scroll 反推逻辑
- 新增 OpenSpec capability `messages-outline-floater`

### 边界

**仅修改(非破坏性):**
- `src/components/common/LocalImage.tsx` — 加 `onClick` 可选 prop,**默认行为不变**
- `src/features/messages/components/Markdown.tsx:1797` — `img` 渲染 hook 触发 viewer,**保留所有 fallback 逻辑**
- `src/features/files/components/FileMarkdownPreview.tsx` — 文件侧 `img` 节点同样接 viewer
- `src/features/messages/components/MessagesTimeline.tsx` — 接收 outline,挂 floater,**保留虚拟化逻辑**
- `src/i18n/locales/zh.part1.ts` / `en.part1.ts` / `en.part1.base.ts` — 新增 key,命名空间 `common.markdownImageFullscreen*` 和 `messages.outline*`

**新建:**
- `src/features/markdown/imageFullscreen/ImageFullscreenViewer.tsx`
- `src/features/markdown/imageFullscreen/srcToDataUrl.ts`
- `src/features/markdown/imageFullscreen/index.ts`
- `src/features/messages/components/MessagesOutlineFloater.tsx`
- `src/features/messages/hooks/useMessageOutlineActive.ts`
- `src/features/messages/hooks/useCollapsibleFloater.ts`
- `src/features/messages/utils/messageOutlineExtractor.ts`
- `src/styles/image-fullscreen.css`(viewerjs 主题色覆盖,沿用 mermaid-fullscreen.css 同一套变量,扩展 image 专属按钮态)
- `src/styles/messages-outline-floater.css`
- `src/features/messages/components/LocalImage.test.tsx`(补 onClick 透传用例)
- `src/features/messages/components/Markdown.image-fullscreen.test.tsx`
- `src/features/files/components/FileMarkdownPreview.image-fullscreen.test.tsx`
- `src/features/messages/components/MessagesOutlineFloater.test.tsx`
- `src/features/messages/hooks/useMessageOutlineActive.test.tsx`
- `src/features/messages/utils/messageOutlineExtractor.test.ts`
- `src/features/markdown/imageFullscreen/srcToDataUrl.test.ts`
- `openspec/specs/markdown-image-fullscreen-viewer/spec.md`
- `openspec/specs/messages-outline-floater/spec.md`

**不改:**
- `viewerjs` 版本(沿用 `^1.11.7`,与 mermaid viewer 共用 chunk)
- `vite.config.ts` 的 manualChunks(新 viewerjs 复用入口,不需新 chunk)
- `mermaidFullscreen/` 任何文件(完全独立的 `imageFullscreen/` 目录,通过 `preloadViewerjs` 共享 viewerjs 模块引用)
- `parserOutline.ts` / `compile.ts` / `types.ts`(`MarkdownOutlineEntry` 字段已完备,不需要扩展)
- `markdown-parse-pipeline` / `file-view-markdown-github-preview` / `file-view-rendering-runtime-stability` / `conversation-live-message-canvas-rendering` 既有 requirement 文本

### 兼容性硬约束

- `LocalImage` 新增 `onClick` prop 是**可选**;未传时与现状完全一致,无 viewerjs 触发
- `Markdown.tsx:1797` 的 fallback 路径(`!normalizedSrc` 时 `return null`)保留
- `MessagesTimeline.tsx` 的虚拟化 / 滚动恢复 / 流式增量逻辑不动
- viewerjs 8 按钮顺序严格沿用 yn 视觉与 mermaid viewer 同款 boolean config(键声明顺序即渲染顺序)
- 主题切换 / panel-lock / reduced-motion 行为完全沿用 mermaid viewer 已验证的契约
- 任何错误(dataURL 转换失败 / viewerjs 构造抛错 / 监听器报错)必须被 catch 并降级,不能 throw 出 React 树
