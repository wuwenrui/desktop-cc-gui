# Design: Topbar Runtime State Stability 2026-06

## Architecture Overview

本 change 在既有 P1 性能链(step 1 `composer-and-message-row-render-budget`、step 2 `renderer-resource-backpressure`)已落地的 `eventBackpressure` 基础设施之上,补完顶栏 / 右侧 panel 路径的 4 层状态稳定:

1. **`useRuntimeLogSession` 返回值稳定化**:`return { ... }` 包 `useMemo`,deps 用具体字段 / callback,避免每次 hook 重跑都新建对象。
2. **`useAppShellWorkspaceFlowsSection` 传染链切断**:`useCallback` deps 从 `runtimeRunState` 改为 `runtimeRunState.onOpenRuntimeConsole` 等具体字段。
3. **shell domain context 失效范围收敛**:把 `runtimeRunState` 从 `fileEditorContext` 移到新建 `runtimeContext`,`reuseStableAppShellDomainContexts` 的浅比较只在 `runtimeContext` 内失效,不再连带 `fileEditorContext` 和只依赖文件编辑状态的 memoized layout nodes 失效。
4. **顶栏 hot path 加 `React.memo` 兜底**:`MainHeader` / `PanelTabs` 包 `memo`,即便上游 props 重建也按浅相等跳过重渲染。
5. **`useRuntimeLogSession` listener 加 RAF coalesce buffer**:把"每秒 200 次 setState"压到"每秒 60 次(帧率)"。

整体思路:**只削峰,不削面积**——`useRuntimeLogSession` 仍接收所有 terminal output(信息完整),只把 setState 频率和对象引用稳定性约束住;layout 树仍会被 `runtimeContext` 失效传染,但**只传染到需要 runtimeRunState 的子树**,不再连带整个 fileEditorContext / useAppShellLayoutNodesSection 重算。

## Boundary With AppShell Domain Context Isolation

本 design 刻意只处理 topbar/runtime 这条已确认 hot path。它不承担以下系统性治理:

- `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` 覆盖真实 raw context 字段
- `useAppShellLayoutNodesSection` / `useAppShellSections` / `renderAppShell` 全量 flatten 收窄
- `useAppShellSearchAndComposerSection` 的 selected domains 精简
- `settingsContext` 中 settings / model / collaboration state 的拆分
- toolbar / menu / action arrays 的全局引用稳定性 audit

这些任务由 `app-shell-domain-context-isolation-2026-06` 承接。当前 change 只新增 `runtimeContext` 作为一个 focused isolation lane,不把 AppShell context 架构一次性推倒重做。

## Component Contract

### 1. `useRuntimeLogSession` 返回值稳定化

**File**: `src/features/runtime-log/hooks/useRuntimeLogSession.ts:800-822`

**改动**:
- 行 800 之前加 `useMemo` import(已经 import 了,确认就行)
- 行 800-822 的 `return { ... }` 改为 `const result = useMemo(...); return result;`
- `useMemo` deps 显式列具体字段,不复用原 `useCallback` 列表

**行为契约**:
- 当 `activeSession` 任意字段变化时,`runtimeRunState` 引用变(正确)
- 当 hook 内部 `useState` 不变(只是 hook 自身因父级 re-render 重跑)时,`runtimeRunState` 引用**保持**(之前会变,这是 bug)
- 当 `activeSession` 多个字段在同一帧内连续 setState(React 18 自动批处理)时,`runtimeRunState` 只在 commit 时变一次

**反向兼容**:
- 消费方代码无变化:仍然是同一个 shape 的 object
- 当前仓库没有 `useRuntimeLogSession` 专属测试文件;本 change MUST 新增 `src/features/runtime-log/hooks/useRuntimeLogSession.test.tsx`,覆盖 listener contract、返回值引用稳定性、RAF coalesce 与 cleanup。

### 2. `useAppShellWorkspaceFlowsSection` 传染链切断

**File**: `src/app-shell-parts/useAppShellWorkspaceFlowsSection.ts:325-345`

