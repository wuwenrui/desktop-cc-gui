## Context

mossx 在 `2026-06-22-add-mermaid-block-fullscreen-viewer` 已经把 viewerjs 1.11.7 全套基建落地:`MermaidFullscreenViewer` 组件、`activeViewer` 单例、`preloadViewerjs` 预热、UTF-8 安全 base64、portal 挂 `document.body`、三主题 blur + filter 反色路径、`--z-mermaid-fullscreen: 1300` CSS 变量、panel-lock 协调、reduced-motion 适配。

这次同时落两个独立但共享基建的能力:

1. **Image Fullscreen Viewer**:把 viewerjs 工具条套用到 `<img>`,但 src 来源是 http(s) URL / dataURL / file:// / asset: scheme,与 mermaid SVG 字符串的注入方式完全不同,需要新的 `srcToDataUrl` 工具,但 viewerjs 实例化、销毁、主题、panel-lock 路径**完全复用 mermaid viewer 的同款逻辑**
2. **Messages Outline Floater**:与 viewerjs 无关,纯 React 组件 + scroll 监听。messages surface 当前走 rich ReactMarkdown runtime,不直接产出 `FastMarkdownRenderResult.outline`,因此新增轻量 raw Markdown extractor 输出兼容 `MarkdownOutlineEntry[]` 的 outline 数据。

两条 surface 共享 `MarkdownOutlineEntry` 数据契约但有**重要差异**:
- 文件预览:连续 DOM,fast path 可使用 parser-derived outline。
- 消息流:有 `messagesTimelineVirtualization.ts` 虚拟化,且 rich runtime 不提供 worker outline,**不能依赖 `IntersectionObserver` 或 fast worker result**

所以两个 surface 的 outline 交互**不强行复用组件**,只复用数据契约与 hook 风格。

## Goals / Non-Goals

### Goals (合并两个 P0)

**Image Fullscreen Viewer:**
- `LocalImage` 新增可选 `onClick?: (event: MouseEvent) => void` prop,未传时与现状 100% 一致
- `Markdown.tsx:1797` 的 `img` 渲染 hook 用 `useState` 维护 `isFullscreenOpen`,把 `onClick` 接到 `<LocalImage onClick={open}>`,挂 `<ImageFullscreenViewer open={isFullscreenOpen} src={normalizedSrc} alt={alt} workspaceId={workspaceId} onClose={close} />`
- `FileMarkdownPreview.tsx` 内 `<LocalImage>` 同款处理
- `srcToDataUrl`:
  - `http(s)://` / `data:` / `blob:` / `asset:` / `http(s)://` 开头的 src → **直接传原 URL 给 viewerjs**(避免 base64 编码与内存膨胀)
  - `file://` 或本地相对路径(workspace 内) → 调 `readLocalImageDataUrl(workspaceId, resolvedPath)`,失败降级用原 src
  - 大图(`fetch` 拿到 content-length > 2MB 或 `width*height > 4000*4000`)→ 直接传 URL,跳过 dataURL 转换
- viewerjs options 沿用 mermaid viewer 8 按钮,加 `prev: true, next: true`(多图)
- 主题切换 / panel-lock / reduced-motion / singleton / StrictMode 防御 → 全部沿用 mermaid viewer 契约

**Messages Outline Floater:**
- 数据流:`Markdown.tsx` 渲染消息时调用 `extractOutlineFromMarkdown(throttledValue)`,通过 `onOutlineReady?: (outline: MarkdownOutlineEntry[]) => void` callback 上抛到 `MessagesTimeline`
- `MessagesTimeline` 用 `useState<{ messageId: string; outline: MarkdownOutlineEntry[] } | null>(null)` 维护当前 live assistant message 的 outline
- 浮窗组件三态:`collapsed`(默认) / `expanded-hover`(展开但鼠标离开自动收起) / `pinned`(用户主动 pin)
- 滚动监听:基于消息 timeline root 的 `getBoundingClientRect()`、`scrollHeight` 与 outline `startLine/endLine` 反推当前 heading;throttle 到 `requestAnimationFrame`
- 消息无 heading 时,floater 入口按钮 `display: none`,不出空框
- 跳转:`element.scrollIntoView({ behavior: "smooth", block: "start" })`,目标 heading 的 `id` 在 `attachHeadingIds.ts` 已注入

