## 1. Dependency And Build

- [x] 1.1 [P0][depends:none][I: `package.json` dependencies][O: `viewerjs: ^1.11.7` 已加入 dependencies（与 yn 同属 1.11.x）][V: `package.json` / `package-lock.json` diff 行存在；`node_modules/viewerjs/package.json` version 为 1.11.7] 引入 `viewerjs@^1.11.7`。
- [x] 1.2 [P0][depends:1.1][I: `vite.config.ts` manualChunks 配置][O: viewerjs 合并进 `vendor-mermaid` chunk（沿用 journal-14 的 mermaid/docs/ui-heavy 分包策略）][V: `npm run build` 产物中 viewerjs 出现在 `vendor-mermaid` chunk；`npm run check:bundle-chunking` 退出码 0，`vendor-mermaid` advisory pass] 把 viewerjs 合并进 mermaid chunk。
- [x] 1.3 [P0][depends:1.1][I: `src/styles/featureStyleLoaders.ts`][O: 新增 `loadMermaidFullscreenStyles()`，按需加载 `viewerjs/dist/viewer.css` 与 `./mermaid-fullscreen.css`][V: `featureStyleLoaders.ts` 中存在该函数；`grep loadMermaidFullscreenStyles src/styles/featureStyleLoaders.ts` 返回结果] 新增按需样式加载器。

## 2. Shared Utilities

- [x] 2.1 [P0][depends:1.1][I: 新文件 `src/features/markdown/mermaidFullscreen/svgToDataUrl.ts`][O: 导出 `svgToDataUrl(svg: string): string`，使用 `TextEncoder` + `btoa` 实现 UTF-8 安全的 base64 编码，返回 `data:image/svg+xml;base64,...`][V: `MermaidBlock.fullscreen.test.tsx` 覆盖 portal `<img>` dataURL 注入；`npm run typecheck` 退出码 0] 实现 UTF-8 安全的 svg → dataURL 编码。
- [x] 2.2 [P0][depends:1.1][I: 新文件 `src/features/markdown/mermaidFullscreen/activeViewer.ts`][O: 导出 `setActiveViewer(v: Viewer | null): void`、`getActiveViewer(): Viewer | null`、`destroyActiveViewer(): void`][V: module-level 单例；`MermaidBlock.fullscreen.test.tsx` 覆盖旧 viewer cleanup 不清空新 active viewer] module-level 单例。
- [x] 2.3 [P0][depends:1.1][I: 新文件 `src/features/markdown/mermaidFullscreen/preloadViewerjs.ts`][O: 导出 `preloadViewerjs(): Promise<typeof import("viewerjs")>`，module-level Promise 缓存，多次调用返回同一 Promise][V: `npm run typecheck` 退出码 0；messages / files 两处成功态调用预热] viewerjs 预热。
- [x] 2.4 [P0][depends:2.1, 2.2, 2.3][I: 新文件 `src/features/markdown/mermaidFullscreen/index.ts`][O: 导出 `MermaidFullscreenViewer` / `svgToDataUrl` / active viewer helpers / `preloadViewerjs` / `downloadSvg`][V: tsc 通过；其他文件可通过共享目录引用] 共享入口。

## 3. Shared Component

