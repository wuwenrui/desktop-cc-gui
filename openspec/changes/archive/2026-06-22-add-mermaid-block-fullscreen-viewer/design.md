## Context

`mossx` 渲染 Markdown 内的 Mermaid 图块存在两处独立实现：
- 消息侧 `src/features/messages/components/MermaidBlock.tsx`（被 `src/features/messages/components/Markdown.tsx` line 1407 复用）
- 文件预览侧 `src/features/files/components/FileMarkdownPreview.tsx` 内的 `FileMarkdownMermaidBlock`（line 695 起）

两者均使用 `mermaid@^11.12.2` 的 `mermaid.render(id, value)` 拿到 SVG 字符串后通过 `dangerouslySetInnerHTML` inline 注入到 `.markdown-mermaidblock-diagram` / `.fvp-file-markdown-mermaid-diagram` 容器内。header / 标签栏均缺少「全屏放大」入口，用户面对稍大的图只能：
- 浏览器自带的 Ctrl/Cmd + 滚轮缩放（缩的是整页，会把代码块、文字、UI 一起缩，体验割裂）
- 浏览器右键 → 查看 SVG 源码 / 下载（脱离应用上下文）

参考项目 `@/Users/chenxiangning/code/AI/github/yn` 已用 `viewerjs@^1.11.6` 在 `src/renderer/plugins/image-viewer.tsx`（line 78-102）稳定实现「全屏 + 工具条」能力（mossx 实际安装 `viewerjs@^1.11.7`，是同源 1.11.x 小版本升级，toolbar API 完全一致）：把 viewer 容器挂到 `document.body`，工具条配置 `toolbar:{ zoomIn, zoomOut, oneToOne, reset, prev, play, next, rotateLeft, rotateRight, flipHorizontal, flipVertical }`，由 viewerjs 自带 backdrop、ESC 关闭、双指/滚轮缩放、toolbar SVG 图标。该抽象在 yn 自身的图片预览与第三方 mermaid 扩展中复用，证明在 Vue/React 双栈下都成立。

mossx 这次按 yn 的 viewerjs 思路复刻，**不重新发明 toolbar 抽象**。yn 的 `image-viewer.tsx` 同时承担「单图全屏」与「页面内多图 viewer」两个用法，本设计只取「单图全屏」用法（`navbar: false`，关闭 `prev/next/play`），避免引入 navbar 多图切换语义。

**本期不在 toolbar 追加「下载」按钮**：viewerjs 1.11.7 不提供 `download` 按钮 / `download` 回调，源码验证（见 tasks §12 决策记录），如要下载需自绘 toolbar item，本期不做。`src/features/markdown/mermaidFullscreen/downloadSvg.ts` 仍作为 `URL.createObjectURL` 工具保留（`index.ts` 仍 export），供未来 toolbar 自绘下载按钮时直接使用。

## Goals / Non-Goals

**Goals:**

- `MermaidBlock` 与 `FileMarkdownMermaidBlock` 顶部 actions 区出现 icon-only「全屏」按钮（lucide `Maximize2`），tooltip / aria-label 走 i18n
- 按钮仅在 `renderState.status === "success"`（或等价「SVG 已就绪」状态）时启用，Source tab 与渲染中/失败状态下 disabled
- 点击后，mermaid 渲染出的 SVG 通过 `new Viewer(img, options)` 全屏展示，复用 yn 风格的工具条
- viewer 容器挂到 `document.body`（与 yn 一致），backdrop 覆盖全屏，ESC / 点击 backdrop 关闭
- 组件 unmount 时必须 `viewer.destroy()`，避免 viewerjs 持有 stale DOM 引用导致 memory leak
- 主题切换（dark ↔ light）期间已打开的 viewer 背景 / toolbar 主题色跟随切换
- panel-lock 锁屏状态打开 viewer 时，viewer 会被自动关闭，且 viewer 内部快捷键不污染 lock 状态
- 全屏 viewer 同一时刻只能存在一个（module-level 单例）
- React 18 StrictMode dev 双 mount 不导致 viewer 重复创建
- 启用 reduced-motion 时 viewerjs 不带过渡动画
- 新增 OpenSpec capability `markdown-mermaid-block-fullscreen-viewer`，覆盖两个 surface 的入口契约、SVG 注入契约、销毁契约、键盘与 a11y 契约、并发单例、主题切换、StrictMode 防御、reduced-motion 适配
- i18n 同步 zh / en

