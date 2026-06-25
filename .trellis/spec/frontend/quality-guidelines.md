# Quality Guidelines（质量规范）

## Hard Rules（红线）

- 不猜接口（No guessed interface）。
- 不吞异常（No silent catch）。
- 不留死代码（No dead code）。
- 不在同一 PR 夹带无关行为变更。
- 高风险文件冲突禁止整文件覆盖 `--ours/--theirs`。

## Forbidden Patterns

- 在 feature 里直接 `invoke()`，绕过 `services/tauri.ts`。
- 交互界面硬编码文本，绕过 i18n。
- 复制粘贴相似逻辑，不做 reuse 评估。
- 修改大样式文件不跑 large-file 检查。
- 在核心流程里随意引入 `any`。
- 禁止直接 `JSON.parse()` raw model output，例如 `response.text`、AI helper result、assistant final text；必须先走 shared structured-output normalization。

## Required Patterns

- boundary 数据先 normalize 再使用。
- 模型结构化输出必须先 normalize、再由 domain validator 缩窄类型，repair 失败必须 fail closed 且不得写入 partial trusted data。
- side effect 必须 cleanup。
- `useEffect` 中清理/归一化 `Set`、`Map`、array state 时，内容未变化必须返回原 state 引用；禁止每轮返回等价的新 collection，避免 render loop。
- 错误信息要可追踪、可读、可反馈。
- 关键行为变更必须补 tests 或 contract check。
- 图标按钮 tooltip 激活后必须能关闭，禁止留下悬浮残影。
- 动态创建 Tauri `WebviewWindow` 时，window label pattern 必须同步覆盖 `src-tauri/capabilities/*.json`，并用 contract test 锁定；DOM `data-tauri-drag-region` 只解决命中区域，不会自动授予动态窗口权限。

## Large Tree / Commit Scope 性能约束

- tree-based Git / worktree surface 的 descendant file 集合必须先在 topology helper 中预聚合，再交给 render 消费。
- folder/root row render 禁止递归扫描整棵子树重新收集 paths；需要的 `descendantPaths` 应来自 memoized/precomputed topology。
- staged/unstaged 合并后的 commit selection 状态应尽量单轮派生，避免对同一批路径多次 `filter/map/every` 叠加。
- 镜像 surface 做 parity 修复时，优先抽 feature-local pure helper，禁止在两个面板各写一套等价遍历逻辑。

## 标准验证命令

```bash
npm run lint
npm run typecheck
npm run test
```

涉及大文件或样式重构时：

```bash
npm run check:large-files
```

修改 large-file / heavy-test-noise 治理脚本时：

```bash
npm run check:large-files
npm run check:heavy-test-noise
```

Documentation-only changes may skip runtime large-file scans when explicitly noted, but any code, stylesheet, test-governance script, or CI-gate change must run the corresponding sentry.

涉及 runtime/bridge contract 时：

```bash
npm run check:runtime-contracts
npm run doctor:strict
```

## Code Review Checklist

- 变更是否对应明确需求/规范？
- payload mapping 是否前后兼容？
- async hook 是否有 race 和 cleanup 风险？
- test 是否覆盖 success/failure/edge？
- 文件落位、命名、抽象层级是否符合规范？
- 新增动态 Tauri window label 时，普通固定窗口 label 是否仍保持原语义？动态 label glob 是否进入 capability `windows`？相关权限是否有测试断言？

## Scenario: Dynamic Tauri WebviewWindow label capability contract

### 1. Scope / Trigger

- Trigger：新增或修改 `new WebviewWindow(label, options)` 的 label 规则、动态窗口实例、窗口级事件/拖拽/聚焦/标题能力。
- 目标：防止固定 label 窗口可用、动态 label 窗口缺权限的回归。

### 2. Signatures

- Window label constant：`const WINDOW_LABEL = "feature-window"`
- Dynamic prefix：`const WINDOW_LABEL_PREFIX = "feature-window-"`
- Router predicate：`isFeatureWindowLabel(label: string | null | undefined): boolean`
- Capability source：`src-tauri/capabilities/*.json`

### 3. Contracts

