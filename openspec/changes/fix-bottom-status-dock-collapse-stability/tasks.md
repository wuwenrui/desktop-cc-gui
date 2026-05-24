## 1. Baseline Dock Mounting

- [x] 1.1 [P0] 输入：现有 layout hook 状态与 client UI visibility；输出：底部 dock 挂载条件新增 baseline tab 分支；验证：折叠态且无 activity 时 `planPanelNode` 仍存在。
- [x] 1.2 [P0] 输入：`selectedEngine`；输出：底部状态面板支持集合包含 `opencode`，且不改变 Codex 专属判断；验证：OpenCode 场景下 status panel 接收 `selectedEngine="opencode"`。
- [x] 1.3 [P1] 输入：`bottomStatusPanelExpanded=false`；输出：折叠态通过 `dockCollapsed=true` 保留 dock shell；验证：StatusPanel mock 能观察到 `dockCollapsed=true`。

## 2. Composer Control Cleanup

- [x] 2.1 [P0] 输入：主 Composer 渲染路径；输出：主 Composer 显式关闭重复 status panel toggle；验证：Composer mock 的 `showStatusPanelToggleOverride` 为 `false`。
- [x] 2.2 [P1] 输入：home Composer 渲染路径；输出：保持 home Composer 既有关闭 toggle 的行为；验证：不扩大 Composer 默认值影响范围。

## 3. Regression Tests

- [x] 3.1 [P0] 输入：client UI visibility mock；输出：将 panel/control 可见性改为测试可控 Set；验证：每个用例可独立声明 bottom activity panel 与 baseline control。
- [x] 3.2 [P0] 输入：折叠 dock、baseline tabs、OpenCode；输出：新增 regression case 覆盖底部 dock 折叠仍挂载；验证：focused Vitest 通过。
- [x] 3.3 [P1] 输入：现有 status panel 与 composer 测试；输出：确认相关测试未回归；验证：focused Vitest 通过。

## 4. Validation And Review

- [x] 4.1 [P0] 输入：OpenSpec change artifacts；输出：proposal、specs、design、tasks 完整；验证：`openspec validate fix-bottom-status-dock-collapse-stability --strict --no-interactive` 通过。
- [x] 4.2 [P0] 输入：前端 TypeScript 与 lint 规则；输出：类型与 lint 无新增问题；验证：`npm run typecheck` 与 `npm run lint` 通过。
- [x] 4.3 [P0] 输入：实现 diff 与 OpenSpec artifacts；输出：最终 code/spec review 结论；验证：列出 findings 或明确 no findings。
