## Why

mossx 当前在两处渲染 Markdown 内的 Mermaid 图：
- 消息侧 `src/features/messages/components/MermaidBlock.tsx`（被 `Markdown.tsx` 复用）
- 文件预览侧 `src/features/files/components/FileMarkdownPreview.tsx` 内的 `FileMarkdownMermaidBlock`

两块都仅在卡片内 inline 渲染 SVG，缺少「全屏放大 + 工具条」能力。当 Mermaid 图本身较宽、节点很多（典型场景：状态机、ER、sequence、flowchart）时，inline 缩放后看不清字也拖不动；用户只能靠浏览器自身缩放或下载 SVG，体验断裂。

参考项目 `@/Users/chenxiangning/code/AI/github/yn`（Yank Note）已经稳定实现：使用 `viewerjs@^1.11.7`（与 yn 同源小版本升级，1.11.7 是当前最新 stable），把 mermaid 渲染出的 SVG 转 dataURL 注入一个临时 `<img>` 元素，再 `new Viewer(img, { container: document.body, navbar:false, toolbar:{ zoomIn, zoomOut, oneToOne, reset, rotateLeft, rotateRight, flipHorizontal, flipVertical } })`。viewerjs 自带 backdrop、ESC 关闭、双指/滚轮缩放、toolbar SVG 图标，无需自绘。yn 的 `image-viewer.tsx` 即同一套封装（line 48-71 给了完整 options 形态），证明这套抽象在 Vue/React 双栈下都成立。

mossx 这次直接按 yn 的「viewerjs 工具条 + 全屏 container=document.body」思路做能力复刻，覆盖消息与文件预览两侧。

## 目标与边界

### 目标

- 在 `MermaidBlock` 与 `FileMarkdownMermaidBlock` 顶部 actions 区各加一个「全屏」入口（lucide `Maximize2` 图标）。
- 点击全屏后，mermaid 渲染出的 SVG 通过 viewerjs 全屏展示，复用 yn 风格的工具条（zoomIn / zoomOut / 1:1 / reset / rotateLeft / rotateRight / flipHorizontal / flipVertical），共 8 个按钮。**mossx 不在 toolbar 末尾追加「下载」按钮**：viewerjs 1.11.7 不提供 `download` 按钮 / `download` 回调，下载需求本期不做（参见 design.md Decision 1 与 tasks §12 决策记录；`src/features/markdown/mermaidFullscreen/downloadSvg.ts` 是 URL.createObjectURL 工具，但 viewerjs 不暴露下载接入点，所以本期未接进 toolbar）。
- 全屏 viewer 容器挂到 `document.body`（与 yn 一致），backdrop 覆盖全屏，ESC / 点击 backdrop 关闭。
- 引入 `viewerjs@^1.11.7` 作为新依赖，CSS 与主题色覆盖集中 import 一次，z-index 通过 `--z-mermaid-fullscreen` CSS 变量暴露。
- 新增 OpenSpec capability `markdown-mermaid-block-fullscreen-viewer`，覆盖两个 surface 的入口契约、SVG 注入契约、销毁契约、键盘与 a11y 契约、并发契约、主题切换契约、可达性契约。

### 边界

- 仅修改：
  - `package.json`（新增 `viewerjs@^1.11.7` 依赖）
  - `vite.config.ts`（manualChunks 把 viewerjs 与 mermaid 合并为同一个 chunk，沿用 journal-14 的 mermaid/docs/ui-heavy 分包策略）
  - `src/features/messages/components/MermaidBlock.tsx`
  - `src/features/files/components/FileMarkdownPreview.tsx`
  - 新增 `src/features/markdown/mermaidFullscreen/MermaidFullscreenViewer.tsx`（共享组件，避免 messages/files 互相 import）
  - 新增 `src/features/markdown/mermaidFullscreen/svgToDataUrl.ts`（UTF-8 安全的 base64 编码工具）
  - 新增 `src/features/markdown/mermaidFullscreen/activeViewer.ts`（module-level 单例）
  - 新增 `src/features/markdown/mermaidFullscreen/preloadViewerjs.ts`（首次成功渲染后预热 viewerjs）
  - 新增 `src/features/markdown/mermaidFullscreen/downloadSvg.ts`（`URL.createObjectURL` + 隐藏 `<a>` + `click()` 的 SVG 下载工具；本期未在 MermaidFullscreenViewer 引用，`index.ts` 仍 export 出去，保留以备未来 toolbar 自绘下载按钮时直接使用）
  - 新增 `src/styles/mermaid-fullscreen.css`（viewerjs 主题色覆盖、z-index CSS 变量）
  - `src/styles/featureStyleLoaders.ts` 新增 `loadMermaidFullscreenStyles`
  - `src/i18n/locales/zh.part2.ts` / `en.part2.ts`（新增 i18n key，命名空间归 `common.markdownMermaid*` 让两处 surface 复用）
  - 新增 `src/features/messages/components/MermaidBlock.fullscreen.test.tsx`
  - 新增 `src/features/files/components/FileMarkdownPreview.mermaid-fullscreen.test.tsx`
  - 新增 `openspec/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`（archive 同步后）
