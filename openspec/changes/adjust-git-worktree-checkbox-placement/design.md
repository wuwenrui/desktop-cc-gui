## Overview

本变更处理 Git History worktree 与 shared Git diff 文件列表的展示层：把 file row 的 commit scope 复选框移动到右侧控制区，并用 scoped CSS 优化状态样式。现有 `InclusionToggle`、commit scope state、stage/unstage/discard command path 均保持不变。

补充核对后，本变更还收敛右侧 Git 树与 Git History/HUB worktree 树的 tree builder。两边都必须复用同一套 diff tree helper，并对“空目录链”采用 `a.b.c` compact label，避免 Java package / nested module 路径在树形视图里拉出过高的纵向层级。

再次补充核对后，本变更还收敛 Git 与 Git History/HUB worktree 的文件树 typography，并把 Git History/HUB overlay close chip 调整为 `20px * 20px` 小圆角方形按钮。该部分仅是 CSS 层改造，不改变 DOM 结构、事件处理或关闭行为。

## 技术方案对比

### 方案 A：移动 JSX 结构到右侧 meta 区域

- 做法：在 `GitHistoryWorktreePanel` 的 file row 中，把 `InclusionToggle` 从行首移入 `diff-row-meta`，放在统计 badge 与动作按钮附近。
- 优点：DOM 顺序与视觉位置一致；CSS grid 不需要反向排序；测试可直接断言复选框位于右侧 meta 容器。
- 风险：需要同步调整该 surface 的 grid 列定义。

### 方案 B：保留 JSX 结构，通过 CSS order/grid-column 移到右侧

- 做法：保留 `InclusionToggle` 在行首 DOM 中，只用 CSS 把它定位到右侧。
- 优点：TSX 变动更少。
- 风险：DOM 与视觉顺序背离，键盘 focus 顺序仍先进入右侧视觉元素，容易形成可访问性错位。

## Decision

采用方案 A。理由是这次目标是“复选框期望放在文件列表右侧”，DOM、视觉和键盘顺序应该一致；同时变更范围仍然局限于一个 presentational component 和 scoped CSS。

### 方案 C：保留两个 tree builder，分别补 compact 逻辑

- 做法：在 `GitDiffPanel` 与 `GitHistoryWorktreePanel` 中各自实现目录链压缩。
- 优点：单文件局部改动少。
- 风险：两个入口继续漂移，后续任何 tree 展示规则都要改两遍；这正是本次 Git 树已改、HUB 树漏改的根因。

### 方案 D：抽取共享 diff tree helper

- 做法：新增 `src/features/git/utils/diffTree.ts`，统一提供 `buildDiffTree` 与 `compactDiffTree`；两个树形入口只负责渲染。
- 优点：同一规则、同一类型、同一测试语义；`descendantPaths`、folder key、真实 `path` 与 compact `name` 同源。
- 风险：需要调整主 Git panel test import，并确保 compact label 不影响 commit scope 的真实 path。

## Tree Builder Decision

采用方案 D。tree 构建属于数据结构规则，不应该散落在两个 UI component 里；UI 只消费已经预聚合的 `descendantPaths` 与 compacted folder label。

### 方案 E：HUB 侧继续维护独立字体与状态色

- 做法：保留 `git-history-worktree-*` 独立字号、字重与状态色变量。
- 优点：局部样式看起来可快速调。
- 风险：Git 与 HUB 文件树视觉继续漂移；自定义主题切换时需要维护两套颜色语义。

### 方案 F：通过 shared Git file tree CSS variables 收敛字体与颜色

- 做法：在 `.diff-panel, .git-history-workbench` 上定义 shared `--git-filetree-*` typography token；HUB worktree 复用 shared `--git-file-status-color` 和主题状态色。
- 优点：同一视觉 contract；主题与自定义主题只需覆盖变量，不需要 patch 两套 selector。
- 风险：需要确认旧 HUB selector 不再以更高优先级覆盖 shared token。

## Typography / Theme Decision

采用方案 F。字体与颜色属于跨 Git surface 的 visual contract，必须通过 shared CSS variables 表达；新增样式只允许使用现有 theme token 与 fallback，不新增 runtime theme state。

## Implementation Notes