- [x] 3.1 [P0][depends:1.1, 2.1, 2.2, 2.3][I: 新文件 `src/features/markdown/mermaidFullscreen/MermaidFullscreenViewer.tsx`][O: 接收 `{ open, svg, onClose }` props；当 `open=true` 时调用 `loadMermaidFullscreenStyles()` + `createPortal(<img ref={imgRef} src={svgToDataUrl(svg)} alt="" aria-hidden="true" />, document.body)`；`useEffect([open, svg])` 内 `await preloadViewerjs()` 后 `new Viewer(img, options)` + `viewer.show()`；`options.hidden` 调 `onClose`；`options.shown` 调 `setActiveViewer(viewer)`；transition 跟随 `prefers-reduced-motion`；cleanup 中 destroy，且仅当 `getActiveViewer() === viewer` 时 `setActiveViewer(null)`][V: tsc 通过；visual manual 验证全屏可用；StrictMode 双 mount 测试通过] 实现 `MermaidFullscreenViewer` 组件。
- [x] 3.2 [P0][depends:3.1][I: `MermaidFullscreenViewer` 内部 viewerjs options][O: `{ container: document.body, inline: false, navbar: false, title: false, transition: !reducedMotion, toolbar: { zoomIn: true, zoomOut: true, oneToOne: true, reset: true, rotateLeft: true, rotateRight: true, flipHorizontal: true, flipVertical: true, prev: false, next: false, play: false } }`][V: OpenSpec spec delta 锁定 8 按钮顺序；真实 dev 视觉验证 toolbar 8 按钮可用] 工具条 8 按钮位置严格。
- [x] 3.3 [P0][depends:3.1][I: `MermaidFullscreenViewer` 销毁路径][O: 组件 unmount 时 cleanup 调用 `viewer.destroy()`；viewerjs 用户主动关闭（ESC / 点 backdrop）时 `hidden` 事件触发 `onClose` 同步父组件 state；`activeViewer` singleton 只由当前 active viewer 的 cleanup 清空，旧 viewer cleanup 不得清掉新 viewer 引用][V: `MermaidBlock.fullscreen.test.tsx` 覆盖 unmount cleanup 与旧 viewer cleanup ownership check] viewer 销毁与父组件 + singleton 同步。
- [x] 3.4 [P0][depends:3.1][I: `MermaidFullscreenViewer` 主题切换同步][O: `useEffect` 内监听 `document.documentElement` 的 `MutationObserver`，触发 `isThemeMutationAttribute(mutation.attributeName)` 时调 `viewer.update()`；组件 unmount 时 disconnect observer][V: visual 验证 dark / dim / light 切换时 toolbar / backdrop 主题色同步] 主题切换同步。
- [x] 3.5 [P0][depends:3.1][I: `MermaidFullscreenViewer` panel-lock 状态联动][O: 监听 `document.body` childList/subtree，一旦出现 `.panel-lock-overlay` 节点即调 `viewer.destroy()` + `onClose()`；组件 unmount 时 disconnect observer][V: spec delta 与实现一致；visual 验证开启 panel-lock 时全屏 viewer 立即关闭] panel-lock 联动。
- [x] 3.6 [P0][depends:3.1][I: `MermaidFullscreenViewer` StrictMode 防御][O: `useEffect` 内 `let cancelled = false`，`preloadViewerjs().then()` 后再次检查 `cancelled`；cleanup 中设置 `cancelled = true`；新 viewer 创建前 `destroyActiveViewer()` 兜底][V: `MermaidBlock.fullscreen.test.tsx` StrictMode case 通过] StrictMode 防御。

## 4. Messages Surface

- [x] 4.1 [P0][depends:2.4, 3.1][I: `src/features/messages/components/MermaidBlock.tsx` 顶部 import 区][O: 新增共享组件与 `import Maximize2 from "lucide-react/dist/esm/icons/maximize-2"`][V: 编译通过且 lint 不触发 restricted import] 在 `MermaidBlock` 引入共享组件与 lucide icon。
- [x] 4.2 [P0][depends:4.1][I: `MermaidBlock` 组件 state 与 useEffect][O: 新增 `const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)`；在 `renderState.status === "success"` 的 useEffect 内 `void preloadViewerjs()` 一次（依赖 `renderState`）][V: typecheck 通过；首次成功渲染后预热 `viewerjs`] 增加 fullscreen state + 预热。
- [x] 4.3 [P0][depends:4.2][I: `MermaidBlock` header `.markdown-mermaidblock-actions` 内][O: 在 CopyFenced 之后新增 icon-only `<button>`，子节点仅 `<Maximize2 size={14} aria-hidden />`，`aria-label` / `title` 走 `common.markdownMermaidFullscreen{,Hint}`，非 success 状态 disabled][V: visual 验证按钮出现；source/loading/error 状态下按钮 disabled] 在 actions 区插入 Fullscreen 按钮。
- [x] 4.4 [P0][depends:4.3][I: `MermaidBlock` JSX 末尾][O: 挂 `<MermaidFullscreenViewer open={isFullscreenOpen} svg={renderState.status === "success" ? renderState.svg : ""} onClose={() => setIsFullscreenOpen(false)} />`][V: 触发后 viewer 全屏出现；ESC 后 Portal 卸载] 挂载 MermaidFullscreenViewer。
- [x] 4.5 [P1][depends:4.4][I: 新文件 `src/features/messages/components/MermaidBlock.fullscreen.test.tsx` + `MermaidBlock.viewer-show.test.tsx`][O: 6 个 fullscreen 行为用例 + 1 个 viewer.show 回归用例，覆盖 disabled/enabled、portal mount、cleanup、StrictMode、activeViewer ownership、modal show][V: 目标 vitest 中 messages 侧 7 个用例全部通过] 新增 Fullscreen 行为单测。

