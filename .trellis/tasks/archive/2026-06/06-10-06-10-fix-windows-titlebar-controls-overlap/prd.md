# Fix Windows Titlebar Controls Overlap

## Goal

修复 Windows desktop 右上角自绘窗口控制按钮与浮动 sidebar restore/action 控件重叠的问题。

## Requirements

- Windows minimize/maximize/close 控件保持最右侧独占区域。
- layout swapped + floating sidebar restore control 出现在右侧时，必须向左避让 window controls safe zone。
- 不改变 sidebar collapse/expand 行为。
- 不影响 macOS traffic-light inset 和非 Windows desktop 布局。
- 用 focused CSS/component tests 锁定 selector 与渲染 contract。

## Acceptance Criteria

- [ ] Windows swapped floating sidebar toggle 不再使用与 window controls 相同的裸 `right: 10px` 锚点。
- [ ] `--titlebar-window-controls-width` 和 `--titlebar-toggle-side-gap` 作为集中 safe-zone tokens 使用。
- [ ] `layout-swapped-platform-guard.test.ts` 覆盖 Windows safe-zone selector。
- [ ] `SidebarToggleControls.test.tsx` 覆盖 Windows window controls 与 floating sidebar restore control 同时渲染。
- [ ] OpenSpec change strict validation 通过或记录既有 blocker。
- [ ] Focused Vitest 通过。

## Technical Notes

Linked OpenSpec change: `fix-windows-titlebar-controls-overlap`.

Implementation should prefer scoped CSS over broader topbar refactor to avoid colliding with ongoing AppShell boundary work.
