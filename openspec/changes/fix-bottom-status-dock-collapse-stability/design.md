## Context

底部状态面板当前由 layout hook 决定是否挂载，再由 `StatusPanel` 根据 `expanded` / `dockCollapsed` 决定内容区呈现。问题出在第一层：折叠态如果被 layout 判定为“没有 activity 且不需要 expanded”，整个 dock 会被卸载，导致本应作为 baseline surface 的 `用户对话` / `结果` tab bar 一起消失。

该行为对多引擎场景更敏感。`Claude / Codex / Gemini` 已进入底部状态面板支持集合，但 `OpenCode` 未被纳入，导致相同 client UI visibility 配置下，不同引擎的 baseline tab 可达性不一致。

同时，主 Composer 工具栏仍展示一个 layers/status-panel toggle。它和底部 dock 自身折叠控件控制同一块 UI 状态，造成入口重复与语义歧义。

## Goals / Non-Goals

**Goals:**

- 当底部 activity panel 可见、当前 active thread 存在、且 `用户对话` 或 `结果` baseline tab 可见时，底部 dock 必须保持挂载。
- 折叠语义收敛为：保留 dock shell 与 tab bar，只隐藏内容区。
- `OpenCode` 与 `Claude / Codex / Gemini` 使用一致的底部 baseline dock 挂载规则。
- 主 Composer 不再展示重复的 status panel toggle，避免两个入口控制同一折叠状态。
- 用 layout hook 层回归测试覆盖折叠态、baseline tab、OpenCode 和 Composer toggle override。

**Non-Goals:**

- 不重构 `StatusPanel` 的 tab 选择、checkpoint verdict 或 user conversation timeline 数据模型。
- 不改变 popover 状态面板行为。
- 不新增持久化字段、settings 开关或 runtime/backend contract。
- 不改变 `任务 / Agent / Plan` tab 的 activity 判定逻辑。

## Decisions

### Decision 1: 在 layout 挂载层修正 baseline dock 条件

采用 `shouldMountBottomStatusPanel` 作为唯一挂载门禁，新增 baseline 条件：

- `showBottomActivityPanel` 为 true；
- 当前引擎属于底部状态面板支持集合；
- 且满足以下任一条件：
  - 存在任务、Agent、文件、命令、Plan 等 activity；
  - `bottomStatusPanelExpanded` 为 true；
  - `用户对话` 或 `结果` baseline tab 可见，并且存在 `activeThreadId`。

选择该方案的原因是：问题发生在节点是否创建的层级，CSS 或 `StatusPanel` 内部兜底都无法恢复一个已经没有被挂载的 dock。

**Alternatives considered:**

- 只固定折叠态 CSS 高度：无法处理 React 节点未创建的问题。
- 让 `StatusPanel` 在 `expanded=false` 时强制保留内容：会把挂载职责推入子组件，并混淆 `expanded` 与 `dockCollapsed`。

### Decision 2: baseline tab 不要求 activity facts

`用户对话` 和 `结果` 是底部 dock 的基础入口，不应依赖任务、Agent、文件变更、命令 activity 是否存在。只要对应 client UI control 可见且有 active thread，dock 就应可达。

该决策避免了“没有 activity 时折叠直接消失”的不稳定状态，也保持 `任务 / Agent / Plan` 仍由原 activity 条件控制，不扩大其他 tab 的显示范围。

### Decision 3: OpenCode 纳入底部状态面板支持集合

`OpenCode` 已是会话引擎之一，并且需要和其他对话引擎共享 `用户对话` / `结果` baseline surface。支持集合扩展到 `opencode`，但不改变 Codex 专属逻辑，例如 `isStatusPanelCodexEngine`。

### Decision 4: 主 Composer 显式关闭重复 status panel toggle

主 Composer 使用 `renderComposerNode(false)`，与 home composer 一致，不再展示重复 layers/status-panel toggle。底部 dock 的折叠与展开由 dock 自身控件承担。

选择显式传参而不是改 Composer 默认值，是为了降低影响范围：只调整该 layout 场景，不改变其他可能复用 Composer 的调用方默认语义。

## Risks / Trade-offs

- [Risk] baseline 条件放宽后，底部 dock 在无 activity 时也可能挂载。 → Mitigation: 仅当 bottom activity panel 可见、baseline tab 可见且存在 active thread 时挂载，避免空项目或无上下文场景误显。
- [Risk] OpenCode 纳入支持集合后暴露 status panel 中尚无完整事实的数据区。 → Mitigation: 本变更只保证 baseline tab 入口可达，checkpoint 内容仍按现有可用事实回退。
- [Risk] 关闭 Composer toggle 后用户可能寻找原 layers 图标。 → Mitigation: 底部 dock 自身仍保留折叠/展开入口，避免同一状态出现双控制源。
- [Risk] 测试 mock 固定 visibility 会掩盖开关组合问题。 → Mitigation: 将 client UI visibility mock 改为可控 Set，使单测能显式声明 panel/control 前置条件。

## Migration Plan

1. 更新 layout hook 的底部状态面板挂载条件。
2. 将 `opencode` 加入底部状态面板支持引擎集合。
3. 主 Composer 显式关闭 status panel toggle override。
4. 补充 focused Vitest 覆盖折叠态 baseline dock 保持挂载。
5. 运行 focused tests、typecheck、lint。

Rollback 策略：如发现底部 dock 在不应出现的场景误挂载，可回退 baseline 条件分支与 `opencode` 支持集合改动；Composer toggle 可通过恢复 `renderComposerNode()` 默认调用单独回滚。

## Open Questions

- 是否需要后续把支持引擎集合抽为共享 helper，避免 layout 与 status-panel 内部未来出现重复判断。
- 是否需要为 `OpenCode` 的 checkpoint evidence 提供更完整的数据映射；本变更仅处理入口稳定性。