## 5. Files Surface

- [x] 5.1 [P0][depends:2.4, 3.1][I: `src/features/files/components/FileMarkdownPreview.tsx` 顶部 import 区][O: 新增共享组件与 `import Maximize2 from "lucide-react/dist/esm/icons/maximize-2"`][V: 编译通过且 lint 不触发 restricted import] 在 `FileMarkdownMermaidBlock` 引入共享组件与 lucide icon。
- [x] 5.2 [P0][depends:5.1][I: `FileMarkdownMermaidBlock` 组件 state 与 useEffect][O: 新增 `const [isFullscreenOpen, setIsFullscreenOpen] = useState(false)`；在 `visibleSvg` 就绪后 `void preloadViewerjs()` 一次][V: typecheck 通过；首次成功渲染后预热 `viewerjs`] 增加 fullscreen state + 预热。
- [x] 5.3 [P0][depends:5.2][I: `FileMarkdownMermaidBlock` header `.fvp-file-markdown-codeblock-label` 内][O: 在 Source/Render tabs 之后新增 icon-only fullscreen button，`aria-label` / `title` 走 `common.markdownMermaidFullscreen{,Hint}`，`activeTab !== "render" || !visibleSvg` 时 disabled][V: Source tab / 渲染中按钮 disabled；切到 Render tab 且 SVG 就绪时按钮 enabled] 在标签栏插入 Fullscreen 按钮。
- [x] 5.4 [P0][depends:5.3][I: `FileMarkdownMermaidBlock` JSX 末尾][O: 挂 `<MermaidFullscreenViewer open={isFullscreenOpen} svg={visibleSvg ?? ""} onClose={() => setIsFullscreenOpen(false)} />`；本期不传 `filename` prop，因 viewerjs 1.11.7 无 download 按钮][V: 触发后 viewer 全屏出现；ESC 后 Portal 卸载] 挂载 MermaidFullscreenViewer。
- [x] 5.5 [P1][depends:5.4][I: 新文件 `src/features/files/components/FileMarkdownPreview.mermaid-fullscreen.test.tsx`][O: 3 个 vitest 用例：Source tab disabled、Render tab SVG 就绪 enabled、点击按钮触发 portal `<img>` mount][V: 目标 vitest 中文件预览侧 3 个用例全部通过] 新增 Fullscreen 行为单测。

## 6. i18n

- [x] 6.1 [P0][depends:none][I: `src/i18n/locales/zh.part1.ts` `common.*` 命名空间][O: 新增 `common.markdownMermaidFullscreen: "全屏"` 与 `common.markdownMermaidFullscreenHint: "放大查看图表"`，避免 `part2` 顶层 `common` 浅层覆盖既有 common key][V: `zh.common.close` 仍为 "关闭"，新 key 返回 "全屏"] 新增 zh i18n。
- [x] 6.2 [P0][depends:6.1][I: `src/i18n/locales/en.part1.base.ts` `common.*` 命名空间][O: 新增 `common.markdownMermaidFullscreen: "Fullscreen"` 与 `common.markdownMermaidFullscreenHint: "Open diagram fullscreen"`，避免 `part2` 顶层 `common` 浅层覆盖既有 common key][V: `en.common.close` 仍为 "Close"，新 key 返回 "Fullscreen"] 新增 en i18n。
- [x] 6.3 [P1][depends:6.1, 6.2][I: i18n key 跨语言 fallback][O: messages surface 与 files surface 复用 `common.markdownMermaidFullscreen` / `common.markdownMermaidFullscreenHint` 作为 icon-only 按钮的 `title` / `aria-label`][V: 切换语言后两处 tooltip / aria-label 同步切换] 跨语言同步。

