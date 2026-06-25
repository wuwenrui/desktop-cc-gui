# Proposal: Topbar Runtime State Stability 2026-06

## Why

`MainHeader` / `MainHeaderActions` / `PanelTabs` / `ResponsiveIconToolbar` 是顶栏(`.main-topbar`)和右侧工具栏(`.right-panel-toolbar`)的全部 UI 入口。点击这些按钮后,user-perceived feedback latency 在 dev 模式 + 对话实施运行期间(runtime console / dev server / tests 启动后)出现 200ms~1s 的可感顿挫,影响所有"主工具栏 + 右侧 panel tab"操作。

### Code Facts(已逐行核验源码)

- `useRuntimeLogSession`(`src/features/runtime-log/hooks/useRuntimeLogSession.ts:345-826`)通过 `subscribeTerminalOutput` 订阅 Rust 端 `terminal-output` 事件;Rust 端在 dev server / runtime 启动后逐行 emit,前端每行触发一次 `appendWorkspaceLog` → `setSessionByWorkspace`(行 374-386);hook 末尾直接 `return { ... }` 新对象字面量(行 800-822),**未用 `useMemo` 包裹,任何 setState 都让 `runtimeRunState` 引用失效**。
- `app-shell.tsx:2318` 把 `runtimeRunState` 直接展开进 `fileEditorContext`:
  ```ts
  fileEditorContext: {
    ...
    runtimeRunState,
    ...
  }
  ```
- `reuseStableAppShellDomainContexts`(`src/app-shell-parts/appShellDomainContexts.ts:166-198`)用 `areAppShellDomainContextValuesShallowEqual` 做浅比较;`runtimeRunState` 是该 context 的一个 key,引用变 → 整个 `fileEditorContext` 对象替换 → `appShellDomainContexts` 整体引用变。
- `useAppShellLayoutNodesSection`(`src/app-shell-parts/useAppShellLayoutNodesSection.tsx`)接收 `appShellDomainContexts` 作为 input,引用变会让该 section 在父级 render 时重新执行,并让依赖 `runtimeRunState` / `fileEditorContext` 的 memoized layout nodes 失效,包括 line 1443-1457 的 `rightPanelToolbarNode` 重建,以及 line 1307 附近的 `desktopTopbarLeftNode` 重建(其内部 `mainHeaderNode` 引用变)。
- `useAppShellWorkspaceFlowsSection`(`src/app-shell-parts/useAppShellWorkspaceFlowsSection.ts:325-345`)有两个 `useCallback(..., [runtimeRunState])` 依赖整个 `runtimeRunState` 对象:
  ```ts
  const handleToggleRuntimeConsole = useCallback(() => {
    if (runtimeRunState.runtimeConsoleVisible) { runtimeRunState.onCloseRuntimeConsole(); return; }
    closeTerminalPanel();
    runtimeRunState.onOpenRuntimeConsole();
  }, [closeTerminalPanel, runtimeRunState]);
  const handleToggleTerminalPanel = useCallback(() => {
    if (terminalOpen) { runtimeRunState.onCloseRuntimeConsole(); }
    handleToggleTerminal();
  }, [handleToggleTerminal, runtimeRunState, terminalOpen]);
  ```
  任何 `runtimeRunState` 引用变化 → 这两个 callback 重建 → 调用方 `useAppShellSections` / `useAppShellLayoutNodesSection` 接收新 callback → 其 useMemo 失效链扩散。
- `MainHeader`(`src/features/app/components/MainHeader.tsx:84`)和 `PanelTabs`(`src/features/layout/components/PanelTabs.tsx:91`)都**没有 `React.memo`**,所以 `desktopTopbarLeftNode` / `rightPanelToolbarNode` 重建时,组件会跟着无条件重渲染。
- `terminalOutputBackpressure`(`src/services/events.ts:113-117`)的 `createEventBackpressure<TerminalOutputEvent>` 配置**无 `coalesceKey`**,逐条入队、rAF 内逐条 flush;`runtimeLogLineBackpressure`(行 118-122)同样无 `coalesceKey`。在 dev server 高频输出场景(rust rebuild / vite hmr 触发 npm scripts),每秒可达 30~200 次 listener 派发。
- `terminal-runtime-output-backpressure` 是 P1 性能链上的既有 change(见 `openspec/specs/terminal-runtime-output-backpressure`),但**只覆盖 backpressure 内部参数,未覆盖下游 `useRuntimeLogSession` 的 listener 频率和返回值稳定性**——这是本 change 的补完。