**改动**:
- 行 325-332 `handleToggleRuntimeConsole` 的 deps 数组从 `[closeTerminalPanel, runtimeRunState]` 改为 `[closeTerminalPanel, runtimeRunState.runtimeConsoleVisible, runtimeRunState.onOpenRuntimeConsole, runtimeRunState.onCloseRuntimeConsole]`
- 行 334-339 `handleToggleTerminalPanel` 的 deps 数组从 `[handleToggleTerminal, runtimeRunState, terminalOpen]` 改为 `[handleToggleTerminal, runtimeRunState.onCloseRuntimeConsole, terminalOpen]`

**行为契约**:
- callback 行为完全等价(同样读写 `runtimeRunState` 的字段)
- 重建次数:从"每次 `runtimeRunState` 引用变" → "只有 `runtimeRunState.runtimeConsoleVisible` 或 `onOpenRuntimeConsole` / `onCloseRuntimeConsole` 引用变时"
- `onOpenRuntimeConsole` / `onCloseRuntimeConsole` 是 `useCallback` 持有,依赖 `activeWorkspaceId` / `updateWorkspaceSession`;在同一 active workspace 内引用稳定,workspace 切换时引用变化是正确行为。`runtimeConsoleVisible` 是 `activeSession.visible` 字段,只有 `visible` 真变才变。

**反向兼容**:
- 消费方代码无变化
- 既有 test `useAppShellWorkspaceFlowsSection` 覆盖 callback 行为,不需要改

### 3. `runtimeRunState` 移出 `fileEditorContext` → 新建 `runtimeContext`

**Files**:
- `src/app-shell-parts/appShellDomainContexts.ts`
- `src/app-shell.tsx`
- `src/app-shell-parts/useAppShellLayoutNodesSection.tsx`
- `src/app-shell-parts/useAppShellSections.ts`
- `src/app-shell-parts/useAppShellSearchAndComposerSection.ts`
- `src/app-shell-parts/useAppShellSearchRadarSection.ts`
- `src/app-shell-parts/renderAppShell.tsx`

**改动**:

**3.1** `appShellDomainContexts.ts:36-104` `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`:
```ts
export const APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS: Record<
  AppShellDomainContextName,
  readonly string[]
> = {
  runtimeThreadContext: [...],
  workspaceNavigationContext: [...],
  composerContext: [...],
  layoutContext: [...],
  fileEditorContext: [...],  // 删掉 "runtimeRunState" 不会在这里出现过(它从来不在 owned list)
  settingsContext: [...],
  runtimeContext: [  // 新增
    "runtimeRunState",
  ],
};
```

**3.2** `appShellDomainContexts.ts:6-9` `APP_SHELL_DOMAIN_CONTEXT_NAMES`:
```ts
export const APP_SHELL_DOMAIN_CONTEXT_NAMES = [
  "runtimeThreadContext",
  "workspaceNavigationContext",
  "composerContext",
  "layoutContext",
  "fileEditorContext",
  "settingsContext",
  "runtimeContext",  // 新增
] as const;
```

**3.3** `app-shell.tsx` 的 `defineAppShellDomainContexts` 调用增加新 key(行 1850 附近):
```ts
const rawAppShellDomainContexts = defineAppShellDomainContexts({
  ...
  runtimeContext: {
    runtimeRunState,
  },
  fileEditorContext: {
    ...
    // 删掉 runtimeRunState
  },
  ...
});
```

**3.4** 消费方读法:
- `useAppShellLayoutNodesSection` 把 `runtimeRunState` 来源从 flat `fileEditorContext` 展开结果改为 `appShellDomainContexts.runtimeContext.runtimeRunState`
- `renderAppShell` 仍通过 `flattenAppShellDomainContexts(ctx.appShellDomainContexts)` 获得 flat `runtimeRunState`,不需要额外手写 prop
- `useAppShellSearchAndComposerSection` / `useAppShellSearchRadarSection` / `useAppShellSections` 只有在 type selection 覆盖了 `fileEditorContext` 且实际读取 `runtimeRunState` 时才需要改;当前代码事实是 `useAppShellSearchAndComposerSection` 只选择 `fileEditorContext`,但不直接读取 `runtimeRunState`
- `useAppShellWorkspaceFlowsSection` 是 `runtimeRunState` 的生产者(通过 `useWorkspaceRuntimeRun`),不消费 `appShellDomainContexts`,不应纳入 runtimeContext consumer 改造
- `appShellDomainContexts.test.ts` 加 "runtimeContext 在 shallow equal 内单独稳定" 断言