## 7. Style

- [x] 7.1 [P0][depends:1.1][I: 新文件 `src/styles/mermaid-fullscreen.css`][O: 定义 `--z-mermaid-fullscreen: 1300`、三主题 backdrop blur/tint、toolbar/close button 专属控件变量、viewerjs sprite icon filter、`.viewer-container` z-index][V: `src/styles/mermaid-fullscreen.theme.test.ts` 13/13；visual 验证三主题控件对比度] 实现 viewerjs 主题色覆盖。
- [x] 7.2 [P1][depends:4.3, 5.3, 7.1][I: `.markdown-mermaidblock` / `.fvp-file-markdown-mermaid` 内部 Fullscreen 按钮样式][O: 消息侧沿用 `markdown-codeblock-copy` ghost 按钮风格；文件侧使用 `fvp-file-markdown-mermaid-fullscreen` icon-only 样式；icon 14px][V: visual 验证按钮 hover/active 反馈与现有 actions 区一致] 内部 Fullscreen 按钮与现有 actions 区风格一致。

## 8. OpenSpec Writeback

- [x] 8.1 [P0][depends:3.1][I: 新文件 `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`][O: `## ADDED Requirements` 覆盖入口契约、SVG 注入、viewerjs toolbar、显式 `viewer.show()`、销毁、并发单例、主题切换、StrictMode + reduced-motion + panel-lock、三主题控件色][V: 文件存在且内容完整] 写 spec delta。
- [x] 8.2 [P0][depends:8.1][I: change 三件套][O: `openspec validate 2026-06-22-add-mermaid-block-fullscreen-viewer --strict --no-interactive` 退出码 0][V: 命令输出无 error] 跑 OpenSpec 严格校验。
- [x] 8.3 [P0][depends:1.1, 2.x, 3.x, 4.x, 5.x, 6.x, 7.x, 8.1, 8.2][I: 仓库级 TS 校验][O: `npm run typecheck` 退出码 0][V: 命令退出码为 0] 跑仓库级 typecheck 硬门禁。
- [x] 8.4 [P0][depends:4.5, 5.5][I: 仓库级 vitest 批跑][O: `npx vitest run src/features/messages/components/MermaidBlock.fullscreen.test.tsx src/features/messages/components/MermaidBlock.viewer-show.test.tsx src/features/files/components/FileMarkdownPreview.mermaid-fullscreen.test.tsx src/styles/mermaid-fullscreen.theme.test.ts` 23/23 通过][V: vitest 输出 0 failure] 跑仓库级 vitest 批跑。

## 9. Live Verification

- [x] 9.1 [P0][depends:8.3, 8.4][I: 一次 `npm run dev` 起的开发服务器][O: 打开任一含 mermaid fenced block 的 .md 文件，消息侧与文件预览侧均能点击 Fullscreen 进入全屏；toolbar 8 个按钮可点击；ESC / close / backdrop 关闭后无 console error / DOM 残留][V: 用户于 2026-06-22 11:00 反馈"目前功能都对 验收通过"] 视觉手动验证。
- [x] 9.2 [P0][depends:8.3, 8.4][I: 一次 `npm run dev` 起的开发服务器 + i18n 切换][O: 切换语言后两处 icon-only 按钮 tooltip / aria-label 同步切换（zh: "全屏" / "放大查看图表"，en: "Fullscreen" / "Open diagram fullscreen"）][V: visual 验证] i18n 切换验证。
- [x] 9.3 [P0][depends:8.3, 8.4][I: 一次 `npm run dev` 起的开发服务器 + 主题切换][O: 打开全屏 viewer 后切换 dark / dim / light 主题，viewer 内部 backdrop / toolbar / close button 主题色跟随切换][V: visual 验证；浅色系控件色复修完成] 主题切换验证。
- [x] 9.4 [P1][depends:8.3, 8.4][I: 一次 `npm run dev` 起的开发服务器 + panel-lock][O: 打开全屏 viewer 后触发 panel-lock 状态，viewer 立即关闭且父组件 `isFullscreenOpen` 回到 false][V: visual 验证 + OpenSpec scenario 同步] panel-lock 联动验证。

