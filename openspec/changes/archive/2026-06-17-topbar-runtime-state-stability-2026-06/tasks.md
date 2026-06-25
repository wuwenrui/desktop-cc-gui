# Tasks: Topbar Runtime State Stability 2026-06

> Review pass 2026-06-17 顺序:把 blast radius 最大的 #5(runtimeContext domain split)放到所有局部 sub-task 之后,避免一次性大面积 type 改动压住 review;1 / 2 / 3 / 4 是局部 refactor,先做并跑通测试,再做 #5。

## 0. Baseline Measurement (前置, B-0 / P0)

- [x] 0.1 [P0][depends:none][input: `useRuntimeLogSession.ts:800-822` 现有 `return { ... }`;当前仓库没有 `useRuntimeLogSession` 专属测试文件][output: 新增 `src/features/runtime-log/hooks/useRuntimeLogSession.test.tsx`,先写 baseline test "runtimeRunState reference churns on ancestor rerender when session state is unchanged";跑 `npm exec vitest run src/features/runtime-log/hooks/useRuntimeLogSession.test.tsx` 确认 baseline 行为是"reference 不稳定"][validation: 1 个测试 pass,记录"reference 不稳定"作为 known baseline] Establish runtime hook baseline.
- [x] 0.2 [P0][depends:0.1][input: `appShellDomainContexts.test.ts` 既有浅比较断言 + `findOverlappingAppShellDomainKeys` 实现][output: 加 1 个 baseline test "fileEditorContext 包含 runtimeRunState key";跑测试确认 `reuseStableAppShellDomainContexts` 在 runtime 变化时 fileEditorContext 也跟着失效][validation: 1 个测试 pass,记录 baseline] Establish baseline for context propagation.

## 1. Runtime Run State Reference Stabilization (Sub-task 1/5, P0)

- [x] 1.1 [P0][depends:0.1][input: `useRuntimeLogSession.ts:800-822` `return { ... }`][output: 把 return 改为 `useMemo` 包裹,deps 显式列 22 个具体字段/callback(见 design.md §1);保持现有 `WorkspaceRuntimeRunState` type alias 形状不变][validation: `useRuntimeLogSession.test.tsx` 新加 "reference stable when session state unchanged" 测试 pass;listener contract test 仍 pass] Wrap return in useMemo.
- [x] 1.2 [P0][depends:1.1][input: `useRuntimeLogSession.ts:345-826` 全量重读][output: 核对 9 个 callback 都由 `useCallback` 持有且 deps 覆盖真实读取字段;明确记录 `onOpenRuntimeConsole` / `onCloseRuntimeConsole` 依赖 `activeWorkspaceId` 并只在同一 workspace 内稳定;核对 `activeSession` 字段访问是 `activeSession.X` 而不是 `(activeSession as any).X`][validation: code review 走查] Audit callback stability.

## 2. Workspace Flows Toggle Callback Field-Level Deps (Sub-task 2/5, P0)

- [x] 2.1 [P0][depends:1.1][input: `useAppShellWorkspaceFlowsSection.ts:325-332` `handleToggleRuntimeConsole`][output: deps 从 `[closeTerminalPanel, runtimeRunState]` 改为 `[closeTerminalPanel, runtimeRunState.runtimeConsoleVisible, runtimeRunState.onOpenRuntimeConsole, runtimeRunState.onCloseRuntimeConsole]`;函数体不变][validation: `useAppShellWorkspaceFlowsSection` 既有 test pass;code review 核对 deps 覆盖函数体内所有读到的字段] Field-level deps for handleToggleRuntimeConsole.
- [x] 2.2 [P0][depends:2.1][input: `useAppShellWorkspaceFlowsSection.ts:334-339` `handleToggleTerminalPanel`][output: deps 从 `[handleToggleTerminal, runtimeRunState, terminalOpen]` 改为 `[handleToggleTerminal, runtimeRunState.onCloseRuntimeConsole, terminalOpen]`;函数体不变][validation: 既有 test pass;code review] Field-level deps for handleToggleTerminalPanel.

## 3. RAF Coalesce Buffer For Runtime Log Listener (Sub-task 3/5, P0)