- 固定入口若语义是复用窗口，MUST 继续使用固定 label，并保留 open-or-focus 行为。
- 多实例入口 MUST 使用动态 label prefix，并为每个实例隔离 session/cache key。
- `AppRouter` / window routing MUST 按固定 label 或 prefix predicate 识别同一窗口类型。
- Tauri capability `windows` MUST 同时包含固定 label 与动态 glob，例如 `"feature-window"` 和 `"feature-window-*"`.
- 若窗口依赖拖拽，menubar / titlebar DOM MUST 标记 `data-tauri-drag-region="true"`；交互按钮、tab、close 等内容控件 MUST 标记或保持 `data-tauri-drag-region="false"`，避免拖拽吞掉点击语义。

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| fixed label open | 复用/聚焦既有窗口 | 改成每次新建导致旧入口语义漂移 |
| dynamic label open | 每次创建新实例 | 复用固定 label 或共享单一 session key |
| dynamic label capability | capability `windows` 含 `prefix-*` | 只改 router，不改 capability |
| titlebar drag | chrome 区可拖拽 | 把内容 header/tab strip 当成窗口拖拽区 |
| content buttons | 点击仍触发按钮语义 | drag-region 覆盖按钮导致点击被吞 |

### 5. Good / Base / Bad Cases

- Good：`file-explorer` 继续 open-or-focus；tab detached open 使用 `file-explorer-*`、per-window session key、router prefix predicate、capability glob、focused tests。
- Base：只有一个固定窗口入口时只使用固定 label，不引入动态 prefix。
- Bad：创建 `file-explorer-${id}` 后只更新 router，遗漏 `src-tauri/capabilities/default.json`，导致窗口渲染正常但拖拽/窗口 API 权限异常。

### 6. Tests Required

- Unit/contract test：动态 label 每次不同，且不会调用固定窗口 `getByLabel` 复用逻辑。
- Unit/contract test：capability JSON `windows` 包含 `${PREFIX}*`，并包含所需 window permission。
- Router test：固定 label 与动态 prefix label 都渲染同一窗口 view。
- Component test：menubar/title copy 带 `data-tauri-drag-region="true"`；内容按钮保持非拖拽区域。

### 7. Wrong vs Correct

#### Wrong

```typescript
const label = `file-explorer-${Date.now()}`;
new WebviewWindow(label, options);
```

#### Correct

```typescript
export const FILE_WINDOW_LABEL = "file-explorer";
export const FILE_WINDOW_LABEL_PREFIX = "file-explorer-";

export function isFileWindowLabel(label: string | null | undefined): boolean {
  const normalized = label?.trim() ?? "";
  return normalized === FILE_WINDOW_LABEL || normalized.startsWith(FILE_WINDOW_LABEL_PREFIX);
}
```

## Scenario: Claude history loader control-plane fallback filtering

### 1. Scope / Trigger

- Trigger：修改 `src/features/threads/loaders/claudeHistoryLoader.ts`、Claude history service payload、legacy/cached history restore，或 backend Claude history filtering contract。
- 目标：frontend loader 作为兜底层过滤 Codex / GUI control-plane payload，但不能代替 backend 权威过滤。

### 2. Signatures

- `parseClaudeHistoryMessages(messagesData: unknown): ConversationItem[]`
- `createClaudeHistoryLoader(...): HistoryLoader`

### 3. Contracts

- Loader MUST treat backend payload as `unknown` and narrow through local guards before filtering or rendering.
- Loader MUST skip control-plane entries before producing `ConversationItem` rows.
- Control-plane matching MUST require high-confidence structure: `method=initialize`, `params/payload.clientInfo.name/title=ccgui` with `capabilities.experimentalApi`, `developer_instructions`, or pure Codex app-server invocation text.
- Pure Codex app-server text means `app-server` alone or command-token form such as `codex app-server`, `codex.exe app-server`, `codex.cmd app-server`, or `codex.bat app-server`.
- Loader MUST preserve normal user/assistant messages that merely mention `app-server` or `codex app-server` in natural language.
- Backend remains the authoritative session list/load sanitizer; frontend filtering is only a legacy/remote/cache fallback.

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| old backend returns `initialize` payload | skip row | render pseudo user message |
| old backend returns `developer_instructions` payload | skip row | show internal instructions |
| mixed history includes real user message | keep real message | drop whole transcript |
| user text mentions `app-server` / `codex app-server` | keep message | keyword-only filtering |
| unknown malformed history payload | return safe empty/parsed subset | throw during restore |

### 5. Good / Base / Bad Cases

- Good：`parseClaudeHistoryMessages()` filters structured control-plane rows before role/kind conversion.
- Base：backend already filtered pollution; frontend predicate sees only normal messages.
- Bad：`if (text.includes("app-server")) continue;` because it drops valid user questions and debugging transcripts.

### 6. Tests Required