## 10. Archive Gate

- [x] 10.1 [P0][depends:8.2, 8.3, 8.4, 9.1, 9.2, 9.3, 9.4][I: 全部 task 完成 + OpenSpec 校验通过 + typecheck + vitest + live 验证通过][O: 由于当前 `openspec` CLI 拒绝以数字开头的 change id，等价手工同步 spec delta 到 main spec 并移动 change 目录到 archive][V: `openspec/specs/markdown-mermaid-block-fullscreen-viewer/spec.md` 内容已同步] 跑 archive 命令。

## 11. Follow-up: 入口按钮去文案（保留 icon）

- [x] 11.1 [P2][depends:7.2][I: `src/features/messages/components/MermaidBlock.tsx` 全屏 button 节点][O: button 子节点仅保留 `<Maximize2 size={14} aria-hidden />`；`aria-label` 与 `title` 仍指向 `common.markdownMermaidFullscreen{,Hint}`][V: 视觉验证按钮只显示 icon；DevTools Elements 面板检查 button 元素 innerHTML 不含文案文本节点；aria-label 属性值仍非空] 消息侧入口去文案。
- [x] 11.2 [P2][depends:7.2][I: `src/features/files/components/FileMarkdownPreview.tsx` `fvp-file-markdown-mermaid-fullscreen` button 节点][O: 同 11.1][V: 同 11.1] 文件预览侧入口去文案。
- [x] 11.3 [P2][depends:11.1, 11.2][I: i18n key 复用][O: `common.markdownMermaidFullscreen` / `common.markdownMermaidFullscreenHint` 仍被 `aria-label` 与 `title` 引用；i18n 校验不报 unused key][V: 切换 zh / en 后 hover tooltip 文本同步] i18n key 仍承载 aria-label 与 title。
- [x] 11.4 [P2][depends:11.1, 11.2, 11.3][I: 回归校验链][O: `npm run typecheck` 退出码 0；`npx vitest run src/features/messages/components/MermaidBlock.fullscreen.test.tsx src/features/messages/components/MermaidBlock.viewer-show.test.tsx src/features/files/components/FileMarkdownPreview.mermaid-fullscreen.test.tsx src/styles/mermaid-fullscreen.theme.test.ts` 23/23 通过；`openspec validate 2026-06-22-add-mermaid-block-fullscreen-viewer --strict --no-interactive` 退出码 0][V: 三条命令全部 0 退出码] 跑回归。

## 12. 修复: viewerjs modal 模式需要显式 show()

- [x] 12.1 [P0][I: `node_modules/viewerjs/dist/viewer.js` lines 1663-1720 (show), 2962-3000 (init), 3049-3140 (build)][O: viewerjs modal 模式 (`inline: false`) 下,`new Viewer()` 不自动调 `show()`,它只在 `init` 末尾给 bound element 挂 click 监听,等用户点击触发 `view()`→`show()`。我们这里是 button-driven 而不是 click-on-img-driven,所以必须手动 `viewer.show()`][V: 真实 dev 中点击全屏按钮,viewerjs backdrop + toolbar 出现] **根因**:`MermaidFullscreenViewer.tsx` 构造 viewer 后没调 `show()`,backdrop 永不出现。
- [x] 12.2 [P0][depends:12.1][I: `src/features/markdown/mermaidFullscreen/MermaidFullscreenViewer.tsx` line ~125][O: 在 `new ViewerCtor(imgRef.current, {...})` 与 `themeObserver` 初始化之间新增 `viewer.show();` 调用,带 4 行注释解释 viewerjs modal 不自动 show][V: typecheck 0;vitest 9/9] **修复**。
- [x] 12.3 [P0][depends:12.2][I: 新文件 `src/features/messages/components/MermaidBlock.viewer-show.test.tsx`][O: vi.mock `viewerjs` 提供 ctorSpy + showSpy;点击全屏按钮后断言 ctorSpy 被调 1 次且 showSpy 被调 ≥1 次][V: `npx vitest run MermaidBlock.viewer-show.test.tsx` 1/1 通过] **回归测试**。
- [x] 12.4 [P1][depends:12.3][I: 真实 dev 复测][O: `npm run dev` + 含 mermaid 的 .md;点击全屏看到 backdrop + toolbar;按 ESC 关闭;再次点击全屏仍能打开][V: 视觉手动验证] 真实浏览器复测。

