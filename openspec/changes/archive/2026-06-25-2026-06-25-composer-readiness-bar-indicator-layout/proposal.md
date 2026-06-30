# Proposal: 2026-06-25-composer-readiness-bar-indicator-layout

## Why

`2026-06-24-curated-skill-always-on-simplification` 已经把 curated skill
从 composer 的 per-message chip row / picker 模型收敛为 Settings 中的
always-on 开关，并新增 read-only `CuratedSkillIndicator` 让用户知道当前会话
是否正在注入内置 skill。

后续代码实现选择了更轻的布局路径：不再新增一条 composer content strip，
而是把 indicator 作为 `ComposerReadinessBar` 的 `rightAccessory` 渲染到
readiness bar 右侧：

- `ChatInputBox.tsx` 创建 `<CuratedSkillIndicator onOpenSkillsSettings={...} />`
  并传给 `ChatInputBoxHeader.rightAccessory`。
- `ChatInputBoxHeader.tsx` 只负责透传 `rightAccessory` 给
  `ComposerReadinessBar`。
- `ComposerReadinessBar.tsx` 在 `composer-readiness-activity` 内渲染
  `.composer-readiness-right-accessory`，再放入 indicator。
- indicator 的 CSS 被放入
  `src/features/composer/components/ChatInputBox/styles/banners.css`，确保冷启动
  composer 首屏也有正确单行布局，而不是等用户进入 Settings 后才加载样式。

原 proposal 曾描述为“把 indicator 从 readiness bar 移到 input 与 footer
之间”。这已经不符合当前代码事实，也会让 spec reviewer 误以为实现方向相反。
本 change 将 proposal 回写为代码真实采用的方案：**indicator 是 readiness bar
的右侧只读 accessory，而不是独立 content strip**。

## What Changes

- **标准化 readiness bar 右侧 accessory slot**：
  `ComposerReadinessBar` 接收 `rightAccessory?: ReactNode`，并在
  `composer-readiness-activity` 内部的
  `.composer-readiness-right-accessory` 容器中渲染。
- **由 `ChatInputBox` 注入 curated skill indicator**：
  `ChatInputBox` 创建 `CuratedSkillIndicator`，传入
  `onOpenSkillsSettings`，再通过
  `ChatInputBox -> ChatInputBoxHeader -> ComposerReadinessBar` 的 prop chain
  传递。`ComposerReadinessBar` 不直接 import curated-skills domain，保持
  composer readiness bar 的通用性。
- **冷启动 CSS 跟随 ChatInputBox bundle**：
  `.composer-readiness-right-accessory` 与 `.curated-indicator*` 样式位于
  `ChatInputBox/styles/banners.css`，避免 indicator 在首次 app load 时出现
  browser-default button layout、换行或 label/icon 分离。
- **右侧 indicator 的布局约束**：
  accessory 容器使用 `inline-flex`、`min-width: 0`、
  `max-width: min(360px, 32vw)` 与 `flex: 0 1 auto`；indicator chip 使用
  nowrap + ellipsis，长名称截断，overflow 用 compact `+N` chip 表达。
- **不恢复 per-message curated-skill UI**：
  composer 仍不提供 curated skill picker、`+` button、chip row 或单条消息级
  开关。Settings > Skills > Curated 仍是唯一启停入口。
- **更新测试口径**：
  `ChatInputBoxIndicatorMount.test.tsx` 应断言 indicator 位于
  `.composer-readiness-right-accessory` 内；`ComposerReadinessBar.test.tsx`
  应覆盖 `rightAccessory` slot 不破坏 target、context summary、expand/jump 等
  readiness bar 原行为。

## Out of Scope

- 不把 indicator 改成 `input-editable-wrapper` 与 `ChatInputBoxFooter` 之间的
  独立 strip；当前代码事实是 readiness bar 右侧 accessory。
- 不重新引入 `CuratedSkillChipRow` / `CuratedSkillPicker`。
- 不改变 `CuratedSkillIndicator` 的 polling 频率、IPC 字段、icon 映射、
  token count 或 accessibility 语义。
- 不修改 curated skill 的 backend injection、settings persistence、lock file
  format 或 resource bundle。
- 不重做 `ComposerReadinessBar` 的整体 responsive design；本 change 只把
  indicator 的 slot、冷启动 CSS 与 truncation contract 固化下来。

## Acceptance

- `npm run typecheck` clean。
- `npm run lint` clean。
- `npx vitest run src/features/composer/components/ChatInputBox/ src/features/curated-skills/`
  clean。
- `openspec validate 2026-06-25-composer-readiness-bar-indicator-layout --strict --no-interactive`
  clean。
- 当至少一个 curated skill enabled 时，`CuratedSkillIndicator` 渲染在
  `.composer-readiness-right-accessory` 内，位于 readiness bar 右侧。
- 当没有 enabled curated skill 时，indicator 不渲染，readiness bar 不出现空白
  accessory 视觉占位。
- 冷启动 app、尚未进入 Settings 页面时，indicator 仍保持单行 chip 布局：
  icon + display name 不拆行，长名称 ellipsis，overflow 显示 `+N`。
- 窄视口下，indicator 不覆盖 readiness bar 左侧的 mode / target / context
  summary 文案；必要时自身截断。
- 点击 indicator shortcut（如果当前 entry 支持 button 形态）只导航到
  Settings > Skills，不直接 toggle curated skill。
- composer 中不出现 per-message curated-skill chip row、picker popover 或 `+`
  button。

## Risk

- **Low** for prop-chain layout：`rightAccessory` 是通用 `ReactNode` slot，
  `ComposerReadinessBar` 不感知 curated-skills domain，耦合较低。
- **Low** for cold-start CSS：样式放在 ChatInputBox bundle 中，避免 Settings-only
  CSS lazy load 造成首屏错位。
- **Medium** for narrow viewport：indicator 挂在 bar 右侧会占用 horizontal
  space；通过 `max-width`、`min-width: 0`、nowrap 与 ellipsis 控制，不让 chip
  反向挤爆主文案。
- **Low** for a11y：indicator 是 read-only status / shortcut，不抢焦点；DOM 顺序
  仍在 readiness bar 内，屏幕阅读器不会在 input 与 footer 中间多插一段状态区。

## Rollback

- Revert 本 change 的文档与代码提交即可移除 `rightAccessory` slot 或恢复到旧
  composer indicator 放置方式。
- 如只需临时隐藏 indicator，可保留 always-on backend injection 和 Settings toggle，
  单独撤回 `ChatInputBox` 对 `CuratedSkillIndicator` 的注入。