- [x] 3.1 [P0][depends:none][input: `useRuntimeLogSession.ts:409-441` listener `subscribeTerminalOutput`][output: 加 `pendingChunkByWorkspaceRef` / `flushScheduledRef` / `rafHandleRef` / `timeoutHandleRef` / `mountedRef` / `flushPendingChunks` / `scheduleFlush`(见 design.md §5);listener 改为只追加 buffer + 调 `scheduleFlush()`;flush 函数保留 exit-code 检测 + status 切换逻辑][validation: `useRuntimeLogSession.test.tsx` 新加 "RAF coalesce collapses same-frame chunks" 测试 pass,listener contract 仍 pass;fake timers 覆盖 cleanup 不残留] Add RAF coalesce buffer.
- [x] 3.2 [P0][depends:3.1][input: `useRuntimeLogSession.test.tsx` 新增 vitest setup][output: 显式 `vi.useFakeTimers()` + mock `requestAnimationFrame`/`cancelAnimationFrame` 或 fallback timer 触发 flush;测试 1 帧内 10 chunk → 单次 state commit,字符串是 10 chunk 拼接;unmount 后推进 timer 不产生 state update][validation: 测试 pass] Test RAF coalesce behavior and cleanup.

## 4. Topbar Hot Path Memoization (Sub-task 4/5, P0)

- [x] 4.1 [P0][depends:none][input: `MainHeader.tsx:84` `export function MainHeader`][output: 拆出 `MainHeaderImpl` 内层函数;`export const MainHeader = memo(MainHeaderImpl);`;`MainHeader.displayName = "MainHeader";`;`import { memo } from "react"`][validation: 既有 `MainHeader.branch-reveal.test.tsx` / `MainHeader.workspace-switch-regression.test.tsx` / `MainHeader.topbar-session-tabs.test.tsx` pass] Memo MainHeader.
- [x] 4.2 [P0][depends:none][input: `PanelTabs.tsx:91` `export function PanelTabs`][output: 拆出 `PanelTabsImpl`;`export const PanelTabs = memo(PanelTabsImpl);`;`PanelTabs.displayName = "PanelTabs";`;`import { memo } from "react"`][validation: `PanelTabs.test.tsx` 既有 test pass] Memo PanelTabs.
- [x] 4.3 [P0][depends:4.1][input: `src/features/app/components/MainHeaderActions.tsx:37-164` `useMainHeaderActionItems`][output: 用 `useMemo` 稳定返回的 `OpenAppMenuExtraAction[]`;deps 精确覆盖 `t`、visibility booleans、active flags、icons branch、所有 `onSelect` callbacks;不要改变 action shape 或排序][validation: 新增/更新 `MainHeaderActions.test.tsx` 覆盖相同 deps 下返回同一数组引用、active flag 变化时返回新引用] Stabilize mainHeaderActions reference.

## 5. Runtime Context Domain Split (Sub-task 5/5, P0)

> Blast radius 最大。涉及 `appShellDomainContexts.ts` / `app-shell.tsx` / `useAppShellLayoutNodesSection.tsx` / `renderAppShell.tsx` 和可能受 type selection 影响的 section adapters。`useAppShellWorkspaceFlowsSection` 是 `runtimeRunState` 的生产者,不是 runtimeContext consumer,不得为了 domain split 改它的输入。