### Non-Goals

- 不实现图片编辑(裁剪/标注/水印)
- 不实现图片下载按钮(同 mermaid viewer,viewerjs 1.11.7 不暴露 download API)
- 不实现图片 lazy-load 改造(`loading="lazy"` 已在 `Markdown.tsx:1797` 现有)
- 不实现 messages 整窗 outline 聚合(单文档语义,yn 一致)
- 不实现 outline 搜索(同 PreviewOutlineSidebar 现状,只跳转)
- 不实现 outline 持久化(用户刷新后 floater 重新从消息拉取)
- 不实现 outline 拖拽排序
- 不修改 `MarkdownOutlineEntry` 类型
- 不修改 `parserOutline.ts` 解析逻辑
- 不实现 panel-lock 在 floater 上的特殊处理(浮窗是普通 React 组件,panel-lock 锁屏时 floater 不阻塞,与现有侧栏一致)

## Decisions

### Decision 1:图片 viewer 与 mermaid viewer **共享** viewerjs 基建,**不**抽公共组件

yn 的 `image-viewer.tsx` 与 `markdown-mermaid.ts` 在 yn 内部就是两个独立组件(只是配置 options 略不同),证明"共用 viewerjs 但不共用 React 组件"是 yn 自身的稳定抽象。

拒绝备选"抽一个公共 `<FullscreenViewer>` 组件"的理由:
- mermaid viewer 接收 `svg: string`,image viewer 接收 `src: string`,数据转换层(`svgToDataUrl` vs `srcToDataUrl`)完全不同
- mermaid viewer 强制 `prev/next: false`(单图),image viewer 强制 `prev/next: true`(多图)
- 合并会让 props 类型变成 union,反而难维护
- 共享的只有 `Viewer` 实例化的 options 子集 + singleton + preload + 主题 CSS 变量 — 这些已经通过 `mermaidFullscreen/` 的导出(`activeViewer.ts` / `preloadViewerjs.ts`)实现,image viewer 直接 import 即可

### Decision 2:大图不走 dataURL,直接传 URL 给 viewerjs

`URL.createObjectURL(blob)` + `btoa(...)` + `TextEncoder` 编码一张 4MB PNG 会有:
- `btoa` 后 base64 字符串约 5.6MB(比原始大 33%)
- React 渲染该字符串到 DOM attr 时,DOM tokenize + V8 hidden class 转换会再放大内存占用
- viewerjs 内部用 `new Image()` 异步加载,等效于原生 `<img src={url}>`,无转换成本

策略(`srcToDataUrl.ts`):
```ts
// 输入:  src: string
// 输出:  Promise<{ finalSrc: string, shouldConvert: boolean }>

if (src.startsWith("http:") || src.startsWith("https:") ||
    src.startsWith("data:") || src.startsWith("blob:") ||
    src.startsWith("asset:")) {
  return { finalSrc: src, shouldConvert: false };
}

if (src.startsWith("file://") || isLocalRelative(src)) {
  const dataUrl = await readLocalImageDataUrl(workspaceId, resolvedPath);
  return { finalSrc: dataUrl ?? src, shouldConvert: true };
}

// 其他未知 scheme: 直接传原 src
return { finalSrc: src, shouldConvert: false };
```

不实现"先 fetch content-length 再决定"那条路,因为 `file://` / `asset:` scheme 在 Tauri 2 里 fetch 受限,延迟+失败率会拉高,得不偿失。

### Decision 2.1:文件预览本地相对图片按当前 Markdown 文件目录解析

文件预览 surface 与 messages surface 的关键差异是:文件预览知道当前 `.md` 文件的绝对路径。Markdown 里的 `![x](assets/x.png)` 在用户语义上不是 workspace root,而是"相对当前 Markdown 文件所在目录"。

