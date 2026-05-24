## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 15/15 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: Git worktree/diff tree 路径已有 trailing `InclusionToggle`、shared tree compaction、dotted folder tests 与 worktree row selection CSS。
- **Next action**: 归档前确认 Git worktree focused Vitest、typecheck、lint/large-file gate 与 strict validation。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

Git worktree 文件列表当前把 commit scope 复选框放在行首，视觉上抢占文件状态与文件名的阅读路径；树形视图的 root/folder 行也渲染前置复选框，导致平铺与树形选择入口不统一。将文件级复选框统一移到文件行右侧，并移除目录行前置复选框，可以让文件识别信息先出现，同时保留提交范围选择能力。

后续核对发现右侧 Git 树与 Git History/HUB worktree 树还存在第二个漂移点：两者各自维护 tree builder，导致同一条 package-style 路径在一个入口可以压缩展示，另一个入口仍按多层空目录展开。该提案一并收敛 tree 构建逻辑，让空目录链在两个入口都以 `a.b.c` 形式展示。

再次核对发现 Git 与 Git History/HUB worktree 的 file row / folder row typography 仍存在漂移：HUB 侧维护了独立字号、字重和状态色变量。该提案继续将文件树字体 token 归一到 shared Git file tree CSS variables，并要求颜色通过主题变量解析，兼容主题和自定义主题切换。

最后一次 UI 走查发现 Git History/HUB overlay 右上角关闭按钮仍沿用圆形 chip，不符合当前 Git 操作区更克制的方形小圆角控制风格。该提案将关闭按钮限制为纯样式调整：尺寸收敛为 `20px * 20px`，小圆角，通过现有 surface/border token 与 hover token 适配浅色、深色与自定义主题。

## 目标与边界

- 调整 Git History/HUB worktree 与 shared Git Diff 文件列表中 file row 的 commit scope 复选框位置与样式。
- 移除树形视图 root/folder 行前置 commit scope 复选框，保留文件行右侧复选框作为统一选择入口。
- 将右侧 Git 树与 Git History/HUB worktree 树的 diff tree 构建逻辑归一化到共享 helper。
- 对“没有文件、只有单个子目录”的目录链采用 `a.b.c` 展示，减少 package 路径的纵向高度。
- 将 Git 与 Git History/HUB worktree 的 file row / folder row typography 归一，以右侧 Git file tree 的 shared token 为准。
- 字体、状态色、muted path 色值必须通过 CSS variables 解析，避免新增 hard-coded theme data。
- 将 Git History/HUB overlay 右上角关闭按钮改为 `20px * 20px` 小圆角方形按钮，仅改 CSS，不改关闭行为或 DOM 语义。
- 保持 file / section inclusion contract、stage / unstage / discard 动作、点击文件打开 diff 的行为不变。
- 不修改 Tauri/Rust command、Git 数据结构、commit scope 计算逻辑或 i18n 文案语义。

## 非目标

- 不新增 commit scope 行为。
- 不改 staged/unstaged section header action 的位置或功能。
- 不改变 tree row 的展开/收起、文件分组或真实 path 语义；压缩只影响空目录链的展示 label。

## What Changes

- Git History worktree / shared Git diff file row 的 commit scope 复选框从行首移动到右侧 meta/action 区域。
- Git tree root/folder row 不再渲染前置 commit scope 复选框，目录行只承担分组与展开/收起职责。
- 新增共享 diff tree helper，统一构建 `descendantPaths`、folder key、folder path 与 compact label。
- Git 树与 Git History/HUB worktree 树复用同一套 compact 规则：连续空目录链显示为 `test.java.com.example.demo.service`；遇到目录下同时存在文件与子目录时停止压缩，避免隐藏分叉结构。
- Git 与 Git History/HUB worktree 复用 `--git-filetree-name-font-size`、`--git-filetree-name-font-weight`、`--git-filetree-path-font-size`、`--git-filetree-status-*` 等 typography token。
- Git History/HUB worktree 移除独立 file status color token，改为复用 shared `--git-file-status-color` 与主题状态色。
- 为该 surface 增加 scoped CSS class，优化 unchecked / checked / partial / hover / focus / disabled 样式。
- Git History/HUB overlay close chip 从圆形 `24px` 控件改为方形 `20px` 控件，hover/background/border 继续使用主题 CSS variables。
- 增加结构测试，确认文件行复选框仍可访问且位于右侧 meta 容器内，目录行不再暴露 commit scope toggle，并覆盖 Git/HUB tree 的 `a.b.c` compact display parity。

## Compatibility Review Notes

- Path separator compatibility: tree construction normalizes `\` to `/` before splitting path segments, and tests cover Windows-style file input for tree rendering and file-level selection.
- Theme/custom theme compatibility: new typography, status color, checkbox, and close button styles resolve through existing CSS variables with fallback values; no settings schema, `data-theme`, `data-theme-preset`, or Tauri appearance contract is changed.
- WebView CSS compatibility: the changed styles use existing project-wide `color-mix()` and CSS variable patterns already present in the Git surfaces, so this change does not introduce a new CSS feature class.
- Keyboard/pointer compatibility: moving the checkbox into the trailing meta area keeps `stopPropagation` and accessible checkbox labels; folder/root rows remain button-like expand/collapse rows.
- Compact label collision compatibility: `compactDiffTree` stores compacted folders by structural `key`, not display `name`, so a literal `a.b` folder and a compacted `a/b` chain can render with the same label without overwriting each other.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `file-tree-visual-consistency`: 明确 Git History worktree file row 可以把 commit scope 复选框放在 trailing control area，但必须保持展示层改造不改变交互语义。
- `file-tree-visual-consistency`: 明确 Git diff tree 与 Git History/HUB worktree tree 对 package-style 空目录链采用同一 compact display 规则。
- `file-tree-visual-consistency`: 明确 Git 与 Git History/HUB worktree 文件树 typography 通过 shared CSS variables 保持一致，并通过主题变量适配主题切换。
- `git-selective-commit`: 明确 commit scope control 的视觉位置调整不得改变 file-level inclusion 语义；tree root/folder row 不提供前置 scope toggle 时，选择仍通过文件级 trailing control 与 section-level controls 完成；compact folder label 不得改变 underlying descendant path 与 commit scope 计算。

## Impact

- Frontend: `src/features/git-history/components/GitHistoryWorktreePanel.tsx`
- Frontend: `src/features/git/components/GitDiffPanel.tsx`
- Frontend: `src/features/git/components/GitDiffPanelFileSections.tsx`
- Frontend: `src/features/git/utils/diffTree.ts`
- Styles: `src/styles/git-history.part1.overview.css`
- Styles: `src/styles/git-history.part1.css`
- Styles: `src/styles/diff.css`
- Tests: `src/features/git-history/components/GitHistoryWorktreePanel.test.tsx`
- Tests: `src/features/git/components/GitDiffPanel.test.tsx`
- APIs/dependencies: 无新增依赖，无 backend/API 变更。
