## Why

`GlobalRuntimeNoticeDock` 的最小化入口已经从独立右下角悬浮球演进为 sidebar bottom action，但现有实现仍通过 fixed/calc 坐标贴近 settings trigger，导致 DOM 层级与视觉层级不一致，展开态也容易变成过大的全局浮层。

## 目标与边界

### 目标

- 将 desktop/tablet 的 runtime notice entry 放入 `Sidebar` 的 `.sidebar-bottom-nav`，与 Settings trigger 同属一个 bottom action group。
- 保留 phone compact layout 的 app-level fallback，避免切换到非 projects tab 后失去 notice 入口。
- 将 sidebar 内展开态限制为 compact popover，并通过 portal/fixed layer 提层，避免被 sidebar overflow 或 stacking context 裁剪。
- 强化 focused tests，锁住 bottom action 层级、顺序与 minimized status class。

### 边界

- 本变更只调整 frontend component composition、CSS positioning 与 OpenSpec contract。
- 不修改 notice producer、bounded feed、visibility preference、runtime polling 或 backend/Tauri command。
- 不改变 appearance settings 中 global runtime notice dock 的显示/隐藏控制语义。

## 非目标

- 不新增 unread count、notification center、filters 或 category tabs。
- 不把 runtime notice dock 合并进 settings menu；两者只是同一 bottom action group 的 sibling。
- 不重构 `useGlobalRuntimeNoticeDock` 或 global runtime notice service。

## What Changes

- `Sidebar` 接收 `runtimeNoticeDockNode` slot，并将其渲染在 `.sidebar-bottom-nav` 内，与 `SidebarSettingsMenu` 同层。
- `useLayoutNodes` 在 desktop/tablet 将 `GlobalRuntimeNoticeDock` 传入 sidebar slot；phone 仍保留 app-level render fallback。
- `GlobalRuntimeNoticeDock` 在 sidebar 场景下把 expanded panel portal 到 `document.body`，用 trigger rect 计算 fixed placement；minimized entry 仍留在 `.sidebar-bottom-nav`。
- `global-runtime-notice-dock.css` 增加 sidebar-scoped/portal positioning，让 minimized bubble 是 32px action，expanded panel 是 560px readable compact popover 且不会被 sidebar 容器吃掉。
- `sidebar.css` 将 bottom nav 改为横向 action group，保持 settings 与 runtime notice 同层排列。
- 测试补齐 bottom action group 层级/顺序断言，以及 minimized status class 断言。
- 回写 `global-runtime-notice-dock` 与 `workspace-sidebar-visual-harmony` specs，避免后续按旧“右下角 fixed dock”契约回退。

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `global-runtime-notice-dock`: runtime notice entry 不再固定定义为 desktop 右下角入口；desktop/tablet SHALL 使用 sidebar bottom action group，phone MAY 使用 app-level fallback。展开态在 sidebar 场景 SHALL 使用 anchored compact popover，并 MAY portal to app/body layer to avoid clipping。
- `workspace-sidebar-visual-harmony`: sidebar bottom action group SHALL host Settings 与 runtime notice entry as sibling controls，并保持稳定顺序、尺寸和 popover containment。

## 技术方案对比

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| A. fixed/calc 贴近 settings trigger | 改动少 | DOM 层级仍错，swapped/collapsed/expanded 容易漂移 | Reject |
| B. 把 runtime notice 放进 `SidebarSettingsMenu` | 层级接近 | 语义错误，notice 不是 settings 菜单项 | Reject |
| C. `Sidebar` bottom slot sibling + portal popover | 入口 DOM 层级正确，弹窗不会被 sidebar 裁剪，可测试，最小影响 notice feed | 需要维护 trigger rect placement | Adopt |

## 验收标准

- Desktop/tablet 下 runtime notice minimized entry MUST 出现在 `.sidebar-bottom-nav` 内，且与 Settings trigger 是 sibling controls。
- Settings trigger MUST 排在 runtime notice entry 前面，保持用户已有 muscle memory。
- Sidebar 内 expanded notice panel MUST 是 anchored readable compact popover，宽度默认 560px 或 viewport safe width，并 MUST NOT 被 sidebar overflow/stacking context 裁剪。
- Phone compact layout MUST 继续有 app-level runtime notice fallback。
- Focused Vitest 与 `npm run typecheck` MUST pass。

## Impact

- Frontend:
  - `src/features/layout/hooks/useLayoutNodes.tsx`
  - `src/features/app/components/Sidebar.tsx`
  - `src/features/app/components/Sidebar.test.tsx`
  - `src/features/notifications/components/GlobalRuntimeNoticeDock.test.tsx`
  - `src/features/notifications/components/GlobalRuntimeNoticeDock.tsx`
  - `src/styles/global-runtime-notice-dock.css`
  - `src/styles/sidebar.css`
- Specs:
  - `openspec/specs/global-runtime-notice-dock/spec.md`
  - `openspec/specs/workspace-sidebar-visual-harmony/spec.md`
- Backend / APIs:
  - 无 command、payload、storage schema 或 dependency 变更。
