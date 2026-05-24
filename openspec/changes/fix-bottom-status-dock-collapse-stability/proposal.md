## 2026-05-23 Proposal Refresh

- **Current branch**: `feature/v0.5.2`; this refresh is documentation-only and does not change implementation code.
- **Task state**: 11/11 checked; status = Completed / pending verify-archive.
- **Code/document evidence**: `StatusPanel`/`CheckpointPanel` 已有 checkpoint compact/full projection、subagent aggregation、policy audit 与 status-panel CSS tokenized checkpoint sizing。
- **Next action**: 归档前确认 status-panel focused tests 与 manual dock collapse smoke。
- **Validation note**: `openspec validate --all --strict --no-interactive` passed 299 items in this documentation refresh.

## Why

底部 `dock` 状态面板的折叠语义不稳定：某些状态下折叠会被上层布局误判为整块面板不需要挂载，导致 `用户对话 / 结果` tab bar 直接消失。与此同时，Composer 工具栏里仍保留一个控制同一底部状态面板的 layers 图标，和 dock 自身折叠按钮重复，增加了交互歧义。

## What Changes

- 修复底部状态面板的挂载条件：当底部 activity panel 可见、当前线程存在、且 `用户对话` 或 `结果` 这类 baseline tab 可见时，dock MUST 保持挂载。
- 折叠态只隐藏 dock 内容区，MUST 保留 tab bar 和 dock 自身展开入口。
- 将 `OpenCode` 纳入底部状态面板支持引擎集合，避免不同引擎下 `用户对话 / 结果` 可见性不一致。
- 移除主 Composer 工具栏里重复的 status panel toggle 入口；底部 dock 的展开/折叠由 dock 自身控件负责。
- 增加回归测试，覆盖折叠态 baseline tab 挂载、OpenCode 引擎、以及 Composer 重复 toggle 关闭。
- **BREAKING**: 无。该变更只收敛 UI 挂载和控制入口，不改变消息、runtime、checkpoint verdict 或文件变更事实的 contract。

## 目标与边界

- 目标：折叠底部状态面板时，用户仍能看到并点击 `用户对话 / 结果` tab bar。
- 目标：不同已接入会话引擎在底部状态面板上的基础入口保持一致，尤其是 `Claude / Codex / Gemini / OpenCode`。
- 目标：去掉重复的 Composer layers 图标，让同一状态只由一个明确入口控制。
- 边界：本变更只调整底部 dock 的挂载条件、折叠语义和控制入口，不重做 `StatusPanel` 内部 tab 内容。
- 边界：本变更不改 `popover` 状态面板，不改变 composer 上方紧凑状态面板的 checkpoint 呈现。
- 边界：本变更不引入新的持久化字段；继续复用现有 `bottomStatusPanelExpanded` / plan panel dismissal 状态。

## 非目标

- 不重构 `StatusPanel` 的 tab 系统、checkpoint view-model 或 user conversation timeline。
- 不新增新的底部 dock UI 组件，也不替换现有 `right-panel-bottom` 布局。
- 不改变 `任务 / Agent / Plan` tab 的数据来源和默认显示策略。
- 不修改 runtime/backend 的 engine session contract。
- 不为折叠状态引入跨重启持久化或新的 settings 开关。

## Capabilities

### New Capabilities

- _None_

### Modified Capabilities

- `status-panel-latest-user-message-tab`: 扩展 `用户对话` tab 在底部 dock 中的稳定挂载与支持引擎要求，确保折叠态仍保留可见 tab bar。
- `status-panel-checkpoint-module`: 扩展 `结果 / Checkpoint` dock tab 的折叠可见性要求，确保折叠态保留结果入口而不是卸载整块 dock。

## 方案对比

### 方案 A：只修 CSS，让折叠态高度固定

- 优点：改动小，可能快速让视觉高度看起来稳定。
- 缺点：根因在 React 挂载条件；当上层 `shouldMountBottomStatusPanel` 返回 false 时，CSS 没有节点可渲染，无法阻止 tab bar 消失。
- 结论：不选。只能掩盖一部分视觉问题，不能解决跨引擎和无 activity 场景的卸载问题。

### 方案 B：在 `StatusPanel` 内强制忽略 `expanded=false`

- 优点：可以保护 `StatusPanel` 自身不轻易返回 `null`。
- 缺点：上层 `planPanelNode` 仍可能不创建；并且会混淆 `expanded` 与 `dockCollapsed` 两层语义，增加未来维护成本。
- 结论：不选。边界不够干净。

### 方案 C：在 layout 层修正底部 dock 挂载条件，并关闭 Composer 重复 toggle

- 优点：在真正决定是否挂载 dock 的地方修复根因；baseline tab 成为可挂载依据；折叠只由 dock 自身控制；重复入口自然消失。
- 缺点：需要补 layout hook 层测试，而不只是组件快照测试。
- 结论：采用。职责边界最清晰，能同时解决“直接隐藏”和“重复控制”两个问题。

## 验收标准

1. 当底部 activity panel 可见、当前 active thread 存在、且 `用户对话` 或 `结果` tab 可见时，`StatusPanel` MUST 挂载，即使当前没有任务、Agent、文件变更或命令 activity。
2. 当底部状态面板处于折叠态时，系统 MUST 保留 dock tab bar，并隐藏内容区。
3. 折叠态下点击 dock 自身展开按钮或 tab MUST 能触发展开行为。
4. `OpenCode` 会话 MUST 与 `Claude / Codex / Gemini` 一样接入底部 baseline 状态面板入口。
5. 主 Composer 工具栏 MUST NOT 再展示与底部 dock 折叠控制重复的 layers toggle。
6. `popover` 状态面板行为 MUST 保持不变，不因本修复新增 `用户对话` dock tab。
7. `任务 / Agent / Plan` tab MUST 继续只在各自有数据或模式需要时显示。
8. Checkpoint verdict、user conversation timeline 内容、Git file facts 和 runtime session state MUST 不因该变更发生语义变化。
9. 回归验证 MUST 覆盖折叠态 baseline tab 挂载、OpenCode 引擎和 Composer 重复 toggle 关闭。

## Impact

- Frontend layout: `src/features/layout/hooks/useLayoutNodes.tsx`
- Frontend tests: `src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`
- Existing behavior specs to update in later artifacts:
  - `status-panel-latest-user-message-tab`
  - `status-panel-checkpoint-module`
- No backend, Tauri command, storage schema, dependency, or runtime protocol changes.