实现策略:
- `FileViewPanel` 把当前文件的 `absolutePath` 透传为 `sourceFilePath`
- rich `FileMarkdownPreview` 渲染 `<img>` 时,把 `assets/x.png` / `./assets/x.png` / `../assets/x.png` 解析到 `dirname(sourceFilePath)`
- `<LocalImage>` 接收 `src=convertFileSrc(resolvedLocalPath)` 与 `localPath=resolvedLocalPath`,所以 asset URL 失败时可通过 `readLocalImageDataUrl(workspaceId, resolvedLocalPath)` 恢复
- fullscreen viewer 点击时直接使用同一个 `resolvedLocalPath`,避免正文图片能显示但全屏又回到坏路径

fast HTML renderer 暂不承载这条本地文件桥接路径,因为 sanitized HTML 阶段不会注入 React `LocalImage` fallback。因此 fast wrapper 遇到本地图片引用时显式回退 rich path,并上报 `fast-renderer-fallback:local-image-rich-fallback`。

### Decision 3:Outline active heading 反推 — 基于 outline line metadata + scroll 事件,不用 `IntersectionObserver`

虚拟列表(`messagesTimelineVirtualization.ts`)会让 heading DOM 节点被卸载,`IntersectionObserver` 会失活。

替代方案:
- `MessagesTimeline` 挂 `window.addEventListener("scroll", schedule, { passive: true })`
- `schedule` 用 `requestAnimationFrame` 节流,同一帧最多 recompute 一次
- 每次触发:
  1. 读取 timeline root `getBoundingClientRect().top` 与 `scrollHeight`
  2. 用 `viewportTopInContainer / scrollHeight` 估算当前 source line
  3. 在当前 outline 中取 `startLine <= approxLine` 的最后一个 heading 为 active
  4. 用 `setActiveHeadingId(id)` 触发 floater 高亮

这不是完整 markdown layout engine,但它避免了在 streaming hot path 里查询大量 heading DOM,并且在 row virtualization 下仍能给出稳定近似。

### Decision 4:outline 浮窗三态参考 `PreviewOutlineSidebar`,不复用组件

文件侧的 `PreviewOutlineSidebar` 是"接 `PreviewOutlineItem` 类型"+"内部维护 `expandedItemIds`",与 messages 侧的 `MarkdownOutlineEntry` 兼容 flat outline 数据不同。

复刻交互(collapsed/expanded/pinned)但不复用组件,因为:
- 数据类型不同
- 容器布局不同(文件侧是侧栏,messages 侧是浮窗)
- 虚拟列表的 active 判定逻辑不同

抽出 `useCollapsibleFloater` hook(可选)放 `features/messages/hooks/`,与 `useMessageOutlineActive` 并列,专管三态状态。

### Decision 5:复用 mermaid-fullscreen.css 的 CSS 变量,扩展 image 专属变量

`mermaid-fullscreen.css` 已经定义:
- `--z-mermaid-fullscreen: 1300`
- 三主题 `--viewer-backdrop-*` / `--viewer-toolbar-*` 变量
- viewerjs sprite icon filter

`image-fullscreen.css` 复用同一套变量名,新增:
- `--z-image-fullscreen: 1300`(同值,避免 viewerjs 实例间 z-index 冲突)
- `.viewer-image` 专属 cursor(`zoom-in` 而非 mermaid 的 `default`)
- 暗色主题下 navbar 背景加深 4%(image viewer 比 mermaid viewer 更常用,navbar 区域需要更明显的可读性)

`messages-outline-floater.css` 完全独立,定义:
- `.messages-outline-floater-collapsed` / `-expanded` / `-pinned`
- `.messages-outline-floater-row[data-depth]`
- `.messages-outline-floater-row.is-active`
- 主题色变量参考 `themeAppearance` 但**不直接 import CSS**(避免循环)

## Architecture

### 目录与依赖图

```
src/features/markdown/imageFullscreen/
├── ImageFullscreenViewer.tsx   # 镜像 MermaidFullscreenViewer,但接收 src 而非 svg
├── srcToDataUrl.ts              # 多源 src → 浏览器可直接加载的 finalSrc
├── index.ts                     # 桶导出
└── __tests__/                   # (可选,合并到 Markdown.image-fullscreen.test.tsx)

src/features/messages/components/
├── MessagesOutlineFloater.tsx   # 浮窗组件,三态
└── MessagesTimeline.tsx         # 接收 outline,挂 floater

src/features/messages/hooks/
├── useMessageOutlineActive.ts   # 滚动监听 + active heading 反推
└── useCollapsibleFloater.ts     # (可选)三态 hook

src/styles/
├── image-fullscreen.css         # 复用 mermaid-fullscreen.css 变量
└── messages-outline-floater.css

src/styles/featureStyleLoaders.ts # 新增 loadImageFullscreenStyles / loadMessagesOutlineFloaterStyles
```

