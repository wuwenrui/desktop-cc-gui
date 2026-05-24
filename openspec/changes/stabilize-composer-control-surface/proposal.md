## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 22/22 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: Composer control surface 已拆到 ChatInputBox/ButtonArea/Footer、rewind modal CSS、queued handoff bubble、approval/background activity projection 等独立测试路径。
- **Next action**: 归档前确认 composer focused tests、rewind modal smoke 与 no layout overlap/manual QA。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

Composer 控制面在本轮 UI 收口前同时承担模型选择、模式选择、工具入口、上下文用量、记忆引用和发送按钮。底部区域逐步堆叠后出现了几个明显漂移：

- 顶部 readiness bar 只展示目标信息，模型选择仍在底部重复出现。
- 底部工具按钮有的像按钮、有的像 icon，hit area、间距和主题色不一致。
- 部分模式图标使用写死黑色的 SVG，dark theme 下不可见。
- 首页 composer 和普通 composer 的圆角、高度、按钮覆盖规则不一致。
- 模型选择弹层过高且描述过重，Gemini 检测到但未稳定进入统一 selector。

本变更把 Composer 控制面固化成一个单一视觉契约：顶部负责目标选择与状态说明，底部负责可折叠工具组和发送操作。

## Goals

- 将模型选择入口合并到顶部 readiness target，底部不再重复展示模型选择器。
- 模型选择弹层按 provider 分组展示 Claude Code / Codex / Gemini，并压缩为单行模型项。
- Gemini provider 一旦被检测为可用，就必须进入统一模型选择器。
- 底部工具统一进入可折叠 inline toolbar；主按钮负责展开/收起。
- inline tools 必须保持 icon-only、统一 hit area、最小间距、主题色适配。
- 选中/激活态不得用文本替代 icon，也不得靠固定黑/白 SVG 表达状态。
- 邮件提醒、运行跟随、折叠步骤、记忆引用等 active/armed 工具必须用统一选中色和叠加 check 表达选中态。
- 发送按钮保持小号圆角正方形。
- Composer 外框圆角降低，默认高度缩减约两行，避免大胶囊和过高输入面板。

## Non-Goals

- 不改变消息发送 payload、runtime lifecycle、queue/fuse 语义。
- 不改变 Memory Scout / Project Memory 注入 contract。
- 不新增 provider、模型配置存储或后端 discovery command。
- 不改变 `composer-send-readiness-ux` 的 view-model 责任边界。
- 不把 UI 中的 always/single 状态持久化成全局设置。

## What Changes

- `ComposerReadinessBar` 承载 model selector trigger，并显示 provider / model / mode / access 摘要。
- `ButtonArea` 从“底部模型 + 分散工具”收敛为“tool dock toggle + inline tools + send/stop”。
- `ModelSelect` 支持 provider-grouped model options，模型项只展示一行 label，footer 保留 add / refresh actions。
- `modelOptions` 负责合并 runtime models、custom models、selected fallback 与 provider availability；Gemini availability 为 true 时必须有 Gemini group。
- `ModeSelect` 使用 codicon 而不是固定色 SVG，确保图标跟随 `currentColor`。
- selected skill / command / agent context chips 从底部 toolbar 迁移到输入正文上方独立 context row；底部 toolbar 不再承载 `contextSurface`。
- `ContextBar` 在 tool surface 中可隐藏重复 context usage，避免底部同时出现多份用量指示。
- `ContextBar` 和 `ButtonArea` 的 selected/armed inline tools 使用同一套 `--composer-tool-selected-color`，并通过 icon overlay check 表达 active 状态。
- Home composer 的高优先级 CSS 必须为 inline tools 补齐同等覆盖，避免 light/dark theme 下旧按钮背景回流。
- Composer 默认高度和圆角成为视觉 contract：home 默认正文区比原先减少约两行，普通输入区默认最小文本高度降为一行。

## Capabilities

### New Capabilities

- `composer-control-surface`: 固化 Composer 控制面布局、模型选择入口、底部工具组、主题适配和默认尺寸。

### Modified Capabilities

- `composer-send-readiness-ux`: readiness target 继续由 view model 驱动，但允许目标区域成为模型选择 trigger。
- `composer-model-selector-config-actions`: model selector footer 行为不变；展示形态扩展为 provider-grouped compact list。
- `composer-context-dual-view`: tool surface 可以隐藏重复 usage，只保留主 usage 指示。
- `composer-context-selection-chips`: selected skill / command / agent chips 作为输入上下文提示，独立展示在 editor 上方，不再属于底部 toolbar 视觉顺序。

## Acceptance