- [x] 5.1 [P0][depends:1.1, 2.1, 2.2, 3.1, 4.1, 4.2, 4.3][input: `appShellDomainContexts.ts:6-9` `APP_SHELL_DOMAIN_CONTEXT_NAMES` + 行 36-104 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`][output: 在 names 数组加 `"runtimeContext"`;在 ownedKeys 表加 `runtimeContext: ["runtimeRunState"]`;TypeScript 强制对齐][validation: `appShellDomainContexts.test.ts` 既有 test pass] Add runtimeContext to domain registry.
- [x] 5.2 [P0][depends:5.1][input: `app-shell.tsx:2318` `fileEditorContext: { ..., runtimeRunState, ... }`][output: 删掉 `fileEditorContext` 里的 `runtimeRunState,`;在 `defineAppShellDomainContexts` 调用的最后一个 context 后(或第一个前)加 `runtimeContext: { runtimeRunState }`][validation: `npm run typecheck` pass;若 `useAppShellLayoutNodesSection` 仍从 flat `fileEditorContext` 路径读取 `runtimeRunState` 会出现 type/undefined 风险,由 5.3 修复;`useAppShellWorkspaceFlowsSection` 不应因此报错] Move runtimeRunState to runtimeContext.
- [x] 5.3 [P0][depends:5.2][input: `useAppShellLayoutNodesSection.tsx:424` `runtimeRunState` destructure + `renderAppShell.tsx` flat context usage][output: `useAppShellLayoutNodesSection` 从 `appShellDomainContexts.runtimeContext.runtimeRunState` 读取 runtime state;`renderAppShell` 保持通过 `flattenAppShellDomainContexts` 获取 flat runtime state;确认 `useAppShellSearchAndComposerSection` / `useAppShellSearchRadarSection` / `useAppShellSections` 没有直接从 `fileEditorContext` 读取 `runtimeRunState`][validation: `npm run typecheck` pass,无 TS 错误] Update actual runtimeContext consumers.
- [x] 5.4 [P0][depends:5.3][input: `appShellDomainContexts.test.ts` 既有浅比较断言][output: 加 3 个新测试:"terminal output does not invalidate fileEditorContext" / "file editor changes do not invalidate runtimeContext" / "findOverlappingAppShellDomainKeys returns no runtimeRunState overlap"][validation: 3 个新测试 pass;既有 test 仍 pass] Add domain split regression tests.
- [x] 5.5 [P1][depends:5.4][input: `useAppShellLayoutNodesSection.tsx` input type + `AppShellDomainContexts` type][output: 确认需要读取 runtime state 的 consumer 类型能访问 `runtimeContext: { runtimeRunState: WorkspaceRuntimeRunState }`;不强行给不读取 runtime state 的 hook 增加字段;`WorkspaceRuntimeRunState` 已是 export type,无需新 export][validation: `npm run typecheck` pass] Verify type propagation.

## 10. Final Validation (gate, P0)

- [x] 10.1 [P0][depends:5.5][input: 所有 OpenSpec artifacts + 所有 sub-task 0-5][output: `openspec validate topbar-runtime-state-stability-2026-06 --strict --no-interactive` pass,无 P0 violation][validation: validate 退出 0] Run strict OpenSpec validation.
- [x] 10.2 [P0][depends:10.1][input: TypeScript][output: `npm run typecheck` pass][validation: 退出 0] Run typecheck.
- [x] 10.3 [P0][depends:10.1][input: ESLint][output: `npm run lint` pass][validation: 退出 0] Run lint.
- [x] 10.4 [P0][depends:10.1][input: large files guard][output: `npm run check:large-files` exit 0;`npm run check:large-files:gate` exit 0 with `found=0`;the previous `src/features/threads/hooks/useThreadEventHandlers.ts` 2831-line blocker was resolved by extracting `threadReconciliationStatusQuery.ts`, leaving the source file at 2799 lines][validation: 退出 0] Run large files check.
- [x] 10.5 [P0][depends:10.1][input: targeted test suite][output: `npm exec vitest run src/features/runtime-log/hooks/useRuntimeLogSession.test.tsx src/app-shell-parts/appShellDomainContexts.test.ts src/app-shell-parts/useAppShellWorkspaceFlowsSection.test.tsx src/features/app/components/MainHeaderActions.test.tsx src/features/app/components/MainHeader.branch-reveal.test.tsx src/features/app/components/MainHeader.workspace-switch-regression.test.tsx src/features/app/components/MainHeader.topbar-session-tabs.test.tsx src/features/layout/components/PanelTabs.test.tsx` 全部 pass][validation: 全部 test pass] Run targeted test suite.
- [x] 10.6 [P1][depends:10.5][input: 手动验证步骤(在 `tauri dev` 下)][output: `verification.md` 记录 v0.5.10 advisory smoke closure;operator feedback 表示当前构建正常可用,但未做 stopwatch measured Tauri/WebView latency run][validation: advisory smoke accepted for v0.5.10 stabilization closure;release-grade timing remains follow-up and must not be claimed as measured] Manual verification.

## 11. Follow-up (out of scope)

- [ ] 11.1 [P0/P1] 进入 `app-shell-domain-context-isolation-2026-06`: owner key completeness、flatten consumer narrowing、search/composer context isolation、settings/model split、action array stability audit。
- [ ] 11.2 [P2] 完整 atom 拆分 `useRuntimeLogSession`(log / status / config 独立 useState)。
- [ ] 11.3 [P2] `RuntimeLogPanel` log 行虚拟化(react-window / 上半部分折叠)。
- [ ] 11.4 [P2] `TooltipIconButton` delay 默认降到 80ms 或 isIconOnly 时 0。
- [ ] 11.5 [P2] 评估是否需要把 `runtimeContext` 内字段进一步按"高频 / 低频"拆开(只把 log 放在高频 atom,其他放低频)。
- [ ] 11.6 [P2] 在 1~5 落地后跑一次 `tauri dev` 长 session 测速,记录 S-RS-* perf budget 是否改善;若仍不达标,按本 tasks 11.2~11.5 顺序继续。
