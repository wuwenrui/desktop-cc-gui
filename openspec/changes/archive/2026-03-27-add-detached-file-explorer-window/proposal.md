## Why

当前文件管理能力被绑定在主窗口右侧 panel 的 tab 生命周期里。开发者在对话过程中频繁需要对照工程代码，但一旦切换 tab、收起右侧 panel，文件树上下文就会消失；同时文件列表轮询也依赖 `filePanelMode === "files"` 且右侧 panel 可见，这会放大“卡”“不跟手”“一切走就没了”的使用感受。

现有右侧文件管理本身仍然有价值，问题在于它缺少一个可持续驻留的辅助形态。这次改动的目标不是替换右侧文件面板，而是在保留现有嵌入式文件管理体验的前提下，新增一个可独立存在的工程浏览与读码窗口。

## What Changes

- 保留主窗口右侧现有文件管理面板的入口、布局定位和原有使用路径，不把本次能力新增设计成替换式改造。
- 在右侧文件面板的工作区根行增加一个 detach icon，允许用户额外打开独立文件管理窗口。
- 新增独立文件管理窗口，布局固定为左侧文件树、右侧空白或文件查看区；点击文件后在右侧打开内容，而不是回到主聊天窗口。
- 独立文件管理窗口左侧文件树需要与主窗口右侧文件树保持 Git 装饰一致性（例如新增/修改/删除等状态颜色与标记）。
- 独立文件管理窗口右侧文件查看区在打开文件时需要支持 diff 语义配色渲染，确保与主窗口文件查看的视觉反馈一致。
- 在独立文件管理窗口内提供 close 或 restore 动作，用于关闭辅助窗口或回到主窗口工作流，但不要求主窗口右侧文件管理入口随之消失。
- 为 detached window 定义显式的单窗口协议：固定 window label、单例复用、workspace session payload、冷启动恢复与热切换重定向语义。
- 拆分文件树、文件查看、文件窗口状态编排三层职责，复用核心文件浏览能力，但避免主窗口和独立窗口共享脆弱的局部 UI 状态。
- 明确区分共享文件浏览组合层与主窗口专属装饰层，避免把 Spec Hub、runtime console、open app 入口等主窗口语义意外带入 detached window。
- 调整文件轮询策略，让 detached window 仅在自身可见或聚焦时维持 active polling，并允许一期内与主窗口形成可观测、可回退的双轮询模型。
- 保持现有聊天、Git、Spec Hub、Terminal 等主窗口能力不被独立文件管理窗口抢占或干扰。

## Capabilities

### New Capabilities

- `detached-file-explorer`: 用户可以从现有右侧文件面板额外打开独立文件管理窗口，而不丢失原有嵌入式文件管理入口。
- `independent-file-explorer-workspace`: 独立文件管理窗口可以在当前工作区内完成文件树浏览、文件打开和右侧内容查看，不依赖主窗口当前是否停留在文件 tab。
- `detached-file-visual-parity`: 独立文件管理窗口在文件树与文件查看两个层面保持与主窗口一致的 Git 状态装饰和 diff 配色反馈，避免跨 surface 语义断裂。
- `dual-surface-file-explorer`: 嵌入式右侧文件管理与独立文件管理窗口可以并存，系统需要确保两种入口互不覆盖、互不抢占，并能维持一致的工作区上下文。

### Modified Capabilities

None.

## Impact

- Affected code: `src/features/files/components/FileTreePanel.tsx`, `src/features/files/components/FileViewPanel.tsx`, `src/features/layout/hooks/useLayoutNodes.tsx`, `src/features/app/hooks/useGitPanelController.ts`, `src/app-shell.tsx`, `src/router.tsx`, 以及新的 detached file explorer window 组件与状态协调层。
- Affected systems: Tauri multi-window lifecycle、window-scoped route/render、workspace file polling 策略、跨窗口状态同步协议、右侧 panel 与独立窗口并存规则、相关 i18n 和测试。
- Dependencies: 复用现有 Tauri window API 与现有文件浏览实现，不计划为本次提案引入新的第三方依赖。

## Follow-up Notes

### 2026-06-20: Detached shell style loading regression

- Symptom: 独立文件窗口在未选择文件的首屏退回主窗口 `.app` grid 布局，出现左侧空列、窗口标题与文件树位置异常；正常状态应显示 detached menubar、左侧文件树、resizer 与右侧空态说明。
- Root cause: `detached-file-explorer.css` 只通过 `FileViewPanel -> loadFileViewStyles()` 间接加载；当 detached window 首屏没有 active file 时，`FileViewPanel` 不会 mount，窗口 shell 专属 CSS 因此缺失。
- Fix direction: 在 `DetachedFileExplorerWindow` root mount 时直接加载 detached shell styles，并保留 `FileViewPanel` 既有样式加载链路作为兼容，不修改 window label、session payload、polling、file open 或 file tree 行为。
- Validation: `DetachedFileExplorerWindow.test.tsx` 锁定 root style loader contract，避免 detached shell 再次依赖条件子组件加载 CSS。