### 数据契约

**ImageFullscreenViewer props:**
```ts
type ImageFullscreenViewerProps = {
  open: boolean;
  src: string;            // http(s) / data: / file:// / asset: / 任意 URL
  alt?: string;
  workspaceId?: string | null;  // 触发 file:// 转换
  onClose: () => void;
};
```

**MessagesOutlineFloater props:**
```ts
type MessagesOutlineFloaterProps = {
  outline: MarkdownOutlineEntry[] | null;  // null = 隐藏入口
  activeHeadingId: string | null;
  onJumpToHeading: (headingId: string) => void;
};
```

**MessagesTimeline 接收 outline 的 callback 契约:**
```ts
// Markdown.tsx 侧:
type MarkdownProps = {
  // ... 既有
  onOutlineReady?: (outline: MarkdownOutlineEntry[]) => void;
};
```

**新 i18n key:**
- `common.markdownImageFullscreen`: `"全屏"` / `"Fullscreen"`
- `common.markdownImageFullscreenHint`: `"放大查看图片"` / `"Open image fullscreen"`
- `messages.outlineShow`: `"显示目录"` / `"Show outline"`
- `messages.outlineHide`: `"隐藏目录"` / `"Hide outline"`
- `messages.outlinePin`: `"固定目录"` / `"Pin outline"`
- `messages.outlineUnpin`: `"取消固定"` / `"Unpin outline"`
- `messages.outlineEmpty`: `"此消息没有可导航的标题"` / `"No headings in this message"`

### viewerjs options(image)

```ts
new Viewer(img, {
  container: document.body,
  inline: false,
  navbar: true,    // 与 mermaid viewer 不同: image 开启 prev/next
  title: false,
  transition: !reducedMotion,
  toolbar: {
    zoomIn: true,
    zoomOut: true,
    oneToOne: true,
    reset: true,
    rotateLeft: true,
    rotateRight: true,
    flipHorizontal: true,
    flipVertical: true,
    prev: true,    // 多图切换
    next: true,
    play: false,   // 不实现幻灯片
  },
});
```

### 失败 / 降级

| 失败点 | 降级 |
|---|---|
| `readLocalImageDataUrl` 返回 null | `finalSrc` 退回 `src` 原值 |
| viewerjs 构造抛错 | catch 后 `onClose()`,console.error |
| `MutationObserver` 触发回调抛错 | try-catch 在 observer 回调内,不污染 viewer 自身 |
| `src` 为空字符串 | viewerjs 不开,直接 `onClose()` |
| 用户点 floater 跳转时 heading DOM 不存在 | 保持 UI 可用,不抛错;mounted heading 走 `scrollIntoView` |
| outline 数据更新但当前 active heading 已不在新 outline | `setActiveHeadingId(null)`,floater 高亮回空 |
| workspaceId 缺失 + src 是 file:// | `srcToDataUrl` 跳过转换,viewerjs 收到原 `file://` URL 让浏览器自己处理 |

### 主题切换契约

与 mermaid viewer 一致:
- `MutationObserver(document.documentElement)` 监听 `class` / `data-theme` / `data-appearance` 变化
- 触发时 `viewer.update()`,viewerjs 会重新读取 CSS 变量
- `prefers-reduced-motion: reduce` 时 `transition: false, blur: 0px`(在 `image-fullscreen.css` 内通过 media query 实现)

### panel-lock 协调

与 mermaid viewer 一致:
- `MutationObserver(document.body, { childList: true, subtree: true })` 监听 `.panel-lock-overlay`
- 出现即 `viewer.destroy()` + `onClose()`
- floater 自身**不**监听 panel-lock(浮窗是普通 React 组件,panel-lock 锁屏时它会在 lock 之下,与现有 PreviewOutlineSidebar 行为一致)