**行为契约**:
- `reuseStableAppShellDomainContexts` 的 7 个 context 浅比较各自独立
- `fileEditorContext` 现在只在 `activeEditorFilePath` / `files` / `openFileTabs` 等真文件编辑维度变化时失效
- `runtimeContext` 单独在 `runtimeRunState` 变化时失效
- 任何下游 useMemo 如果只依赖 `fileEditorContext` 不依赖 `runtimeContext`,**不再因 terminal log 输出失效**

**反向兼容**:
- type system 强制对齐:加 `runtimeContext` 必须在 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` 注册,否则 `findOverlappingAppShellDomainKeys` 出现新重叠,需要 review
- `flattenAppShellDomainContexts` 仍会展开 `runtimeContext` 到 flat ctx,既有 flat destructure 代码无感

### 4. `MainHeader` 和 `PanelTabs` 加 `React.memo`

**Files**:
- `src/features/app/components/MainHeader.tsx:84`
- `src/features/layout/components/PanelTabs.tsx:91`

**改动**:
```ts
import { memo } from "react";

function MainHeaderImpl(props: MainHeaderProps) { ... }
export const MainHeader = memo(MainHeaderImpl);
MainHeader.displayName = "MainHeader";
```

```ts
import { memo } from "react";

function PanelTabsImpl(props: PanelTabsProps) { ... }
export const PanelTabs = memo(PanelTabsImpl);
PanelTabs.displayName = "PanelTabs";
```

**行为契约**:
- props 浅相等时跳过重渲染
- `MainHeader` props 主要是 `workspace` / `parentName` / `branchName` / `branches` / `launchScript` / `openTargets` 等,这些对象来自 `useAppShellLayoutNodesSection` 的 `useMemo` 包装,引用稳定;但 `mainHeaderActions` 是 `useMainHeaderActionItems` 每次返回的新数组。`MainHeader` memo 要真正生效,本 change MUST 同步让 `mainHeaderActions` 引用稳定(例如在 `useMainHeaderActionItems` 内包 `useMemo`,并保证 action `onSelect` closures 随真实 deps 更新)。
- `PanelTabs` props 主要是 `active` / `onSelect` / `liveStates` / `visibleTabs`,都是 primitive / stable ref;`onSelect` 在 `useLayoutNodes.tsx:1398` 的 `handleRightPanelTabSelect` 是 `useCallback` 持有

**反向兼容**:
- 既有 `MainHeader.branch-reveal.test.tsx` / `MainHeader.workspace-switch-regression.test.tsx` / `MainHeader.topbar-session-tabs.test.tsx` / `PanelTabs.test.tsx` 测试无变化(memo 包装对 props-driven test 透明)
- dev tools 显示名通过 `displayName` 设置,避免 "Memo(MainHeader)" 命名干扰调试

### 5. `useRuntimeLogSession` listener 加 RAF coalesce

**File**: `src/features/runtime-log/hooks/useRuntimeLogSession.ts:409-441`

**改动**:
```ts
const pendingChunkByWorkspaceRef = useRef<Map<string, string>>(new Map());
const flushScheduledRef = useRef<boolean>(false);
const rafHandleRef = useRef<number | null>(null);
const timeoutHandleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
const mountedRef = useRef<boolean>(true);

