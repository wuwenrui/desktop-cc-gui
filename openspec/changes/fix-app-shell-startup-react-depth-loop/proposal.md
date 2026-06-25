## Why

客户端冷启动时曾在 `AppShell` 首屏 hydration 后进入 React #185 `Maximum update depth exceeded`，用户只能看到 production error boundary，无法进入主界面。该问题发生在 renderer bootstrap 后约 700ms 内，属于 frontend startup state convergence 问题，不是 Tauri backend/runtime 错误。

需要把 Codex composer 启动选择恢复链路收敛成幂等逻辑：当 persisted selection、workspace catalog、thread-scoped selection 或默认值恢复处于中间态时，系统不得每一帧都写入新的 state reference。

## What Changes

- 修复 `AppShell` / Codex composer startup selection 恢复链路中的非幂等 state update，避免启动时重复 `setState` 触发 React #185。
- 增加 AppShell startup 级回归测试，覆盖真实 persisted state 风格的 selection/catalog 恢复路径。
- 保留现有用户可见行为：合法线程级 model / reasoning effort 继续生效；失效 selection 仍会收敛到有效默认值。
- 不新增 runtime dependency，不修改 Tauri backend API，不改用户本地存储 schema。

## Capabilities

### New Capabilities

- 无。此次为既有启动稳定性契约的修复。

### Modified Capabilities

- `codex-composer-startup-selection-stability`: 增加启动选择恢复必须幂等、不得触发 React maximum update depth 的要求。

## Impact

- Affected code:
  - `src/app-shell-parts/useAppShellComposerModelSection.ts`
  - `src/app-shell-parts/useSelectedComposerSession.ts`
  - `src/app-shell.startup.test.tsx`
  - 必要时涉及 `src/app-shell-parts/modelSelection.ts`
- APIs: 无外部 API 变化。
- Dependencies: 不新增依赖。
- Storage: 不改变 `.ccgui/client/*.json` schema；只改变读取/修复时机和 referential equality gate。

## 目标与边界

- 目标：首屏启动时，Codex composer selection 修复逻辑必须在有限次 render 内收敛。
- 目标：当 computed next selection 与 current selection 等价时，必须返回 previous state reference。
- 边界：只处理 AppShell startup / composer selection 恢复；不重构整体 composer 架构。

## 非目标

- 不迁移现有用户配置。
- 不改变模型列表展示、供应商排序、发送链参数语义。
- 不引入自动清理用户历史 selection 的批处理任务。

## 技术方案取舍

| 方案 | 做法 | 优点 | 缺点 | 结论 |
| --- | --- | --- | --- | --- |
| A. 清理用户本地 persisted state | 删除或迁移 `.ccgui/client/*.json` 中异常 selection | 见效快 | 治标不治本，其他用户仍可能触发 | 不采用 |
| B. 在 startup selection 修复链路补幂等 gate | 对修复型 `setState` 和 persist 写回做 equality check，等价则复用旧引用 | 最小改动，符合现有 spec 与 Trellis hook 规范 | 需要补测试锁住真实链路 | 采用 |
| C. 重构 AppShell composer state ownership | 拆分更细 domain/context，彻底降低 render cascade | 长期收益高 | 范围大，不适合 hotfix | 暂不采用 |

## 验收标准

- 冷启动 AppShell 回归测试不得出现 `Maximum update depth exceeded`。
- 合法 thread-scoped Codex selection 在 catalog ready 后保持不被默认值覆盖。
- 无效 model / effort 仍收敛到有效值，并且等价修复不会产生新的 state reference。
- Focused Vitest 通过：`npm exec vitest run src/app-shell.startup.test.tsx`。