- 不修改：
  - mermaid 渲染入口（`mermaid.render`、render cache、Source/Render tab 行为）
  - 现有 `markdown-parse-pipeline` / `file-view-markdown-github-preview` / `file-view-rendering-runtime-stability` / `conversation-live-message-canvas-rendering` 的 requirement 文本
  - viewerjs 自身的 toolbar 按钮顺序
  - 任何 React Portal 之外的 mount 方式（`document.body` 唯一挂载点）
  - 任何 store / 持久化层（全屏状态是纯 UI 瞬态）
  - viewerjs 自身 CSS（仅做主题色覆盖）

### 非目标

- 不实现 mermaid 多图块（`<!-- mermaid:begin/end -->` 之类的拆分）—— 当前 mossx 没有这种语义
- 不实现 toolbar 内的 prev/next/play（mermaid 单图没有「上/下一张」概念）
- 不实现 svg-pan-zoom 等额外 pan-zoom 库
- 不修改 `mermaid` 包的版本 / 主题 / 安全配置
- 不动 viewerjs 自身 CSS（仅做主题色覆盖）
- 不实现 viewerjs 的旋转动画配置（保留 viewerjs 默认）
- 不改 mermaid 渲染后的 svg 内容（不二次注入主题 / 不重写 `<style>` 块）

## What Changes

- 新增 capability：`markdown-mermaid-block-fullscreen-viewer`
  - 跨 `messages` 与 `files` 两个 surface 共享（Mermaid 块是两个独立实现但行为契约必须一致）
  - 命名空间 `markdown-mermaid-block-fullscreen-viewer` 沿用 `markdown-parse-pipeline` 的跨 surface 命名先例
- 共享组件：`src/features/markdown/mermaidFullscreen/MermaidFullscreenViewer.tsx`
  - Props: `{ open: boolean; svg: string; onClose: () => void }` （实现仅这三字段；`title` / `filename` 提案阶段考虑过但未实现，参见 design.md Decision 1 / Decision 12）
  - 行为：`open=true` 时通过 `createPortal` 渲染到 `document.body`；内部用 `useRef<HTMLImageElement>` 持有 img，`useEffect` 内 `new Viewer(img, options)`，**监听 `hidden` 事件**触发 `onClose`，并 `useEffect` cleanup 中 `viewer.destroy()` 兜底
  - 销毁：组件 unmount 时必须 `viewer.destroy()`，避免 viewerjs 持有 stale DOM 引用
- 共享工具：
  - `svgToDataUrl.ts`：UTF-8 安全 base64 编码，兼容 Mermaid v11 输出的 `<style>` 块内的 CSS 内容
  - `activeViewer.ts`：module-level `activeViewer: Viewer | null` 单例；新 viewer 创建前 destroy 旧 viewer，保证同一时刻只一个 viewer
  - `preloadViewerjs.ts`：module-level Promise 缓存，`MermaidBlock` 渲染成功（拿到 svg）时 `void preloadViewerjs()`，避免首次点击 Fullscreen 时的 dynamic import 抖动
- 工具条按钮：
  - 启用：`zoomIn / zoomOut / oneToOne / reset / rotateLeft / rotateRight / flipHorizontal / flipHorizontal `（9 个）
  - 关闭：`prev / next / play`（值 `0`）
  - 顺序（按 toolbar 对象 key 声明顺序）：zoomIn → zoomOut → oneToOne → reset → rotateLeft → rotateRight → flipHorizontal → flipVertical