**Non-Goals:**

- 不实现 mermaid 多图块（`<!-- mermaid:begin/end -->` 之类的拆分）—— 当前 mossx 没有这种语义
- 不实现 toolbar 内的 prev/next（mermaid 单图没有「上/下一张」概念，配置里显式 `prev: false, next: false` 关闭）
- 不实现 viewerjs 的 `play`（幻灯片模式）
- 不实现 svg-pan-zoom 等额外 pan-zoom 库
- 不修改 `mermaid` 包的版本 / 主题 / 安全配置
- 不动 viewerjs 自身 CSS（仅做主题色覆盖）
- 不修改 `markdown-parse-pipeline` / `file-view-markdown-github-preview` / `file-view-rendering-runtime-stability` / `conversation-live-message-canvas-rendering` 既有 requirement 文本

## Decisions

### Decision 1: viewerjs 1.11.7 直接复用 yn 工具条配置（8 个 enabled 按钮，boolean 而非数字位置）

`viewerjs@^1.11.7` 与 yn 同源小版本（1.11.6 → 1.11.7，是 1.11 系列最新 stable，1.11.6 与 1.11.7 的 toolbar API 完全一致），工具条配置如下（用 `boolean` 让按钮顺序严格依赖 toolbar 对象 key 声明顺序）：

```ts
new Viewer(img, {
  container: document.body,
  inline: false,
  navbar: false,
  title: false,
  toolbar: {
    zoomIn: true,
    zoomOut: true,
    oneToOne: true,
    reset: true,
    rotateLeft: true,
    rotateRight: true,
    flipHorizontal: true,
    flipVertical: true,

    prev: false,
    next: false,
    play: false,
  },
})
```

**为什么用 boolean 而不是 viewerjs 的 `Visibility` 数字位置**（最初提案里写的是 1-8 升序）：
- viewerjs 1.11.7 的 `ToolbarOption` 类型为 `boolean | Visibility (0|1|2|3|4) | ToolbarButtonSize | Function | ToolbarButtonOptions`
- `Visibility` 类型枚举为 `0|1|2|3|4`，**最多只能表达 5 个位置**，无法精确表达 8 个 enabled 按钮的位置
- yn 原文 toolbar 写的 `zoomIn: 4, prev: 0` 等数字实际被 viewerjs 当作 truthy 处理（任何非 0 都是 true），yn 的 toolbar 顺序靠 `toolbar` 对象 key 声明顺序确定
- mossx 改用 `boolean` 后，按钮顺序严格依赖对象 key 声明顺序：zoomIn → zoomOut → oneToOne → reset → rotateLeft → rotateRight → flipHorizontal → flipVertical，与 yn 视觉一致
- 实测：viewerjs 渲染时按 `forEach(custom ? options.toolbar : BUTTONS, function (value, index) {...})` 遍历，自定义 toolbar 走对象 key 升序，**与 spec 契约一致**

拒绝备选：
- A2. 改用 svg-pan-zoom + 自绘 toolbar：拒绝（决策 B-方案 B 风险）
- A3. 改用浏览器 `<dialog>` + view-transition：拒绝（决策 B-方案 D 风险）
- A4. 直接 viewerjs 接管 `<svg>` 元素：拒绝（某些 mermaid 含 `<foreignObject>` 时丢内容，dataURL 是 yn 验证过更稳的路径）

### Decision 2: SVG → UTF-8 安全 base64 dataURL → `<img>` 注入

`MermaidFullscreenViewer` 收到 `svg: string` 后：

```ts
function svgToDataUrl(svg: string): string {
  // UTF-8 安全的 base64 编码，兼容 Mermaid v11 输出 <style> 块内的 CSS 内容
  const utf8Bytes = new TextEncoder().encode(svg);
  let binary = "";
  utf8Bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}
```