- `InclusionToggle` 继续使用原有 `state`、`label`、`disabled`、`stopPropagation` 与 `onToggle`。
- shared Git diff file row 中，`InclusionToggle` 必须成为 `.diff-row-meta` 的最后一个子元素，保证它位于最右侧。
- tree 模式下 folder/root row 不再渲染 commit scope checkbox；folder/root row 只负责展开/折叠，commit scope 统一由 file row trailing checkbox 或 section header controls 表达。
- 新增 `git-history-worktree-row-selection` class，只影响 Git History worktree file row。
- `git-history-worktree-file-row` grid 列移除行首 selection 列，文件状态、图标、路径、meta 继续保持稳定。
- `diff-row-meta` 内部增加稳定布局，避免统计 badge、复选框、stage/unstage/discard 按钮互相挤压。
- `buildDiffTree` 负责生成 root/folder 的 `key`、真实 slash `path`、`descendantPaths` 与 file leaf 集合。
- `compactDiffTree` 只压缩 `files.length === 0 && folders.size === 1` 的 folder chain，并将展示名拼成 `a.b.c`。
- 如果某个目录同时包含文件和子目录，compact 必须停止在该目录，防止 `service/UserService.java` 与 `service/impl/UserServiceImpl.java` 被误显示成 `service.impl`。
- compact 后的 folder `name` 只用于展示；folder inclusion / descendant scope 必须继续基于 `descendantPaths` 和真实 `path`。
- compact 后的 display `name` 不作为唯一结构 key 使用。若 sibling folder 产生相同 dotted label，渲染和 Map 存储继续以真实 path/key 区分。
- `GitHistoryWorktreePanel` 与 shared `GitDiffPanel` 的 file/folder typography 必须通过 `--git-filetree-name-font-size`、`--git-filetree-name-font-weight`、`--git-filetree-path-font-size`、`--git-filetree-status-*` 解析。
- Git History/HUB file status、stat add/delete、checkbox、close chip 的颜色必须通过 `--git-file-status-color`、`--status-success`、`--status-error`、`--accent-primary`、`--surface-*`、`--border-*` 等 theme token 解析。
- close chip 尺寸固定为 `20px * 20px`，小圆角；不得改 `onRequestClose`、tooltip/title、icon 语义或 keyboard activation。

## Platform Compatibility Review

- macOS/Linux/Windows path input: `buildDiffTree` 必须先把 `\` 归一为 `/` 再拆分 segment；file leaf 保留原始 path，diff open 与 commit selection 继续使用既有 normalization。
- Windows WebView2 / Linux WebKitGTK / macOS WKWebView CSS: 本变更只复用项目内既有 `color-mix()`、CSS variables、grid/flex、focus-visible 模式，不引入新的 platform-specific CSS API。
- Custom theme: 本变更不修改 `AppSettings.theme`、`customThemePresetId`、DOM `data-theme` 或 `data-theme-preset`。custom preset 只需继续提供已有 token；新样式不读取硬编码 preset identity。
- Accessibility: trailing checkbox 的 DOM 位置与视觉位置一致；点击 checkbox 必须 `stopPropagation`，避免触发行打开 diff；folder/root row keyboard activation 保持 Enter/Space 展开收起。
- Compact folder collision: `compactDiffTree` stores children by structural `key`, so dotted display labels can collide without losing sibling folders.

## Acceptance Criteria

- 文件行复选框视觉位于右侧，靠近 `+/-` 统计与文件动作按钮。
- 点击复选框不会触发文件行 diff 打开。
- 复选框 `aria-checked`、accessible name、disabled 行为保持不变。
- staged/unstaged file 的 stage/unstage/discard 行为保持不变。
- Git 树与 Git History/HUB worktree 树对同一条 package-style path 展示同一个 `a.b.c` folder label。
- 空目录链压缩不得吞掉有文件和子目录并存的分叉层级。
- compact display label collision 不得导致 sibling folder 丢失。
- Git 与 Git History/HUB worktree 文件树字体、状态标记、muted path 通过 shared CSS variables 保持一致。
- Git History/HUB close chip 显示为 `20px * 20px` 小圆角方形，且浅色、深色、自定义主题下仍使用 theme token。
- focused Vitest 与 TypeScript 检查通过。