- CSS：`src/styles/mermaid-fullscreen.css`
  - 定义 `--z-mermaid-fullscreen: 1300`（高于 `kanban.css:1168 z-index: 1200` 留 100 buffer）
  - `.viewer-backdrop` 背景：`color-mix(in srgb, var(--surface-base) 96%, transparent)`（深色）
  - `.viewer-toolbar > ul > li` 颜色：`var(--mermaid-fullscreen-button-fg)`，背景使用 `--mermaid-fullscreen-toolbar-item-bg` / hover `--mermaid-fullscreen-toolbar-item-hover-bg`
  - `.viewer-toolbar` 背景：`--mermaid-fullscreen-toolbar-bg` + backdrop-filter blur；light / dim / dark 三主题分别定义，不能共用深色控件色
  - `.viewer-title` 颜色：`var(--text-faint)`
  - `.viewer-navbar` 背景：`var(--surface-overlay)`（即便 navbar:false 也要兜底）
- i18n：
  - 新增 `common.markdownMermaidFullscreen`: "全屏" / "Fullscreen"（**两处 surface 复用同一 key**）
  - 新增 `common.markdownMermaidFullscreenHint`: "放大查看图表" / "Open diagram fullscreen"
- Vite manualChunks：viewerjs 合并进 `mermaid` chunk，沿用现有策略

## 技术方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. viewerjs + svg→base64 dataURL→`<img>` 注入（yn 复刻，UTF-8 安全） | 与 yn 实现完全一致；viewerjs 自带 backdrop/工具条/键盘/缩放/翻转；ESC 与点击关闭开箱即用；CSS 主题色覆盖成本低；UTF-8 安全的 base64 编码避开了 Mermaid v11 `<style>` 块的 CSS 内容被 `encodeURIComponent` 误转义的风险 | 多 ~30KB gzip；svg 转 dataURL 一次性内存成本（单图最大几百 KB，可接受）；需新增一个 `viewerjs` 依赖 | **Adopt** |
| B. svg-pan-zoom + 自绘 toolbar | 0 新依赖；体积最小 | 自绘 9+ 按钮、键盘绑定、ESC、双指缩放、双击 reset、缩放原点变换；消息与文件预览两套样式；与现有 `markdown-codeblock` ghost 按钮风格不一致 | 暂不采用 |
| C. 全屏容器内重渲染 mermaid，再用 CSS `transform: scale/translate` + pointer events | 0 依赖 | 缩放/拖拽/双指/键盘全部自实现；reset 数学；与 yn 复刻的视觉/交互预期不一致 | 暂不采用 |
| D. 浏览器原生 `<dialog>` + CSS `view-transition` | 0 依赖；动画顺滑 | 工具条全部自绘（8 按钮）；跨 surface 两套样式；与 yn 的视觉/交互差异大 | 暂不采用 |
| E. 使用 `react-zoom-pan-pinch` + `react-viewer` 替代 | 生态成熟 | 与 yn 工具条顺序/图标不一致；多一个 react 渲染层；体积更大 | 暂不采用 |
| F. viewerjs 直接接管 `<svg>` 元素（不转 dataURL） | 省一次 dataURL 转换 | viewerjs 内部仍要克隆节点并定位；某些 mermaid 内嵌 `<foreignObject>` 时可能丢失；dataURL 是 yn 验证过更稳的路径 | 暂不采用，作为 fallback 留口子 |
| G. encodeURIComponent 形态的 dataURL | 写法简单 | Mermaid v11 输出的 `<style>` 块内的 CSS 文本含 `;` `{}` `,` 等字符不会被破坏但 `<` 会被破坏导致 SVG 解析失败 | **拒绝**（已采纳 A 的 base64 形态） |

## Capabilities

### New Capabilities

- `markdown-mermaid-block-fullscreen-viewer`: Markdown Mermaid 图块的全屏 viewer 契约，覆盖 `MermaidBlock`（消息侧）与 `FileMarkdownMermaidBlock`（文件预览侧）两个 surface 的入口、SVG 注入、viewerjs toolbar 按钮集合、销毁、键盘/a11y、并发单例、主题切换同步、StrictMode 防御、reduced-motion 适配。

### Modified Capabilities

- None。`file-view-markdown-github-preview` 与 `file-view-rendering-runtime-stability` 既有 mermaid requirement 不动；本 capability 描述 fullscreen 这一正交子能力。

## Impact

- 依赖：
  - `package.json` 新增 `viewerjs@^1.11.7`（与 yn 同源 1.11.x 小版本升级，1.11.7 是 1.11 系列当前 stable），同步 package-lock