## 13. 微调: backdrop 主题适配 blur

- [x] 13.1 [P1][I: `src/styles/mermaid-fullscreen.css`][O: `:root` 暴露 `--mermaid-fullscreen-blur` (默认 14px) 与 `--mermaid-fullscreen-tint` (默认 `var(--surface-base) 80% transparent`);`.viewer-backdrop` 改用 CSS 变量驱动 `backdrop-filter` 与 `background`;`:root[data-theme="light"]` 覆写 blur=18px / tint 70%;`:root[data-theme="dim"]` 覆写 blur=16px / tint 76%;`@media (prefers-reduced-motion: reduce)` 覆写 blur=0px][V: DevTools 检查 `.viewer-backdrop` 在三个主题 + reduced-motion 下分别命中不同变量值] **CSS 改写**。
- [x] 13.2 [P1][depends:13.1][I: `src/styles/mermaid-fullscreen.css`][O: `.viewer-toolbar` 背景改为 `color-mix(in srgb, var(--surface-overlay) 80%, transparent)` 让 backdrop-filter 透出;`> ul > li` 默认背景改为 `color-mix(in srgb, var(--surface-overlay) 88%, transparent)`][V: 视觉验证 toolbar 与 backdrop blur 强度一致] **toolbar 同步带 blur**。
- [x] 13.3 [P0][depends:13.1, 13.2][I: `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`][O: 新增 Requirement "Mermaid Fullscreen Backdrop MUST Frost Per Theme" 含 3 个 Scenario: 三主题模糊半径 / reduced-motion 关 blur / toolbar 同步][V: `openspec validate --strict --no-interactive` 退出码 0] **spec 同步**。
- [x] 13.4 [P1][depends:13.1, 13.2, 13.3][I: 新文件 `src/styles/mermaid-fullscreen.theme.test.ts`][O: 8 个静态断言: CSS 变量存在、.viewer-backdrop 用变量、light/dim 主题分别覆写 blur + tint、reduced-motion 关闭 blur、toolbar blur 12px][V: `npx vitest run src/styles/mermaid-fullscreen.theme.test.ts` 8/8 (初版, 14.3 再加 3 个 → 11/11)] **回归测试 (基础 8 条)**。
- [x] 13.5 [P1][depends:13.4][I: 真实 dev 复测][O: dev 中切换 light / dim / dark 主题, 打开 mermaid 全屏 viewer, 验证 backdrop 模糊半径不同;系统设置开启 reduced-motion, 验证 blur 关闭][V: 视觉手动验证] 真实浏览器三主题复测。

## 14. 修复: 深色主题关闭按钮 + toolbar 图标不可见

