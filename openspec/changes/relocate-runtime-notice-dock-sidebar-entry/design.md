## Context

`GlobalRuntimeNoticeDock` 原始 spec 把入口定义为 app-global 右下角 dock。后续 UI 收敛时，Settings trigger 被压缩成 sidebar bottom icon，runtime notice entry 也需要跟随进入同一 bottom action group。上一版 CSS 只是用 fixed positioning 和 sidebar padding 变量把入口视觉贴近 settings，这造成两个问题：DOM 层级仍是 app-level overlay；expanded panel 继续使用全局宽度，放在 sidebar 附近时会形成过大的浮层。

## Goals / Non-Goals

**Goals:**

- 让 desktop/tablet 的 runtime notice entry 成为 `Sidebar` bottom action group 的真实 child。
- 让 expanded panel 在 sidebar 内使用 compact popover，不覆盖主工作区。
- 保持 runtime notice producer/hook/feed continuity，不因为移动 render slot 改变数据流。
- 保留 phone app-level fallback，避免 compact tab navigation 下入口不可达。

**Non-Goals:**

- 不改变 notice filtering、status calculation、producer whitelist 或 clear/minimize semantics。
- 不新增 notification center 功能。
- 不改变 appearance visibility registry。

## Decisions

### Decision 1: 使用 `Sidebar.runtimeNoticeDockNode` slot

采用显式 prop slot，把 `GlobalRuntimeNoticeDock` 作为 `SidebarSettingsMenu` 的 sibling 渲染在 `.sidebar-bottom-nav` 内。

原因：

- DOM 层级和视觉层级一致，测试可以直接断言 containment。
- 不需要让 `Sidebar` 知道 notice hook 的内部数据结构。
- 避免把 runtime notice 错塞进 settings menu，保留 feature 边界。

备选方案：

- fixed/calc：改动少，但仍然是伪同层级，layout-swapped、collapsed 和 expanded panel 都容易漂。
- settings menu 内部 item：视觉收口但语义错误，notice entry 是独立 surface，不是 settings action。

### Decision 2: Desktop/tablet sidebar slot，phone app-level fallback

`useLayoutNodes` 继续无条件调用 `useGlobalRuntimeNoticeDock(options.workspaces)`。当 `options.isPhone` 为 false 时，将 dock node 传给 sidebar；phone 下仍通过原 `globalRuntimeNoticeDockNode` 传给 compact layout。

原因：

- Desktop/tablet sidebar 可见，符合“和设置一样在一个层级里”。
- Phone 的 sidebar 只在 projects tab 可见；若强行只放 sidebar，用户在 Codex/Spec/Git tab 里会失去 runtime notice 入口。
- Hook/feed continuity 保持不变。

### Decision 3: Sidebar-scoped compact popover uses portal escape

保留 `GlobalRuntimeNoticeDock` 组件结构，但在 `.sidebar-bottom-nav` scope 下覆盖 root 和 expanded panel 样式：minimized shell 是 32px action；expanded panel 是 `min(560px, calc(100vw - 24px))` 的 readable compact popover。

当 dock 处于 sidebar placement 且 visibility 为 expanded 时，panel 通过 `createPortal(..., document.body)` 提到 app/body layer，并基于 shell trigger 的 `getBoundingClientRect()` 计算 `position: fixed` 的 `left/bottom/width`。这让 entry hierarchy 仍然是 sidebar sibling，但 expanded surface 不再被 sidebar scroll/overflow、workbench stacking context 或邻接 panel 裁剪。

原因：

- 解决全局 960px panel 在 sidebar bottom 打开时过大的 bug，同时避免 320px 过窄导致错误 JSON 被挤成竖条。
- 解决 absolute popover 留在 sidebar 子树时被 ancestor clipping 吃掉的 bug；单纯提高 `z-index` 不能突破 overflow clipping。
- 不影响 phone fallback 的全局 fixed 布局。
- Settings dropdown 与 runtime notice popover 都从 bottom action group 向上展开，交互模型一致。

### Decision 4: Minimized entry uses semantic state icons

最小化入口使用稳定的语义 icon set：`CircleCheck` 表示 idle/正常，`BellDot` 表示 has-notice/有提示，`CircleAlert` 表示 has-error/异常。

原因：

- 空心圆容易被理解成 loading、未选中 radio 或空状态，不足以表达“当前正常”。
- `CircleCheck` 与异常态的 `CircleAlert` 同属 status glyph family，信息结构更一致。
- `BellDot` 能表达“notice surface 有内容”，不会和 error severity 混淆。

### Decision 5: 测试锁住结构、逃逸层与状态语义

测试断言 `.sidebar-bottom-nav` 同时包含 Settings trigger 与 runtime notice entry，并锁住 Settings 在前、runtime notice 在后。Notice dock 组件测试断言 sidebar expanded panel 被 portal 到 `.global-runtime-notice-dock-portal-layer`，不再留在 `.sidebar-bottom-nav` 子树中；同时断言 `is-idle` / `is-has-error` status class，而不是只断言有 `svg`。

原因：

- 具体像素坐标类测试脆弱，DOM containment、portal escape 和 state class 更能表达真实 contract。
- 可防止未来重新退回 fixed/calc 贴靠方案。

## Risks / Trade-offs

- [Risk] Sidebar popover 宽度从全局面板变窄后，长错误文案更容易换行。
  -> Mitigation: 默认宽度提升到 560px，并保留 `pre-wrap` + `overflow-wrap:anywhere`，spec 明确 sidebar compact popover MAY wrap long copy。
- [Risk] Phone fallback 与 desktop/tablet slot 分支导致两个 render positions。
  -> Mitigation: Hook 仍只有一个数据源，分支只发生在 node placement。
- [Risk] Settings 和 runtime popover 同时打开可能视觉重叠。
  -> Mitigation: 本次不新增联动关闭逻辑；两个入口是 sibling，后续如需要可在 sidebar bottom action controller 中统一互斥。
- [Risk] Portal panel 脱离 sidebar DOM 后 sidebar-scoped CSS 选择器失效。
  -> Mitigation: 使用 `is-sidebar-popover` / `is-portal` class 复用 compact sizing、z-index 与 pointer-events contract。

## Migration Plan

1. Add `runtimeNoticeDockNode` slot to `Sidebar`.
2. Move desktop/tablet dock placement from app-level layout to sidebar slot; keep phone fallback app-level.
3. Add sidebar-scoped CSS for bottom action and compact popover.
4. Portal sidebar expanded panel to body and anchor it to the bottom action trigger.
5. Add focused tests for containment/order, portal escape and status classes.
6. Validate OpenSpec, focused Vitest, and typecheck.

Rollback:

- Remove `runtimeNoticeDockNode` prop, portal placement logic and sidebar-scoped CSS overrides.
- Return `GlobalRuntimeNoticeDock` to app-level `globalRuntimeNoticeDockNode` for all layouts.
- No persisted data migration is required.

## Open Questions

- 无。本次为现有 UI hierarchy 修正，不需要新增 product scope。