const flushPendingChunks = useCallback(() => {
  if (!mountedRef.current) {
    return;
  }
  flushScheduledRef.current = false;
  rafHandleRef.current = null;
  timeoutHandleRef.current = null;
  const pending = pendingChunkByWorkspaceRef.current;
  if (pending.size === 0) {
    return;
  }
  const chunksByWorkspace = new Map(pending);
  pending.clear();
  for (const [workspaceId, data] of chunksByWorkspace) {
    appendWorkspaceLog(workspaceId, data);
    const exitCode = consumeExitCode(workspaceId, data);
    if (exitCode !== null) {
      updateWorkspaceSession(workspaceId, (current) => ({ ... }));
      void runtimeLogMarkExit(workspaceId, exitCode).catch(() => undefined);
    } else {
      updateWorkspaceSession(workspaceId, (current) => ({ ... }));
    }
  }
}, [appendWorkspaceLog, consumeExitCode, updateWorkspaceSession]);

const scheduleFlush = useCallback(() => {
  if (flushScheduledRef.current) {
    return;
  }
  flushScheduledRef.current = true;
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    rafHandleRef.current = window.requestAnimationFrame(() => flushPendingChunks());
  } else {
    timeoutHandleRef.current = setTimeout(flushPendingChunks, 0);
  }
}, [flushPendingChunks]);

useEffect(() => {
  mountedRef.current = true;
  const unsubscribe = subscribeTerminalOutput((event: TerminalOutputEvent) => {
    const current = pendingChunkByWorkspaceRef.current.get(event.workspaceId) ?? "";
    pendingChunkByWorkspaceRef.current.set(event.workspaceId, current + event.data);
    scheduleFlush();
  });
  return () => {
    mountedRef.current = false;
    unsubscribe();
    if (rafHandleRef.current !== null && typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(rafHandleRef.current);
    }
    if (timeoutHandleRef.current !== null) {
      clearTimeout(timeoutHandleRef.current);
    }
    rafHandleRef.current = null;
    timeoutHandleRef.current = null;
    flushScheduledRef.current = false;
    pendingChunkByWorkspaceRef.current.clear();
  };
}, [scheduleFlush]);
```

**行为契约**:
- listener 仍逐条到达(逐条 set pending buffer),但 setState 频率被 RAF 约束到帧率
- 同一 workspaceId 的多行 chunk 在同一帧内合并为单次 `appendWorkspaceLog` 调用,字符串拼接发生在 listener 阶段,结果与原行为等价
- 退出码检测、status 切换等"必须逐事件"逻辑仍在 flush 阶段跑,不丢失
- 卸载时清理 pending buffer、取消 pending RAF / timeout,并用 mounted guard 避免 unmount 后 setState

**反向兼容**:
- 新增 `useRuntimeLogSession.test.tsx` 后,listener contract 必须通过(`flushPendingChunks` 等价于原 listener 行为)
- 加 1 条 "RAF coalesce buffer 在多 chunk 同帧时合并" 断言

## Failure Modes

- **F1 (3) type alignment 漏改消费方**:TypeScript 在 `appShellDomainContexts.runtimeContext` 未读 / `appShellDomainContexts.fileEditorContext` 仍读 `runtimeRunState` 时会报 `Property 'runtimeRunState' does not exist`。依赖 CI typecheck 兜底。
- **F2 (4) `MainHeader.mainHeaderActions` props 不稳定**:`useMainHeaderActionItems` 当前返回新数组,会让 memo 无效化;本 change 必须把 action array 稳定化作为 P0 工作,否则 `MainHeader` memo 只能解决一部分 re-render。
- **F3 (5) RAF 在测试环境不可用**:`window.requestAnimationFrame` 在 vitest jsdom 下可能不存在,fallback 到 `setTimeout(...,0)`;需要 `useRuntimeLogSession.test.tsx` 显式 fake timers 覆盖。

## Out of Scope / Follow-up

- 完整 atom 拆分(`useRuntimeLogSession` 内部按 log/status/config 拆多个 useState)
- `RuntimeLogPanel` log 行虚拟化
- `TooltipIconButton` delay 调整
- `useAppServerEvents` 订阅契约回归测试(由 `chat-stream-render-isolation-2026-06` §11.5 覆盖)