- [x] 14.1 [P0][I: `node_modules/viewerjs/dist/viewer.css` lines 11-30, 332-360][O: viewerjs toolbar icon 是一张白填充 inline SVG sprite,`color` 不影响 path 填充;viewerjs 默认 `.viewer-button` 背景 `rgba(0,0,0,0.5)` 在深色 backdrop 上几乎不可见][V: dev 深色主题下点击全屏,观察 toolbar 8 个按钮 + 右上角 ✕] **根因**。
- [x] 14.2 [P0][depends:14.1][I: `src/styles/mermaid-fullscreen.css`][O: (1) **砍掉 mask-image 路径** (会导致 8 个 enabled 按钮 ::before 走 currentColor + 自定义 mask, 在 background-size:280px 缩放下 offset 容易算错, 看到的就是"按钮组消失"); 改用 `filter: var(--mermaid-fullscreen-icon-filter)` 应用到 `::before`,保留 viewerjs 原始 `background-image` 不动;(2) 新增 `--mermaid-fullscreen-icon-filter` token: 默认 none, light 主题 `invert(1) brightness(0.85)`, dim 主题 `invert(1) brightness(0.9)`;(3) `.viewer-button` 改用 `--mermaid-fullscreen-button-bg` 背景 + 1px `--mermaid-fullscreen-button-fg` 边框 (默认态就有视觉边界, hover 切背景)][V: 深色主题下 toolbar 8 按钮全部清晰可读; 关闭按钮默认态可见, 鼠标不悬停也有边框] **CSS 重写**。
- [x] 14.3 [P0][depends:14.2][I: `src/styles/mermaid-fullscreen.theme.test.ts`][O: 新增 3 个静态断言: (1) `::before` 应用 `filter: var(--mermaid-fullscreen-icon-filter)`, **不**使用 `mask-image` (negative assert);(2) `:root[data-theme="light"]` 与 `:root[data-theme="dim"]` 分别覆写 `--mermaid-fullscreen-icon-filter` 为 `invert(...)`;(3) `.viewer-button` 背景用 token + 1px 边框 + `::before` 应用同一 filter][V: `npx vitest run src/styles/mermaid-fullscreen.theme.test.ts` 11/11] **回归测试**。
- [x] 14.4 [P0][depends:14.3][I: `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`][O: 新增 Requirement "Mermaid Fullscreen Toolbar And Close Button MUST Follow Theme Tokens" 含 2 个 Scenario: toolbar icon 随 currentColor、关闭按钮主题适配][V: `openspec validate --strict --no-interactive` 退出码 0] **spec 同步**。
- [x] 14.5 [P1][depends:14.4][I: 真实 dev 复测][O: dev 中三主题打开 mermaid 全屏, 验证 toolbar 8 按钮 + 右上角 ✕ 都有清晰对比度;hover/focus 反馈正常;✕ 按钮点击关闭 viewer][V: 视觉手动验证] 真实浏览器三主题复测。

## 15. 修复: 浅色系 toolbar / close button 控件色独立适配

- [x] 15.1 [P0][I: `src/styles/mermaid-fullscreen.css`][O: 新增 `--mermaid-fullscreen-toolbar-bg` / `--mermaid-fullscreen-toolbar-item-bg` / `--mermaid-fullscreen-toolbar-item-hover-bg` / `--mermaid-fullscreen-button-border` / `--mermaid-fullscreen-button-hover-bg`; light / dim 分别定义浅色与中间态控件底色，dark 保持原逻辑][V: light 主题下右上角关闭按钮与底部 toolbar 不再复用 dark 控件色] **CSS 分主题控件色**。
- [x] 15.2 [P0][depends:15.1][I: `src/styles/mermaid-fullscreen.theme.test.ts`][O: 新增 2 个静态断言，分别锁定 light 与 dim 的 close button / toolbar 专属变量][V: `npx vitest run src/styles/mermaid-fullscreen.theme.test.ts` 13/13] **回归测试**。
- [x] 15.3 [P0][depends:15.2][I: OpenSpec change artifacts][O: proposal / design / spec delta 同步浅色系不能复用 dark 控件色的契约][V: `openspec validate --strict --no-interactive` 退出码 0] **spec 同步**。


## 16. 最终验收

- [x] 16.1 [P0][depends:10.1, 14.5][I: 用户在 dev 中三主题全屏验证 + 关闭按钮默认态验证][O: 用户于 2026-06-22 11:00 反馈"目前功能都对 验收通过"; toolar 8 按钮 + 关闭按钮在 light / dim / dark 三主题下均清晰; backdrop 三主题 blur 强度差异明显; reduced-motion 用户 blur 关闭; 点击关闭按钮 / ESC / backdrop 都能正常关闭][V: 用户口头确认] **用户验收通过**。

- [x] 16.2 [P0][depends:16.1,15.3][I: 仓库级 TS / vitest / openspec 校验][O: `npx tsc --noEmit` 退出码 0; `npx vitest run <4 个 mermaid-fullscreen 相关文件>` 23/23 通过; `openspec validate --strict --no-interactive` 退出码 0][V: 三条命令全 0] **硬门禁绿**。

- [x] 16.3 [P1][depends:16.2][I: 用户手动 commit + openspec archive][O: 按用户本轮授权继续推进；未执行 commit；由于当前 `openspec` CLI 拒绝以数字开头的 change id，等价手工同步 spec delta 到 main spec 并移动 change 目录到 archive][V: `openspec/specs/markdown-mermaid-block-fullscreen-viewer/spec.md` 内容已同步] **archive**。