- 顶部 `Codex / gpt-*` target 可打开统一模型选择器，底部不再展示独立 model selector。
- 模型选择器包含当前可用的 Claude Code、Codex、Gemini 分组；Gemini 检测可用时必须展示。
- 模型列表每项只展示一行 label，不展示长描述。
- selected skill / command / agent chips 展示在输入框上方单独一行，删除 chip 的回调与选中状态不变。
- 底部主工具按钮可展开/收起 inline tools；配置、快捷动作、模式、计划、context tools、panel、记忆引用、reasoning、usage 都在同一行管理，但不承载 selected context chips。
- inline tools 不显示文字 label，不恢复圆形/胶囊按钮背景。
- 邮件提醒、运行跟随、折叠步骤、记忆引用 selected/armed 后都显示同规格叠加 check，并统一使用同一 selected color。
- dark 和 light theme 下所有 inline tool icon 可见，且使用 theme token / `currentColor`。
- mode selected icon 必须显示 icon，不显示文本。
- send button 是小号圆角正方形。
- Composer 圆角小于旧大胶囊形态；默认正文区高度减少约两行。

## Verification

- `pnpm vitest run src/features/composer/components/ChatInputBox/ButtonArea.test.tsx src/features/composer/components/ChatInputBox/ContextBar.test.tsx src/features/composer/components/ChatInputBox/modelOptions.test.ts src/features/composer/components/ChatInputBox/selectors/ModelSelect.test.tsx src/features/composer/components/ChatInputBox/selectors/ReasoningSelect.test.tsx src/features/home/components/HomeChat.styles.test.ts`
- `pnpm vitest run src/features/composer/components/ChatInputBox/selectors/ModeSelect.test.tsx src/features/home/components/HomeChat.styles.test.ts src/features/composer/components/ChatInputBox/ButtonArea.test.tsx`
- `pnpm typecheck`

## Closure Addendum: Dock And Stop-Button Visual Compatibility

本轮 UI review 收口补齐两个兼容性细节，不改变发送 payload、runtime lifecycle、queue/fuse 或后端 contract：

- Composer streaming stop button 保持小型主操作尺寸，但运行态必须渲染为正圆 icon；火花纹理继续使用既有 `assets/icon.png`，不得退化为普通 stop glyph 或丢失周边 sparkle/halo 反馈。
- StatusPanel dock 与 Terminal dock 采用一致的底部 tab bar 语言：左侧保留 panel collapse/expand cell，tab 高度降低并保持平直边界；StatusPanel 折叠后仍保留吸底 collapsed bar，而不是卸载整个 dock 入口。

Compatibility review scope:

- 仅改前端 React/CSS 表现层，不新增依赖，不修改 Tauri/backend/database。
- CSS 使用现有 theme tokens、codicon 与本地 asset；不引入 platform-specific selector 或 shell 假设。
- 折叠/展开行为复用既有 `onOpenPlanPanel` / `onClosePlanPanel` 与 terminal toggle 回调。

## Impact

- Frontend:
  - `src/features/composer/components/ChatInputBox/**`
  - `src/styles/home-chat.css`
- Tests:
  - `ButtonArea.test.tsx`
  - `ContextBar.test.tsx`
  - `ModelSelect.test.tsx`
  - `ReasoningSelect.test.tsx`
  - `ModeSelect.test.tsx`
  - `HomeChat.styles.test.ts`
  - `ChatInputBox/styles/buttons.test.ts`
  - `StatusPanel.test.tsx`
  - `status-panel-theme.test.ts`
  - `terminal-theme.test.ts`
- No backend / Tauri / database change.

## Closure Addendum: Selected Context Chips Row

本轮 UI-only 收口补齐 selected context chips 的稳定展示契约，防止后续把 skill / command / agent chips 回退到底部 toolbar：

- selected skill / command / agent chips 属于 composer input context，不属于底部工具按钮组。
- `ChatInputBox` 在 editor 上方渲染独立 `.chat-input-context-surface`。
- `ButtonArea` 不再接收或渲染 `contextSurface`，避免 bottom toolbar 重新混入上下文 chip。
- 移除 `.button-area-context-surface` 专属样式，相关样式迁移到 `input-area.css` 的 context row。

Compatibility review scope:

- 仅变更 React DOM 布局与 CSS，不修改发送 payload、selection state、删除回调、Tauri command、backend 或 database。
- CSS 使用现有 `ContextBar` / theme token，不新增 platform-specific selector。
- Win/mac 差异主要限于字体渲染与滚动条；本变更未依赖 OS path、shell、native menu 或 platform API。
