## 1. Shared Viewerjs Infrastructure(图片 viewer 复用 mermaid viewer 基建)

- [x] 1.1 [P0][depends:none][I: 新文件 `src/features/markdown/imageFullscreen/srcToDataUrl.ts`][O: 导出 `resolveImageViewerSrc(src, workspaceId): Promise<{ finalSrc: string; converted: boolean }>`;http(s)/data/blob/asset 直传,file:// 与本地相对路径走 `readLocalImageDataUrl`,失败降级原 src;不实现 fetch content-length 路径(见 design.md Decision 2)][V: `Markdown.image-fullscreen.test.tsx` 覆盖四种 scheme 路径;tsc 退出码 0] 多源 src 解析。
- [x] 1.2 [P0][depends:1.1][I: 新文件 `src/features/markdown/imageFullscreen/ImageFullscreenViewer.tsx`][O: 接收 `{ open, src, alt, workspaceId, onClose }`;portal 挂 `document.body`;`useEffect([open, src])` 内 `await preloadViewerjs()` + `await resolveImageViewerSrc()` 后 `new Viewer(img, options)` + `viewer.show()`;`options.hidden` 调 `onClose`;`options.shown` 调 `setActiveViewer(viewer)`;transition 跟随 reduced-motion;cleanup 中 destroy 且仅当 `getActiveViewer() === viewer` 时 `setActiveViewer(null)`;options `navbar: true, prev: true, next: true`,其他 8 按钮 boolean 同 mermaid viewer][V: tsc 0;visual 验证 viewerjs 工具条与 mermaid viewer 视觉一致;`setActiveViewer(null)` ownership check 单测覆盖] 核心 viewer 组件。
- [x] 1.3 [P0][depends:1.2][I: `ImageFullscreenViewer` 内部主题切换 / panel-lock 同步][O: `useEffect` 内 `MutationObserver(document.documentElement)` 主题变化 → `viewer.update()`;`MutationObserver(document.body)` 监听 `.panel-lock-overlay` 出现 → `viewer.destroy()` + `onClose()`;cleanup 中 disconnect][V: visual 验证 dark/dim/light 切换 viewer 主题跟随;开启 panel-lock viewer 立即关闭] 主题 + panel-lock 协调。
- [x] 1.4 [P0][depends:1.2][I: 新文件 `src/features/markdown/imageFullscreen/index.ts`][O: 桶导出 `ImageFullscreenViewer` / `resolveImageViewerSrc`][V: tsc 0;`grep` 验证其他文件可通过 `import { ImageFullscreenViewer } from "..."` 引入] 桶导出。

## 2. CSS And Style Loader

- [x] 2.1 [P0][depends:1.2][I: 新文件 `src/styles/image-fullscreen.css`][O: 定义 `--z-image-fullscreen: 1300`(同 mermaid viewer 数值,避免 viewerjs 实例间 z-index 冲突);复用 mermaid-fullscreen.css 的 `--viewer-backdrop-*` / `--viewer-toolbar-*` 变量;新增 `.viewer-image` 专属 cursor 与暗色主题 navbar 背景加深 4%;暗色主题下关闭按钮背景补强(解决历史 issue:深色系关闭按钮看不见)][V: visual 验证三主题 viewer 控件对比度] viewerjs 主题色覆盖。
- [x] 2.2 [P0][depends:2.1][I: `src/styles/featureStyleLoaders.ts`][O: 新增 `loadImageFullscreenStyles()` 按需加载 `viewerjs/dist/viewer.css` 与 `./image-fullscreen.css`;`ImageFullscreenViewer` open=true 时调一次,模块级 Promise 缓存避免重复加载][V: tsc 0;`grep loadImageFullscreenStyles` 返回结果] 按需样式加载。
- [x] 2.3 [P0][depends:1.2][I: 新文件 `src/styles/messages-outline-floater.css`][O: 定义 `.messages-outline-floater` 三态(collapsed/expanded/pinned)样式;`.messages-outline-floater-row[data-depth="N"]` 缩进;`.is-active` 高亮;三主题色变量参考 `themeAppearance` 命名但独立 CSS][V: visual 验证三主题对比度与现有侧栏风格一致] floater 样式。

## 3. LocalImage 透传

- [x] 3.1 [P0][depends:none][I: `src/components/common/LocalImage.tsx`][O: 新增可选 prop `onClick?: (event: MouseEvent<HTMLImageElement>) => void`;直接 spread 到 `<img onClick={onClick}>`;未传时与现状完全一致;不引入 viewerjs 依赖][V: `LocalImage.test.tsx` 覆盖 onClick 触发 + 未传时无副作用;`Markdown.image-fullscreen.test.tsx` 验证 messages 侧 img 触发 viewer] onClick 透传 prop。
- [x] 3.2 [P0][depends:3.1][I: `src/features/messages/components/Markdown.tsx:1797` 的 `img` 渲染 hook][O: 新增 `useState<{ open: boolean; src: string; alt: string } | null>(null)`;在 `LocalImage` 上挂 `onClick={() => setOpen({ open: true, src: normalizedSrc, alt: alt ?? "image" })}`;JSX 末尾挂 `<ImageFullscreenViewer open={!!open} src={open?.src ?? ""} alt={open?.alt} workspaceId={workspaceId} onClose={() => setOpen(null)} />`;保留 `!normalizedSrc` 时 `return null` 的 fallback][V: `Markdown.image-fullscreen.test.tsx` 覆盖触发 + onClose 后 portal 卸载;既有测试不回归] messages 侧 img 接入。
- [x] 3.3 [P0][depends:3.1][I: `src/features/files/components/FileMarkdownPreview.tsx` 文件侧 img 节点][O: 找到文件预览侧 `<LocalImage>` 使用点,同款 `useState` + onClick + 挂 `<ImageFullscreenViewer>`;保留所有 fallback 路径][V: `FileMarkdownPreview.image-fullscreen.test.tsx` 覆盖触发 + onClose] 文件侧 img 接入。
- [x] 3.4 [P0][depends:3.3][I: `FileViewPanel -> FileViewBody -> FileMarkdownPreviewFast -> FileMarkdownPreview` 文件路径透传 + rich/fast 图片解析][O: 文件预览侧 `![x](assets/x.png)` / `![x](./assets/x.png)` 按当前 Markdown 文件目录解析为绝对 localPath;`LocalImage` 接收 `convertFileSrc(localPath)` + `localPath`;fullscreen viewer 使用同一 localPath;fast HTML path 遇到本地图片显式 fallback rich path 并上报 `fast-renderer-fallback:local-image-rich-fallback`][V: `FileMarkdownPreview.test.tsx` 覆盖 `assets/images/*.png`;`FileMarkdownPreview.image-fullscreen.test.tsx` 覆盖 viewer src;`FileMarkdownPreviewFast.test.tsx` 覆盖 fast fallback] 文件预览本地相对图片兼容修复。

## 4. i18n

- [x] 4.1 [P0][depends:none][I: `src/i18n/locales/zh.part1.ts` `common.*` 命名空间][O: 新增 `common.markdownImageFullscreen: "全屏"` 与 `common.markdownImageFullscreenHint: "放大查看图片"`;`messages.*` 命名空间新增 `outlineShow/Hide/Pin/Unpin/Empty` 5 个 key(中文文案)][V: `grep` 返回;切换语言后 tooltip/aria-label 同步] zh i18n。
- [x] 4.2 [P0][depends:4.1][I: `src/i18n/locales/en.part1.base.ts`][O: 新增 `common.markdownImageFullscreen: "Fullscreen"` 与 `common.markdownImageFullscreenHint: "Open image fullscreen"`;`messages.*` 5 个 outline key 英文文案][V: 同上] en i18n。

## 5. Messages Outline Hook

- [x] 5.1 [P0][depends:none][I: 新文件 `src/features/messages/hooks/useMessageOutlineActive.ts`][O: 导出 `useMessageOutlineActive(outline, messageContainerRef): { activeHeadingId: string | null };`内部用 `window.scroll` + `requestAnimationFrame` 节流;取"视口顶部 ≤ viewport_top 的最后一个 heading"为 active;outline 为 null/空时返回 null][V: `useMessageOutlineActive.test.tsx` 覆盖:空 outline / 单 heading / 多 heading 滚动 / heading 离开视口] active heading 反推 hook。
- [x] 5.2 [P0][depends:5.1][I: 新文件 `src/features/messages/hooks/useCollapsibleFloater.ts`(可选)][O: 导出 `useCollapsibleFloater(): { state, expand, collapse, togglePin };`三态 `collapsed | expanded-hover | pinned`;`expanded-hover` 时 `onMouseLeave` 自动 `collapse`;`pinned` 状态不响应 mouseLeave][V: 单测覆盖三态切换] 三态 hook。

## 6. Messages Outline Floater 组件

- [x] 6.1 [P0][depends:5.1, 5.2][I: 新文件 `src/features/messages/components/MessagesOutlineFloater.tsx`][O: 接收 `{ outline, activeHeadingId, onJumpToHeading }`;outline 为 null 或空时返回 `null`(不出空框);collapsed 态只露一个浮动入口按钮(右下角或右中,参考 yn 浮窗位置);expanded 时渲染 heading 列表(按 depth 缩进,active heading 高亮);点击行调 `onJumpToHeading(heading.id)` + 触发 `scrollIntoView`;默认浮窗在 messages 容器内 `position: absolute` 锚定右下角][V: `MessagesOutlineFloater.test.tsx` 覆盖:空 outline 不渲染 / 展开 / active 高亮 / 跳转] floater 组件。
- [x] 6.2 [P0][depends:6.1][I: `src/features/messages/components/MessagesTimeline.tsx`][O: 新增 `useState<{ messageId: string; outline: MarkdownOutlineEntry[] } | null>(null)`;live assistant `MessageRow` 渲染时传 `onOutlineReady={(outline) => setCurrentOutline(...)}`;当 outline identity 变化时,floater 自动重置 `expanded` 态;挂 `<MessagesOutlineFloater outline={currentOutline?.outline ?? null} activeHeadingId={activeHeadingId} onJumpToHeading={jumpToHeading} />` 在消息列表根容器内;**保留虚拟化 / 滚动恢复 / 流式增量逻辑**][V: focused component/hook tests + existing messages tests不回归;visual 验证长消息流里 outline 浮窗可点] MessagesTimeline 集成。
- [x] 6.3 [P0][depends:6.1][I: `src/features/messages/components/Markdown.tsx` props + `src/features/messages/utils/messageOutlineExtractor.ts`][O: 新增 `onOutlineReady?: (outline: MarkdownOutlineEntry[]) => void` 可选 prop;messages rich renderer 用 `extractOutlineFromMarkdown(throttledValue)` 生成兼容 `MarkdownOutlineEntry[]`;未传时与现状完全一致;不影响 messages 以外的使用方(`Markdown.tsx` 被多 surface 复用)][V: `Markdown.image-fullscreen.test.tsx` + `messageOutlineExtractor.test.ts` 与既有 Markdown 测试不回归] Markdown 上报 outline。

## 7. OpenSpec Spec Delta

- [x] 7.1 [P0][depends:1.2, 3.2, 3.3][I: 新文件 `openspec/changes/add-image-fullscreen-and-messages-outline/specs/markdown-image-fullscreen-viewer/spec.md`][O: `## ADDED Requirements` 覆盖入口契约(两个 surface)、src 解析契约、viewerjs options 契约、singleton / 主题 / panel-lock / reduced-motion 契约、StrictMode 防御契约、失败降级契约][V: 文件存在且内容完整] image viewer spec delta。
- [x] 7.2 [P0][depends:6.1, 6.2, 6.3][I: 新文件 `openspec/changes/add-image-fullscreen-and-messages-outline/specs/messages-outline-floater/spec.md`][O: `## ADDED Requirements` 覆盖 outline 数据契约、上报 callback 契约、active heading 反推契约、三态契约、虚拟列表兼容契约、无 heading 不渲染契约][V: 文件存在且内容完整] outline floater spec delta。
- [x] 7.3 [P0][depends:7.1, 7.2][I: change 三件套][O: `openspec validate add-image-fullscreen-and-messages-outline --strict --no-interactive` 退出码 0][V: 命令输出无 error] OpenSpec 严格校验。

## 8. Hard Gates

- [x] 8.1 [P0][depends:1.x, 2.x, 3.x, 4.x, 5.x, 6.x, 7.x][I: 仓库级 TS 校验][O: `npm run typecheck` 退出码 0][V: 命令退出码为 0] typecheck 硬门禁。
- [x] 8.2 [P0][depends:1.x, 2.x, 3.x, 4.x, 5.x, 6.x, 7.x][I: 仓库级 vitest 批跑][O: `npx vitest run src/features/markdown/imageFullscreen/srcToDataUrl.test.ts src/features/messages/utils/messageOutlineExtractor.test.ts src/features/messages/hooks/useMessageOutlineActive.test.tsx src/features/messages/components/MessagesOutlineFloater.test.tsx src/features/messages/components/Markdown.image-fullscreen.test.tsx src/features/files/components/FileMarkdownPreview.image-fullscreen.test.tsx src/features/messages/components/LocalImage.test.tsx src/features/messages/components/MermaidBlock.fullscreen.test.tsx src/features/files/components/FileMarkdownPreview.mermaid-fullscreen.test.tsx` 全部通过][V: vitest 输出 0 failure] 单测批跑 + 回归。
- [x] 8.3 [P0][depends:8.1, 8.2][I: 仓库级 `npm run lint`(如有)][O: 退出码 0][V: 命令退出码为 0] lint 门禁。

## 9. Live Verification

- [x] 9.1 [P0][depends:8.1, 8.2][I: 一次 `npm run dev` 起的开发服务器][O: 在 messages 流里发一条含大图的 AI 回复,点击图片进全屏,viewerjs 8 按钮可点,prev/next 切换,ESC 关闭,无 console error / DOM 残留;文件预览侧 .md 文件含 `<image>` 标签或外链图片同样可点全屏][V: visual manual pass] 图片全屏 visual 验证。
- [x] 9.2 [P0][depends:8.1, 8.2][I: 一次 `npm run dev` 起的开发服务器][O: 在 messages 流里发一条含 5+ heading 的 AI 回复,messages 右侧出现 outline 浮窗,点击展开,active heading 随滚动高亮,点击 heading 跳转;无 heading 的消息浮窗入口不显示;切到下一条消息 outline 自动更新][V: visual manual pass] outline floater visual 验证。
- [x] 9.3 [P0][depends:8.1, 8.2][I: 一次 `npm run dev` 起的开发服务器 + i18n 切换 + 主题切换 + panel-lock][O: 切换语言后 icon tooltip 同步;切换主题 viewer/floater 跟随;开启 panel-lock viewer 自动关闭,floater 仍可用(在 lock 之下)][V: visual manual pass] 兼容性 / 主题 / 锁屏交叉验证。