- 构建：
  - `vite.config.ts` manualChunks：viewerjs 合并进 `mermaid` chunk
- 前端组件：
  - 新增 `src/features/markdown/mermaidFullscreen/MermaidFullscreenViewer.tsx`（共享）
  - 新增 `src/features/markdown/mermaidFullscreen/svgToDataUrl.ts`
  - 新增 `src/features/markdown/mermaidFullscreen/activeViewer.ts`
  - 新增 `src/features/markdown/mermaidFullscreen/preloadViewerjs.ts`
  - 新增 `src/features/markdown/mermaidFullscreen/downloadSvg.ts`（`URL.createObjectURL` + 隐藏 `<a>` + `click()` 的 SVG 下载工具；本期未在 MermaidFullscreenViewer 引用，`index.ts` 仍 export 出去，保留 utility）
  - 新增 `src/features/markdown/mermaidFullscreen/index.ts`
  - 改 `src/features/messages/components/MermaidBlock.tsx`：actions 区新增 fullscreen 按钮；render 成功后 `void preloadViewerjs()`
  - 改 `src/features/files/components/FileMarkdownPreview.tsx`：`FileMarkdownMermaidBlock` header 标签区新增 fullscreen 按钮；render 成功后 `void preloadViewerjs()`
- 样式：
  - 新增 `src/styles/mermaid-fullscreen.css`（在 `loadMermaidFullscreenStyles()` 内 dynamic import）
  - 改 `src/styles/featureStyleLoaders.ts`：新增 `loadMermaidFullscreenStyles()`
- i18n：
  - `src/i18n/locales/zh.part2.ts` / `en.part2.ts` 新增 2 个 key，归 `common.*` 命名空间
- 测试：
  - 新增 `MermaidBlock.fullscreen.test.tsx`：按钮存在性、disabled 状态、点击触发 Portal mount、ESC 触发 unmount、StrictMode 双 mount、reduced-motion 适配、并发单例、主题切换后 viewer.update 调用
  - 新增 `FileMarkdownPreview.mermaid-fullscreen.test.tsx`：Source tab disabled、Render tab 渲染中 disabled、Render tab SVG 就绪 enabled、点击触发 portal、并发单例
- OpenSpec：
  - `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/` 三件套（proposal / design / tasks）
  - `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`
  - archive 后同步到 `openspec/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`

## 验收标准

- 消息侧 Mermaid 块在 `renderState.status === "success"` 时 header 出现「全屏」按钮；点击后 viewer 全屏出现；ESC 或点击 backdrop 关闭后组件 unmount 且 viewer 销毁。
- 文件预览侧 Mermaid 块在 Source tab 时「全屏」按钮 disabled；切到 Render tab 且 SVG 已渲染时按钮可点；点击后行为同消息侧。
- toolbar 显示且功能正常：zoomIn / zoomOut / 1:1 / reset / rotateLeft / rotateRight / flipHorizontal / flipVertical 共 8 个按钮，顺序从左到右。
- toolbar 中不出现 prev / next / play 按钮（明确关闭）。
- 全屏 viewer 的 z-index ≥ `var(--z-mermaid-fullscreen, 1300)`，高于现有所有模态层。
- i18n 切换语言后 icon-only 按钮的 tooltip / aria-label 同步切换（zh: "全屏" / "放大查看图表"，en: "Fullscreen" / "Open diagram fullscreen"）。
- 主题切换（dark ↔ light / dim）期间打开的 viewerjs 背景 / toolbar / close button 主题色跟随切换，浅色系控件必须使用独立浅色 token。
- panel-lock 锁屏状态下 viewer 会被自动关闭，且 viewer 内部快捷键（Ctrl/滚轮）不污染 lock 状态。
- `npm run typecheck`、`npm run test`（vitest 批跑）通过。
- `openspec validate 2026-06-22-add-mermaid-block-fullscreen-viewer --strict --no-interactive` 通过。
- 视觉手动验证：`npm run dev` 后打开任意含 mermaid fenced block 的 .md 文件，能进入全屏并完成缩放/旋转/翻转/重置；工具条与关闭按钮在 light / dim / dark 三主题下均清晰可读；backdrop 在三主题下分别应用 18px / 16px / 14px blur；prefers-reduced-motion 用户 blur 关闭。