然后 `<img src={dataUrl} ref={imgRef} alt="" aria-hidden="true" />`，viewerjs 接管该 `<img>`。

**为什么不用 `encodeURIComponent`**：Mermaid v11 渲染出的 SVG 经常带 `<style>` 块，块内 CSS 文本含大量未编码字符，`encodeURIComponent` 在某些边界字符（`<` 与连续 `<!--`）下会让浏览器把 `data:image/svg+xml;charset=utf-8,...` 解析失败。base64 是 yn 验证过最稳的路径。

**a11y**：`<img>` 加 `alt=""` + `aria-hidden="true"`（mermaid 是装饰性图，不是文档内容；屏幕阅读器应跳过）。

### Decision 3: React Portal 挂到 document.body + StrictMode 防御 + `hidden` 事件触发 onClose

`MermaidFullscreenViewer` 通过 `createPortal(<img/>, document.body)` 挂载。

实际代码 `src/features/markdown/mermaidFullscreen/MermaidFullscreenViewer.tsx`：

- `useEffect` 依赖 `[open, svg]`，`onClose` 通过 `onCloseRef` 引用 latest 避免 effect 重跑
- `imgRef` 通过 `useRef` 保存
- cleanup 闭包内同步读 `viewer` 闭包变量, 配合 `cancelled` flag 处理 StrictMode 双 mount
- 关键: 构造 viewer 后**立即 `viewer.show()`**(详见 Decision 11)

**事件契约**：
- `hidden`：viewerjs 用户主动关闭（ESC/点 backdrop）时触发，**唯一 onClose 触发点**
- `cancelled` 标志：StrictMode 双 mount 期间，第一次 cleanup 把第二次的 effect 取消，避免双 viewer
- 组件 unmount 时 cleanup 同步 `viewer.destroy()`，**不**通过 viewerjs `destroyed` 事件触发 onClose（避免在已 unmount 的组件上 setState）

**为什么不复制 yn 的 `wrapEventBind` hack**：yn 的 hack 是因为 viewerjs 默认 `bind` 到整个 view DOM（含所有 `<img>`）。mossx 一次只挂一个 `<img>`，**不需要**这个 hack。

**为什么不复制 yn 的 `wrapEventBind` hack**：yn 的 hack 是因为 viewerjs 默认 `bind` 到整个 view DOM（含所有 `<img>`）。mossx 一次只挂一个 `<img>`，**不需要**这个 hack。

### Decision 4: 共享组件位于 `src/features/markdown/mermaidFullscreen/`

`MermaidBlock`（在 `features/messages`）和 `FileMarkdownMermaidBlock`（在 `features/files`）都需要引用全屏 viewer 组件。

原因：
- 现有的 messages / files feature 互相不直接 import（避免反向依赖）
- 新建 `features/markdown/mermaidFullscreen/` 属于 cross-feature shared，命名空间清晰
- 与 `markdown-parse-pipeline` spec 命名空间一致
- 该 spec 命名 `markdown-mermaid-block-fullscreen-viewer` 沿用 `markdown-parse-pipeline` 的跨 surface 命名先例

拒绝备选：
- C1. 放在 `src/components/mermaid/FullscreenViewer.tsx`：拒绝（与现有 `src/components/` 公共组件风格不完全匹配；现有 mermaid 块都在 features/ 下）
- C2. 在 messages 和 files 各复制一份：拒绝（重复实现，且后续修一处要改两处）

### Decision 5: viewerjs CSS 通过 `loadMermaidFullscreenStyles()` 按需加载

viewerjs 自带 CSS 在 `viewerjs/dist/viewer.css`，主题色覆盖写在 `src/styles/mermaid-fullscreen.css`，由 `src/styles/featureStyleLoaders.ts` 新增 `loadMermaidFullscreenStyles()`，在 `MermaidFullscreenViewer` 第一次 `open=true` 时调用。

原因：
- viewerjs CSS 全局生效即可（选择器是 `.viewer-*`，无命名空间冲突）
- 与 mossx 现有的 `featureStyleLoaders.ts` 风格一致（`loadSettingsStyles()` 等）
- 按需加载：用户没看 mermaid 时不应该加载 viewerjs
- 主题色覆盖按 CSS 变量使用，与 `panel-lock` 同思路