### 体感因果链(why dev mode + 实施运行期间最明显)

1. Rust 端 dev server / runtime 启动后,每秒 emit 数十~上百条 `terminal-output`。
2. 前端 listener 每条触发 `setSessionByWorkspace` → `useRuntimeLogSession` 重跑 → `runtimeRunState` 新对象。
3. `runtimeRunState` 在 `fileEditorContext` 里 → 浅比较失效 → `appShellDomainContexts` 新对象。
4. `useAppShellLayoutNodesSection` 在父级 render 时重新执行,且相关 `useMemo` 依赖被新 context 引用击穿 → `desktopTopbarLeftNode` / `rightPanelToolbarNode` 重建。
5. `MainHeader` / `PanelTabs` 无 memo,无条件重渲染。
6. `useAppShellWorkspaceFlowsSection` 的 2 个 useCallback 重建,扩散到 `useAppShellSections` / `useAppShellLayoutNodesSection` 的 useMemo 失效链。
7. dev 模式 React 协调比 prod 慢 2~3 倍(PropTypes、Warning、DevTools hook),叠加 Vite HMR websocket 占用,主线程长期饱和。
8. 用户的 click 事件被 native 派发到 React 后的 onClick handler 同步执行(< 1ms),但 handler 触发的 setState 进入主线程排队的 React 调度器,等到下一次空闲才 commit paint;`TooltipIconButton`(200ms delay) + base-ui Tooltip close 动画(150~200ms) + Radix DropdownMenu close 动画(150~200ms)叠加后,user-perceived feedback 容易突破 500ms,极端场景接近 1s。
9. 打包(prod)模式:React prod build、无 HMR、minified bundle,主线程压力大幅下降,user 不易察觉顿挫。

### 与既有 P1 性能链的关系

`openspec/project.md` 标注 P1 性能链已有 5 个 step:
- step 1 `composer-and-message-row-render-budget`
- step 2 `renderer-resource-backpressure`(对应 `renderer-resource-backpressure` change;`eventBackpressure` substrate)
- step 3 `backend-io-cache-and-bridge-payload-budget`
- `realtime-input-and-io-isolation-2026-06`(realtime reducer fast path + backend file I/O + Rust event batching)
- `frontend-prop-chain-stability-2026-06`(batch channel 消费 + 前端 render 传播削减)

本 change 处于**step 2 之后、step 3 之前**的延伸:step 2 已落地 `eventBackpressure` 基础设施,本 change 在其之上补完"runtime log 状态稳定化 + shell domain context 失效控制 + 顶栏 memo 防御"三件事。**不重复** step 2 的 backpressure 内部参数,**不冲突** step 3 的 backend cache 范围。

### Phase Boundary / Follow-up

本 change 是 **Phase 1 / P0 hot path fix**:只修复已确认的 `runtime output -> runtimeRunState -> fileEditorContext -> topbar / panel toolbar re-render` 传播链。

它 **不试图一次性重构整个 AppShell domain context 架构**。更大的系统性问题(例如 owner key 覆盖不完整、全量 `flattenAppShellDomainContexts` legacy boundary、`useAppShellSearchAndComposerSection` 输入过宽、settings/model context 混杂、action arrays 引用不稳定)由后续 change 承接:

- `app-shell-domain-context-isolation-2026-06`

保持这个边界的原因:当前链路具备明确症状、明确 root cause、明确验证路径和 bounded rollback;把所有 AppShell context 治理塞进本 change 会显著扩大 blast radius,降低 P0 顶栏延迟修复的可交付性。

## What Changes

### 1. `useRuntimeLogSession` 返回值稳定化

**File**: `src/features/runtime-log/hooks/useRuntimeLogSession.ts`

把行 800-822 的 `return { ... }` 新对象字面量用 `useMemo` 包裹,且 deps 只列具体字段/callback:

```ts
const result = useMemo<WorkspaceRuntimeRunState>(
  () => ({
    onOpenRuntimeConsole,
    onSelectRuntimeCommandPreset,
    onChangeRuntimeCommandInput,
    onRunProject,
    onStopProject,
    onClearRuntimeLogs,
    onCopyRuntimeLogs,
    onToggleRuntimeAutoScroll,
    onToggleRuntimeWrapLines,
    onCloseRuntimeConsole,
    runtimeAutoScroll: activeSession.autoScroll,
    runtimeWrapLines: activeSession.wrapLines,
    runtimeConsoleVisible: activeSession.visible,
    runtimeConsoleStatus: activeSession.status,
    runtimeConsoleCommandPreview: activeSession.commandPreview,
    runtimeCommandPresetOptions,
    runtimeCommandPresetId: activeSession.commandPresetId,
    runtimeCommandInput: activeSession.commandInput,
    runtimeConsoleLog: activeSession.log,
    runtimeConsoleError: activeSession.error,
    runtimeConsoleTruncated: activeSession.truncated,
    runtimeConsoleExitCode: activeSession.exitCode,
  }),
  [
    onOpenRuntimeConsole,
    onSelectRuntimeCommandPreset,
    onChangeRuntimeCommandInput,
    onRunProject,
    onStopProject,
    onClearRuntimeLogs,
    onCopyRuntimeLogs,
    onToggleRuntimeAutoScroll,
    onToggleRuntimeWrapLines,
    onCloseRuntimeConsole,
    activeSession.autoScroll,
    activeSession.wrapLines,
    activeSession.visible,
    activeSession.status,
    activeSession.commandPreview,
    runtimeCommandPresetOptions,
    activeSession.commandPresetId,
    activeSession.commandInput,
    activeSession.log,
    activeSession.error,
    activeSession.truncated,
    activeSession.exitCode,
  ],
);
return result;
```

**关键**:`activeSession.log` 是字符串,React 浅比较按 `Object.is` 比较字符串值,所以 log 变了 result 引用才变(正确);其他 primitive 字段同理;callback 都是 `useCallback` 稳定引用,deps 不会假性变化。

### 2. `useAppShellWorkspaceFlowsSection` 的传染链切断

**File**: `src/app-shell-parts/useAppShellWorkspaceFlowsSection.ts`

行 325-345 的 2 个 useCallback 把 `runtimeRunState` 改为具体字段依赖:

```ts
const handleToggleRuntimeConsole = useCallback(() => {
  if (runtimeRunState.runtimeConsoleVisible) {
    runtimeRunState.onCloseRuntimeConsole();
    return;
  }
  closeTerminalPanel();
  runtimeRunState.onOpenRuntimeConsole();
}, [
  closeTerminalPanel,
  runtimeRunState.runtimeConsoleVisible,
  runtimeRunState.onOpenRuntimeConsole,
  runtimeRunState.onCloseRuntimeConsole,
]);

const handleToggleTerminalPanel = useCallback(() => {
  if (terminalOpen) {
    runtimeRunState.onCloseRuntimeConsole();
  }
  handleToggleTerminal();
}, [
  handleToggleTerminal,
  runtimeRunState.onCloseRuntimeConsole,
  terminalOpen,
]);
```

**取舍**:`runtimeRunState` 整体对象作为 dep 让 callback 重建是过度防御——按 1 的修复,`runtimeRunState` 引用只在 `activeSession` 字段真变时才变;按字段订阅能让 callback 重建次数显著降低。`onOpenRuntimeConsole` / `onCloseRuntimeConsole` 由 `useCallback` 持有,在 `activeWorkspaceId` 不变时稳定;workspace 切换时引用变化是正确行为。

### 3. `runtimeRunState` 移出 `fileEditorContext`

**File**: `src/app-shell.tsx`

行 2318 把 `runtimeRunState,` 从 `fileEditorContext` 切到一个**独立的** domain context:

- 新增 `runtimeContext: { runtimeRunState }`(放在 `defineAppShellDomainContexts` 调用的第一个参数)
- 同步更新 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS`(`src/app-shell-parts/appShellDomainContexts.ts:36-104`),把 `runtimeRunState` 注册到 `runtimeContext.ownedKeys`
- `useAppShellLayoutNodesSection` 需要从 `appShellDomainContexts.runtimeContext` 读取 `runtimeRunState`;`renderAppShell` 经 `flattenAppShellDomainContexts` 继续获得 flat `runtimeRunState`。`useAppShellWorkspaceFlowsSection` 是 `runtimeRunState` 的生产者(通过 `useWorkspaceRuntimeRun`),不应被改成消费 `runtimeContext`。

**关键效果**:`fileEditorContext` 的浅比较不再被 `runtimeRunState` 拖累;`fileEditorContext` 只有 `activeEditorFilePath` / `files` / `openFileTabs` 等真正文件编辑维度变化才失效。`runtimeContext` 单独传播 `runtimeRunState` 失效,**把"runtime 持续 log 输出"的传播范围控制在最小**。

### 4. `MainHeader` 和 `PanelTabs` 加 `React.memo`

**Files**:
- `src/features/app/components/MainHeader.tsx:84`
- `src/features/layout/components/PanelTabs.tsx:91`

```ts
function MainHeaderImpl(props: MainHeaderProps) { ... existing body ... }
export const MainHeader = memo(MainHeaderImpl);
MainHeader.displayName = "MainHeader";
```

```ts
function PanelTabsImpl(props: PanelTabsProps) { ... existing body ... }
export const PanelTabs = memo(PanelTabsImpl);
PanelTabs.displayName = "PanelTabs";
```

**关键效果**:即便 1~3 都做完,某些边界场景(workspace 切换、settingsOpen 切换)仍会重建 props;`React.memo` 给顶栏一个最终兜底,只要 props 浅相等就跳过重渲染。

### 5. `useRuntimeLogSession` 内部 listener 加 RAF coalesce

**File**: `src/features/runtime-log/hooks/useRuntimeLogSession.ts:409-441`

为 `useRuntimeLogSession` 单独订阅加一个内部 channel:

- 在 `useRuntimeLogSession` 内,`useEffect` 的 `subscribeTerminalOutput` listener **改为本地 coalesce buffer**:用 `useRef<Map<workspaceId, string>>` 持有每 workspace 的 pending chunk 串,同一帧内按 arrival order 追加字符串,`requestAnimationFrame` 内一次性 flush 拼接后的完整 payload。
- 额外持有 `rafHandleRef` / `mountedRef`:cleanup 时 `cancelAnimationFrame` 或 `clearTimeout`,清空 pending buffer,并通过 mounted guard 避免卸载后的 scheduled callback 调用 `setState`。
- 这把"每秒 200 次 setState"压到"每秒 60 次(帧率) setState"。

**取舍**:runtime log 显示会在非常高的输出频率下把同一帧内的多个 chunk 合并成一次 state update,但不会丢弃 chunk;`runtimeConsoleLog` 仍保留完整字符串(由 `appendRuntimeLog` 在 `useRuntimeLogSession:374-386` 的 `appendWorkspaceLog` 内做字符串拼接)。**对 user 的视觉影响:无**(log 展示一直是全量)。

> Note (review pass 2026-06-17):terminal output 实际是同一 payload 既进 `terminalOutputHub` 也进 `runtimeLogLineHub`,但 `useRuntimeLogSession` 现在直接订阅 `terminalOutputHub`(`useRuntimeLogSession.ts:409`),所以本项"内部 coalesce buffer"只在 `useRuntimeLogSession` 的 listener 内做;`runtimeLogLineHub` 是给 `useRuntimeLogLine` 这类未来可能新增的消费者用的,本次不动 `createEventBackpressure` 配置,避免影响 `terminalOutputBackpressure` 的逐行语义。

## Out of Scope

- `useThreads` / `useThreadsReducer` / chat stream render 路径(由 `chat-stream-render-isolation-2026-06` 覆盖)
- backend file I/O / Rust event batching(由 `realtime-input-and-io-isolation-2026-06` 覆盖)
- `eventBackpressure` 内部参数(由 `renderer-resource-backpressure` 覆盖)
- `RuntimeLogPanel` log 渲染本身的虚拟化(留作 follow-up;本 change 让 setState 频率下降后,渲染压力自然缓解)
- `TooltipIconButton` delay 调整 / base-ui Tooltip close 动画(无 spec 价值,留作 follow-up)
- `useAppServerEvents` 订阅契约回归测试(由 `chat-stream-render-isolation-2026-06` §11.5 覆盖)
- AppShell domain context 全面重构(owner map completeness / flatten consumer narrowing / search-composer context isolation / settings-model split / action array audit),由 `app-shell-domain-context-isolation-2026-06` 覆盖

## Risk

- 1 / 2 是局部 refactor,blast radius 限定在 `useRuntimeLogSession` / `useAppShellWorkspaceFlowsSection`;deps 数组从"整个对象"改"具体字段"在 React 18 引用语义下等价(都是 useCallback / useMemo 的浅比较)。
- 3 是结构变更,blast radius 较大:`appShellDomainContexts` 多一个 key,`useAppShellLayoutNodesSection` / `useAppShellSearchAndComposerSection` / `useAppShellSearchRadarSection` / `useAppShellSections` 都要从 `appShellDomainContexts.runtimeContext` 读 `runtimeRunState`。**靠 type system 强制对齐**;新增 `runtimeContext` 必须在 `APP_SHELL_DOMAIN_CONTEXT_OWNED_KEYS` 注册,否则 shallow equal 会假性 false。
- 4 是防御性 memo,blast radius 小;但 `MainHeader` / `PanelTabs` 是 hot path,任何 `useMemo` 内层依赖缺失都会让 memo 无效化,需在 review 阶段核对 `displayName` 设置。
- 5 是"读路径合并"——listener 仍逐条到达,但 setState 频率被 RAF 约束;`useTerminalSession` 的真 terminal session 路径不受影响。
- 全部 5 项都不改 Rust 后端、不改 Tauri 配置、不改 Vite 配置,dev/prod 模式都生效。

## Validation

```bash
npm run typecheck
npm run lint
npm run check:large-files
npm exec vitest run \
  src/features/runtime-log/hooks/useRuntimeLogSession.test.tsx \
  src/app-shell-parts/appShellDomainContexts.test.ts \
  src/app-shell-parts/useAppShellWorkspaceFlowsSection.test.tsx \
  src/features/app/components/MainHeaderActions.test.tsx \
  src/features/app/components/MainHeader.branch-reveal.test.tsx \
  src/features/app/components/MainHeader.workspace-switch-regression.test.tsx \
  src/features/app/components/MainHeader.topbar-session-tabs.test.tsx \
  src/features/layout/components/PanelTabs.test.tsx