- Vitest: filters `initialize` / `developer_instructions` rows.
- Vitest: mixed transcript keeps real user message.
- Vitest: normal user text with `app-server` / `codex app-server` keyword is preserved, while pure command-token `codex app-server` is filtered.

### 7. Wrong vs Correct

#### Wrong

```typescript
if (asString(message.text).includes("app-server")) {
  continue;
}
```

#### Correct

```typescript
if (isClaudeControlPlaneMessage(message)) {
  continue;
}
```

## Scenario: Unit tests isolate runtime-heavy child components

### 1. Scope / Trigger

- Trigger：组件测试渲染 workspace home、app shell、summary/dashboard surface，且渲染树包含 `BrowserDock`、Tauri bridge、polling/listener、webview/session bootstrap 等 runtime-heavy child。
- 目标：防止非目标测试真实挂载 runtime-heavy child 后产生 React `act(...)` warning、stderr noise 或异步 cleanup 漂移。

### 2. Signatures

- Test file：`src/features/**/components/*.test.tsx`
- Runtime-heavy child mock：

```typescript
vi.mock("../../browser-agent/components/BrowserDock", () => ({
  BrowserDock: () => null,
}));
```

### 3. Contracts

- If the test does not assert the runtime-heavy child behavior, it MUST mock that child at module boundary.
- Summary/home tests SHOULD assert their own rendered contract only, not incidental webview/session bootstrap effects.
- Tests MUST NOT leave React `act(...)` warnings or stderr payloads for `heavy-test-noise` to collect.
- Runtime-heavy child behavior MUST be covered in its own focused test file, where async effects are explicitly awaited or mocked.
- React 19 Suspense / `React.lazy` teardown MUST drain both microtasks and host-task scheduled work inside `act(...)`; do not assume repeated `Promise.resolve()` alone covers `pingSuspendedRoot`.
- Do not solve unrelated `act(...)` warnings by globally silencing `console.error`; that hides regressions.

### 4. Validation & Error Matrix

| 场景 | 必须行为 | 禁止行为 |
|---|---|---|
| WorkspaceHome summary test | mock `BrowserDock` if browser behavior is not under test | real mount triggers BrowserDock async state updates |
| BrowserDock behavior test | test BrowserDock directly with awaited effects/mocked services | rely on WorkspaceHome tests for BrowserDock coverage |
| heavy-test-noise gate | no `act` / stderr violations | passing assertions but noisy CI failure |
| Suspense lazy boundary teardown | drain microtask + host task inside `act(...)` | only add more `Promise.resolve()` rounds |
| unrelated child warning | isolate or await the actual child effect | blanket `console.error = vi.fn()` |
| async preview/outline compile | wait for the rendered async state that proves compile settled | exit test after initial render and leak `act(...)` warning |

### 5. Good / Base / Bad Cases

- Good：`WorkspaceHome.test.tsx` mocks `BrowserDock` to keep workspace summary tests deterministic.
- Base：a parent component test mocks Tauri-dependent children that are outside the assertion scope.
- Bad：letting a dashboard test mount `BrowserDock`, polling hooks, and webview bootstrap just because they appear in the production tree.

### 6. Tests Required

- Parent tests：assert parent-owned UI and callbacks after runtime-heavy children are mocked.
- Child tests：cover the runtime-heavy component separately, including async effect settle, cleanup, and failure paths.
- Gate：when touching test-governance or noisy runtime components, run the relevant targeted test and `heavy-test-noise` gate used by CI.

### 7. Wrong vs Correct

#### Wrong

```typescript
render(<WorkspaceHome workspace={workspace} currentBranch={branch} />);
// BrowserDock mounts and emits act(...) warnings unrelated to WorkspaceHome.
```

#### Correct

```typescript
vi.mock("../../browser-agent/components/BrowserDock", () => ({
  BrowserDock: () => null,
}));

render(<WorkspaceHome workspace={workspace} currentBranch={branch} />);
```

## CodeMirror State-Coupled Extensions 不可跨越 Lazy Boundary

### Scope / 触发

本规则约束 `src/features/files/**`、任何把 CodeMirror / `@uiw/react-codemirror` / `@codemirror/*` 用作 **state-coupled extension** 的编辑面（当前唯一现实路径是 file panel，后续 Codex 桌面编辑器 / composer 内嵌 code block 同样适用）。

**state-coupled extension** 指：被注入 `extensions` prop 后会注册 `StateField` / `StateEffect`，并且其它同步 API（keymap run、命令调用、panel 状态读取）依赖该 field 同步存在的 extension。具体包含但不限于：