### Decision 6: 工具条按钮集合 = yn 单图用法

toolbar 启用：`zoomIn / zoomOut / oneToOne / reset / rotateLeft / rotateRight / flipHorizontal / flipVertical`（8 个，按 toolbar 对象 key 声明顺序展示）
toolbar 关闭：`prev / next / play`（值 `false`）

### Decision 7: z-index 通过 CSS 变量暴露，取 1300

```css
:root {
  --z-mermaid-fullscreen: 1300;
}
.viewer-container { z-index: var(--z-mermaid-fullscreen); }
```

最高 z-index 调查：
- `kanban.css:1168: z-index: 1200`（最高硬编码）
- `panel-lock.css: z-index: 120`（锁屏，数值不高但语义最高）
- 取 1300 留 100 buffer 给未来加 toast / sheet

viewerjs 1.11.7 内部对 backdrop / toolbar / canvas 的 z-index 都是相对其容器计算的，**根容器 z-index 决定一切**。

### Decision 8: 首次渲染成功后预热 viewerjs

`MermaidBlock` 与 `FileMarkdownMermaidBlock` 在 `renderState.svg` 首次就绪时 `void preloadViewerjs()`，避免首次点击 Fullscreen 时 `await import("viewerjs")` 的 ~50-200ms 抖动。

```ts
// preloadViewerjs.ts
let viewerjsPromise: Promise<unknown> | null = null;
export function preloadViewerjs(): Promise<unknown> {
  if (!viewerjsPromise) {
    viewerjsPromise = import("viewerjs");
  }
  return viewerjsPromise;
}
```

### Decision 9: i18n key 归 `common.*` 命名空间，两处 surface 复用

新增 `common.markdownMermaidFullscreen` 与 `common.markdownMermaidFullscreenHint`，两处 surface 都引用同一 key，分别承载 icon-only 按钮的 `title` 与 `aria-label`，避免未来改文案要改两处。

### Decision 10: panel-lock 状态下 viewer 主动关闭

### Decision 11: viewerjs modal 模式必须显式调用 `viewer.show()`

`new Viewer(img, options)` 在 modal 模式（`inline: false`）下**不会自动调 `show()`**。这是 viewerjs 1.11.7 的设计：它的 init 末尾给 bound element 挂 `EVENT_CLICK` 监听，等用户点击那个 img 触发 `view()`→`show()`。

mossx 是 button-driven（用户点 actions 区的 Maximize2 按钮触发全屏），不是 click-on-img-driven，所以**必须**在 `new ViewerCtor(...)` 之后、注册任何 observer 之前显式 `viewer.show()`，否则 backdrop / toolbar 永远不出现。

依据：
- `node_modules/viewerjs/dist/viewer.js:1663-1720` `show()` 函数体
- `node_modules/viewerjs/dist/viewer.js:2962-3000` `init()` 函数体（modal 模式分支不调 show）
- `node_modules/viewerjs/dist/viewer.js:3030-3035` modal 模式挂 click 监听

回归测试 `MermaidBlock.viewer-show.test.tsx` mock viewerjs 构造函数, 断言 `ctor` + `show` 都被调; 删掉 `viewer.show()` 该测试立刻红。

### Decision 12: 主题适配与工具条/关闭按钮的色彩策略

viewerjs 1.11.7 把所有 toolbar 图标 + close 图标塞进**单张内联 base64 SVG sprite**，所有 path `fill="#fff"` 写死白填充，`color` 属性无法到达 path 颜色。

设计三种候选:
- **A. `mask-image` 重新应用同一张 sprite**（第一轮实施路径）: 失败。`background-size: 280px` 把原 560 宽 sprite 缩了一半, mask 偏移如果照搬 `background-position` 数值, 在 20px 宽的 `::before` 元素上会偏移到错的位置（icon 看着像空, 表现为"按钮组消失"）
- **B. `filter: invert(1) brightness(...)` 应用在 `::before`**（第二轮最终方案, 验收通过）: 保留 viewerjs 原 `background-image` 不动, 仅用 CSS `filter` 做主题反色. 默认深色主题 `filter: none`（白 sprite 直接显示）, light 主题 `invert(1) brightness(0.85)`（白 → 黑）, dim 主题 `invert(1) brightness(0.9)`。简单可靠, 不复制 sprite, 不算 mask 偏移
- **C. 自绘 toolbar**（拒绝）: 与 yn 视觉/交互差异大, 工作量大

