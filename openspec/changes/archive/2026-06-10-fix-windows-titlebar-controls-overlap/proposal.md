# fix-windows-titlebar-controls-overlap

## Summary

修复 Windows desktop 自绘 titlebar 右上角按钮重叠问题：窗口控制按钮保持最右侧独占区域，sidebar restore / titlebar action 控件在同侧出现时向左避让，避免与 minimize / maximize / close 混叠。

## Problem

Issue #673 报告 Windows 右上角按钮错乱重叠。当前实现中：

- Windows 自绘窗口按钮使用 `titlebar-toggle titlebar-toggle-right titlebar-window-controls`。
- layout swapped 且需要浮动 sidebar restore control 时，该按钮也可能使用 `titlebar-toggle-right`。
- `.titlebar-toggle-right` 统一锚定 `right: 10px`。

因此在 Windows + layout swapped + sidebar collapsed / floating titlebar toggle 场景下，两个控件组会抢占同一个右侧锚点。

## Goals

- Windows 窗口控制按钮始终位于最右侧 reserved safe zone。
- 同侧出现的 floating sidebar restore control MUST 向左避让窗口控制区。
- 主 topbar actions / session tabs 继续遵守现有 Windows titlebar padding 规则。
- macOS traffic-light inset、非 Windows desktop、compact/tablet/phone 布局不回归。
- 用 focused CSS/组件测试锁定 overlap prevention contract。

## Non-Goals

- 不重做整个 AppShell/topbar 架构。
- 不改变 sidebar collapse/expand 行为。
- 不改变 Windows minimize/maximize/close 的 Tauri API 调用。
- 不调整 topbar session tabs 的准入、关闭或轮转逻辑。
- 不新增后端 command 或 storage 迁移。

## Approach

1. 将 Windows window controls 的宽度/间距定义为稳定 CSS 变量：`--titlebar-window-controls-width` 与 `--titlebar-toggle-side-gap`。
2. 保持 `.titlebar-window-controls` 锚定最右侧。
3. 对 `.app.windows-desktop.layout-swapped .titlebar-sidebar-toggle.titlebar-toggle-right` 增加右侧 offset，使其避开 window controls reserved zone。
4. 保留既有 `.main-topbar` Windows padding 规则，避免主 header actions 侵入右侧 safe zone。
5. 更新 CSS contract tests，断言右侧 floating sidebar toggle 不再与 window controls 共用裸 `right: 10px`。
6. 添加/更新 `TitlebarExpandControls` component test，覆盖 Windows + layout swapped + floating sidebar toggle 同时渲染时两组控件存在且 class 可区分。

## Risks

- layout swapped 场景右上角控件占用更多水平空间；在极窄 desktop 宽度下可能压缩可拖拽空白区。
- 如果未来 window controls 宽度变化但 CSS variable 未同步，避让距离可能再次不足。

风险控制：用 CSS variable 集中表达 safe zone，并用 contract test 锁定 selector。

## Validation

Focused validation:

```bash
npx vitest run src/styles/layout-swapped-platform-guard.test.ts src/features/layout/components/SidebarToggleControls.test.tsx
```

Broader validation if time permits:

```bash
npm run typecheck
npm run lint
npm run check:large-files
openspec validate fix-windows-titlebar-controls-overlap --strict --no-interactive
```