openspec validate topbar-runtime-state-stability-2026-06 --strict --no-interactive
```

> Note:`src/features/runtime-log/hooks/useRuntimeLogSession.test.tsx` 是本 change 需要新增的测试文件;其余测试文件已存在于当前仓库。

手动验证步骤(在 `tauri dev` 下):
1. 打开 workspace,启动 runtime(任意 dev server),等 terminal 持续输出。
2. 点击顶栏 / 右侧工具栏任一 icon 按钮,观察 click → 视觉反馈延迟(应 < 100ms)。
3. 切右侧 panel tab(files → git → files),观察 popover 关闭 + 新 tab 高亮延迟(应 < 150ms)。

## Residual Risk / Follow-up

- 顶栏点击的"user-perceived delay"在 dev 模式下可能仍残留 50~100ms(因为 React dev build 自身开销),但远低于当前 500ms~1s。
- 完整 100ms 以内需要进一步拆 `useRuntimeLogSession` 的 atom(本次保留单一 store)。
- `RuntimeLogPanel` 的 `output.split("\n")` 全量渲染在极长 log(>10k 行)下仍可能慢,留给后续 render budget change。

## Rollback

1. 1 / 2 / 4 / 5 是局部 refactor,`git revert` 单 commit 即可。
2. 3 涉及 `appShellDomainContexts` 结构变更,`git revert` 后需确认 `useAppShellLayoutNodesSection` / `useAppShellSections` 不再读 `runtimeContext`,否则 type error。
3. 没有数据迁移或 IPC 契约变更,无 Rust 端配合。