backdrop 在三主题下分别应用 18px / 16px / 14px `backdrop-filter: blur()`, 由 CSS 变量 `--mermaid-fullscreen-blur` + `--mermaid-fullscreen-tint` 驱动。`@media (prefers-reduced-motion: reduce)` 把 blur 强制置 0。

`.viewer-button`（右上角关闭按钮）默认态采用 `border: 1px solid var(--mermaid-fullscreen-button-border)` + `background: var(--mermaid-fullscreen-button-bg)`, 即默认就有清晰视觉边界（用户要求"鼠标不悬停也要有这个样式"）, hover 切 `--mermaid-fullscreen-button-hover-bg`, 不叠加 outline 与 border。

2026-06-22 浅色系复修：light / dim 不能复用 dark 的 `surface-overlay` 控件色。`.viewer-toolbar`、toolbar item、右上角 close button 分别通过 `--mermaid-fullscreen-toolbar-bg`、`--mermaid-fullscreen-toolbar-item-bg`、`--mermaid-fullscreen-toolbar-item-hover-bg`、`--mermaid-fullscreen-button-bg`、`--mermaid-fullscreen-button-border`、`--mermaid-fullscreen-button-hover-bg` 做 per-theme override。light 使用更亮的白/浅灰半透明控件底，dim 使用介于 light 和 dark 之间的冷灰底，dark 保持原深色逻辑。

`MermaidFullscreenViewer` 通过 `MutationObserver(document.documentElement, attributes)` 监听主题切换（复用 `isThemeMutationAttribute` utility）, 触发 `viewer.update()` 让 viewerjs 重读 CSS 变量。


`MermaidFullscreenViewer` 监听 `document.body` 的 `childList / subtree` 变化（`MutationObserver`），一旦 querySelector 命中 `.panel-lock-overlay` 节点，立即 `viewer.destroy()` 并 `onClose()`。

**为什么监听 body 而不是 html 的 `panel-lock-active` 属性**：项目里 panel-lock 实际形态是 `LockScreenOverlay.tsx` 把 `.panel-lock-overlay` 节点塞到 `document.body`（不通过 `data-*` 属性触发）。用 `childList + subtree` 监听 body 比猜属性名更稳。

## Architecture

### Component Tree

```
MermaidBlock (features/messages)
├── header
│   ├── <span>MERMAID</span>
│   └── actions
│       ├── Source/Preview toggle
│       ├── Copy
│       ├── CopyFenced
│       └── [NEW] Fullscreen (lucide Maximize2, disabled if !svg)
└── MermaidFullscreenViewer (features/markdown/mermaidFullscreen)
    └── createPortal(<img data-url={dataUrl}/>, document.body)
        └── new Viewer(img, options).show()

FileMarkdownMermaidBlock (features/files)
├── header label
│   ├── <span>Mermaid</span>
│   ├── tabs (Source / Render)
│   └── [NEW] Fullscreen (lucide Maximize2, disabled if !svg)
└── MermaidFullscreenViewer (shared)
```

### Data Flow