- `@codemirror/search` 的 `search({ top })`、`searchKeymap`、`openSearchPanel` / `closeSearchPanel` / `searchPanelOpen`
- `@codemirror/autocomplete` 的 `autocompletion({})`、`startCompletion`
- `@codemirror/lint` 的 `linter(...)` / `lintGutter`
- `@codemirror/view` 内的 `keymap.of([...])`（被多 panel 共享的 keymap）
- 任何自定义 `StateField` 配套 API

### Hard Rule / 红线

- 不得把上述 state-coupled extension 拆到 `React.lazy` / 动态 `import()` 边界**之后**。
- 不得用 `ensureXxxLoaded` 这类"首次 dynamic import，导入未完成时返回 null"的 wrapper 替换静态 `import`。
- 不得把 "Mod-F / Cmd-F 这类同步 keymap run" 改成 `async (view) => { await import(...) }`——同步 keymap 路径必须保留同步可用。
- 允许把 CodeMirror 整体（`@uiw/react-codemirror` + `@codemirror/view`）按"edit mode 激活"或"打开文件时才挂载"的粒度拆到 lazy 边界；该粒度下所有 state-coupled extension 跟 shell 一起 chunked 化是合规的。

### 理由 / Why

`@codemirror/search` 的 `search({ top })` 会在 `EditorState` 中注册 `searchState` field，并把 search query、replace state、当前 match index 全部存在该 field 上。Mod-F / Cmd-F 的同步 keymap run、toolbar 上"下一个/上一个/替换"按钮、IME 复合输入、selection-driven 搜索都是基于该 field 的 transaction。

一旦拆到 `React.lazy` 之后：

- 第一次 dynamic import 还没 resolve 时，editor view 内 `openSearchPanel` 因 `searchState` field 不存在而抛错（"state.field is not a function"）或直接 noop，连续 Cmd+F 出现"开了但跳不回原文位置"、"替换不同步"、"光标错位"等 regression。
- 即使缓存 resolve 后再 `setExtension`，React 的 Suspense + re-render 会导致 lazy chunk 内构造的 extension 引用和 shell 持有的 `extensions` prop 数组对不上，editor view dispatch 时引用 mismatch，search query 与 cursor selection 解耦。
- `replace` / `replace-all` 是 transactional effect 链，不是 panel 开关；dynamic 注入时无法维持"搜索-高亮-替换"的 contiguous navigation 语义。

### Valid Pattern

```typescript
// 静态 import 在 file panel 启动路径上是 OK 的
import { search } from "@codemirror/search";

// 在 editor 装配时同步注入
const editorExtensions = useMemo(
  () => [saveKeymapExt, editorNavigationKeymapExt, search({ top: true })],
  [],
);
```

### Invalid Pattern (Reverted 2026-06-11)

```typescript
// ❌ 不要这样：把 search 拆到 React.lazy 之后的 module
import("@codemirror/search").then(({ search }) => setExtension(search({ top: true })));
// 同步 keymap run 拿不到 commands；连续 Cmd+F 断流
```

### 验证 / 验证口径

任何"为压缩 startup bundle 而拆出 `@codemirror/*`"的 change 落地前必须：

1. 在 proposal.md 显式列明该模块是不是 state-coupled extension（对照本节列表）。
2. 若是 state-coupled，**禁止拆出**，并在 tasks.md 把对应实施项标 `- [ ] Withdrawn` 并写明理由。
3. 用真人在 Tauri 桌面里连续按 Cmd+F 验证：开启 → 输入查询 → 跳下一个 → 替换 → 替换全部，行为必须与 baseline 完全一致。
4. 跑 `npx vitest run src/features/files/components/FileViewPanel.typing-latency.test.tsx` 之外，**额外**跑 `FileViewPanel.find-in-file.test.tsx`（如不存在，新建；至少覆盖：开启 search panel、连续 Cmd+F 切换 toggle、search query 持久化、replace 单次、replace-all 多次）。

### 历史回归

- 2026-06-11 `lazy-file-preview-dependencies` change 中曾尝试将 `@codemirror/search` 拆到 `FileCodeMirrorEditor` lazy 边界后，CI / 单元测试通过，但 Tauri 桌面中 Cmd+F 出现"开了但跳不回原文位置、replace 不同步"等 regression。该 change 已撤回并把 `@codemirror/search` 留在 file panel 启动路径上。详见 `openspec/changes/lazy-file-preview-dependencies/proposal.md` 的 *Withdrawn Optimization* 章节和 `openspec/docs/lazy-state-extension-regression-2026-06-11.md`。
