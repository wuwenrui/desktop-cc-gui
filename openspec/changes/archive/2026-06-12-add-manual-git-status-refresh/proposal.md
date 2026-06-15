# Proposal: Add Manual Git Status Refresh

## Why

Git status 当前主要依赖 30 秒轮询刷新。用户在文件变更、外部命令执行、stage/unstage 后，有时会看到 Git 面板状态滞后，尤其是侧边栏 Git 面板处于可见但下一次 polling 尚未触发时。

这不是 backend 能力缺口，而是 Git Diff panel 缺少一个可见的 manual invalidation affordance。已有 frontend hook 已暴露 `refreshGitStatus()`，应复用现有链路，避免新增 Tauri command 或重复 Git status 读取逻辑。

## What Changes

1. 在 Git Diff panel 的当前仓库/状态摘要区域增加一个 icon button。
2. 点击该按钮立即调用现有 `refreshGitStatus` / `queueGitStatusRefresh` 链路刷新 Git status。
3. 为按钮补齐 i18n 文案、accessible name 与 tooltip。
4. 添加组件测试，确保点击按钮会触发 status refresh callback。

## Scope

### In Scope

- Git Diff panel 侧边栏 status refresh icon。
- React prop wiring：`useLayoutNodes` -> `GitDiffPanel`。
- i18n 文案与最小 CSS。
- Focused component test。

### Out of Scope

- 修改 Git status polling interval。
- 新增 backend / Tauri command。
- 改写 Git diff preload、root scan 或 commit action 逻辑。
- 新增全局快捷键。

## Acceptance Criteria

1. Git Diff panel 可见时，用户能在仓库状态摘要区域看到手动刷新 icon。
2. 点击 icon 后立即走现有 Git status refresh callback。
3. 该按钮具备可访问名称与 tooltip，且不会挤压路径切换按钮或文件列表视图切换控件。
4. 自动 polling 行为保持不变。
5. 组件测试覆盖点击 refresh icon 触发 callback。