1. Mermaid 块渲染完成后持有 `svg: string`, `void preloadViewerjs()` 预热
2. 用户点击 Fullscreen → 父组件 setState `isFullscreenOpen = true`
3. 父组件把 `svg` 传给 `<MermaidFullscreenViewer open={...} svg={...} onClose={...} />`（本期不带 `filename` prop, 因 viewerjs 1.11.7 无 download 按钮, 文件名无意义）
4. MermaidFullscreenViewer 在 `open=true` 时 `loadMermaidFullscreenStyles()` 一次; createPortal 渲染 `<img>`; `await preloadViewerjs()`; `new Viewer(img, options)`; **立即 `viewer.show()`**（Decision 11）
5. 用户点 ESC / 点 backdrop / 关闭 → viewerjs 触发 `hidden` 事件 → 父组件 `onClose` → setState `isFullscreenOpen = false`
6. MermaidFullscreenViewer unmount → cleanup 中 `viewer.destroy()`；仅当 `getActiveViewer() === viewer` 时 `setActiveViewer(null)`，避免旧 viewer cleanup 清掉新 viewer 引用
7. 主题切换期间 `MutationObserver(document.documentElement, attributes)` 触发 `viewer.update()`, viewerjs 重读 CSS 变量
8. panel-lock 状态开启 → `MutationObserver(document.body)` 命中 `.panel-lock-overlay` → `viewer.destroy()` + `onClose()`

### Error Handling

- SVG 字符串为空 / 渲染失败: Fullscreen 按钮 disabled
- viewerjs 初始化抛错: 在 IIFE 内未 try/catch, 会 propagate 到 React error boundary; 当前未加 error boundary, 后续加固
- `document.body` 不存在（罕见 SSR 场景）: viewerjs 自带防御, `if (!open || !svg || typeof document === "undefined") return null` 兜底
- `viewer.destroy()` 抛错: cleanup 中 try/catch 兜底
- dataURL 编码失败（极少）: `btoa` 抛错 → propagate, 同上
- `<img>` 加载失败（mermaid 11 输出极端 SVG）: 本期未加 `<img>.onerror`, 后续加固

### Performance

- viewerjs CSS 由 `loadMermaidFullscreenStyles()` 按需加载
- viewerjs JS 由 `preloadViewerjs()` 在 SVG 首次就绪时预热
- 单图 SVG → base64 encode 一次性，< 1ms（小图）/ < 10ms（大图，< 100KB SVG）
- 关闭 viewerjs 释放 `<img>` src blob，无内存泄漏
- module-level `activeViewer` 单例保证同一时刻只一个 viewer 创建

## File-level Changes

### New

- `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/proposal.md`（已写, 本期回写更新）
- `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/design.md`（本文, 本期回写更新）
- `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/tasks.md`（本期回写, 标记 [x] 已完成子项）
- `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`（10 个 Requirement / 29 个 Scenario）
- `src/features/markdown/mermaidFullscreen/MermaidFullscreenViewer.tsx`
- `src/features/markdown/mermaidFullscreen/svgToDataUrl.ts`
- `src/features/markdown/mermaidFullscreen/activeViewer.ts`
- `src/features/markdown/mermaidFullscreen/preloadViewerjs.ts`
- `src/features/markdown/mermaidFullscreen/downloadSvg.ts`（本期未引用, 保留 utility）
- `src/features/markdown/mermaidFullscreen/index.ts`
- `src/styles/mermaid-fullscreen.css`
- `src/features/messages/components/MermaidBlock.fullscreen.test.tsx`（5 个 test）
- `src/features/messages/components/MermaidBlock.viewer-show.test.tsx`（1 个 test, 验 `viewer.show()` 被调）
- `src/features/files/components/FileMarkdownPreview.mermaid-fullscreen.test.tsx`（3 个 test）
- `src/styles/mermaid-fullscreen.theme.test.ts`（11 个 test, 验主题适配 CSS）

### Modified

- `package.json`（新增 `viewerjs@^1.11.7`）
- `package-lock.json`（同步）
- `vite.config.ts`（manualChunks：viewerjs 合并进 mermaid chunk）
- `src/features/messages/components/MermaidBlock.tsx`（新增 fullscreen 按钮 + Portal 触发 + preloadViewerjs）
- `src/features/files/components/FileMarkdownPreview.tsx`（FileMarkdownMermaidBlock 标签栏新增 fullscreen 按钮 + preloadViewerjs）
- `src/styles/featureStyleLoaders.ts`（新增 `loadMermaidFullscreenStyles`）
- `src/i18n/locales/zh.part2.ts`（新增 2 个 key，归 `common.*`）
- `src/i18n/locales/en.part2.ts`（同上）

### Synced (post-archive)

- `openspec/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`
