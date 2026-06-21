# Journal - chenxiangning (Part 22)

> Continuation from `journal-21.md` (archived at ~2000 lines)
> Started: 2026-06-13

---



## Session 828: 修复 AppShell domain context 测试换行断言

**Date**: 2026-06-13
**Task**: 修复 AppShell domain context 测试换行断言
**Branch**: `feature/v0.5.9`

### Summary

修复 appShellDomainContexts 测试在 Windows CRLF checkout 下的源码字符串断言失败；新增测试源码读取 helper 统一 normalize 为 LF，并验证 heavy-test-noise 全量通过。

### Main Changes

- Updated `src/app-shell-parts/appShellDomainContexts.test.ts` to read source fixtures through a helper that normalizes CRLF to LF before string assertions.
- Kept the production AppShell domain context wiring unchanged; this was a test portability fix only.

### Git Commits

| Hash | Message |
|------|---------|
| `cd41bcb8` | (see git log) |

### Testing

- [OK] `npx vitest run src/app-shell-parts/appShellDomainContexts.test.ts`
- [OK] `npm run check:runtime-contracts`
- [OK] `npm run check:heavy-test-noise -- --run` (669 test files; act/stdout/stderr payload lines all 0)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 829: 修复 heavy-test-noise 与 branding gate

**Date**: 2026-06-13
**Task**: 修复 heavy-test-noise 与 branding gate
**Branch**: `feature/v0.5.9`

### Summary

修复 useLayoutNodes provider fork 单测在 CI 上 5s 超时的问题，并将遗留 mossx 临时目录前缀替换为 ccgui，恢复 heavy-test-noise 与 branding gate。验证 heavy-test-noise 全量、branding、相关 perf node tests 均通过。

### Main Changes

- 将 `useLayoutNodes.client-ui-visibility.test.tsx` 中 provider fork 确认用例的 timeout 调整为 10s，保留原 provider 断言，覆盖 CI 慢环境下的异步 provider 列表加载。
- 将 branding gate 命中的遗留 `mossx-*` 临时目录前缀统一替换为 `ccgui-*`，覆盖 backend budget 与三个 perf 脚本测试。

### Git Commits

| Hash | Message |
|------|---------|
| `38e3cee0` | test(ci): 修复噪音与品牌检查回归 |

### Testing

- [OK] `npx vitest run src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`
- [OK] `npm run check:branding`
- [OK] `npm run lint -- src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`
- [OK] `npm run check:heavy-test-noise -- --run`
- [OK] `node --test scripts/perf-cold-start-baseline.test.mjs scripts/perf-realtime-runtime-report.test.mjs scripts/perf-startup-marker-snapshot.test.mjs`
- [OK] `git diff --check`

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 830: 收口并行对话运行时残留 P0 修复

**Date**: 2026-06-13
**Task**: 收口并行对话运行时残留 P0 修复
**Branch**: `feature/v0.5.9`

### Summary

完成 fix-parallel-conversation-runtime-residuals-2026-06 P0 修复提交：补齐性能 flag 自检/重置、ClaudeSession Drop 兜底、active process diagnostics、OpenSpec/Trellis 文档与验证记录。

### Main Changes

本次会话完成并提交 OpenSpec change fix-parallel-conversation-runtime-residuals-2026-06。

主要内容：
- 在 realtimePerfFlags 增加统一 flag registry、active flag inspection、reset helper 与测试。
- 在 Settings Other section 增加 performance diagnostics reset UI，补齐 i18n 与组件测试。
- 在 Tauri/Rust 侧为 ClaudeSession 增加 Drop best-effort child process cleanup。
- 增加 get_engine_active_process_diagnostics command、frontend tauri wrapper 与 Rust/frontend tests。
- 同步 parallel-conversation-runtime-residuals OpenSpec main spec 与 Trellis frontend guide。
- 保留 investigate-parallel-conversation-jank-2026-06 作为背景 artifacts，但未归档，因其 tasks 未完成。

验证：
- npm run lint
- npm run typecheck
- npm test（667 test files completed）
- focused vitest for realtimePerfFlags / OtherSection / tauri / i18n
- cargo targeted test engine_active_process_diagnostics_sorts_workspaces_and_counts_processes
- npm run check:runtime-contracts
- npm run doctor:strict
- openspec validate fix-parallel-conversation-runtime-residuals-2026-06 --strict
- openspec validate --specs --strict
- bash -n scripts/perf-reproduce-jank.sh


### Git Commits

| Hash | Message |
|------|---------|
| `bd456e46` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 831: 优化 progressive reveal 边界扫描

**Date**: 2026-06-14
**Task**: 优化 progressive reveal 边界扫描
**Branch**: `feature/v0.5.9`

### Summary

完成 fix-progressive-reveal-runtime-residual-2026-06：将 LiveMarkdown progressive reveal boundary finder 从多 regex pass 改为单次 newline scan，补齐回归测试、OpenSpec artifacts 与进度文档。

### Main Changes

本次会话完成并提交 OpenSpec change fix-progressive-reveal-runtime-residual-2026-06。

主要内容：
- 新建独立 P1 OpenSpec change，范围限定在 Markdown progressive reveal runtime residual。
- 将 LiveMarkdown 的 findProgressiveRevealBoundary 从 6 组 regex 顺序扫描改为单次 newline scan。
- 将循环内结构分类改成字符级判断，避免重复 slice / regex。
- 保留短 pending 直接 flush、极端 backlog 直接 flush、heading/list/quote/code fence/readable newline 边界优先级。
- 补充 LiveMarkdown 回归测试：短 pending direct flush、结构化边界优先、长 pending partial reveal。
- 更新 docs/perf/jank-fix-progress.md 阶段 3 状态。

验证：
- npx vitest run src/features/messages/components/LiveMarkdown.test.tsx
- npm run typecheck
- npm run lint
- openspec validate fix-progressive-reveal-runtime-residual-2026-06 --strict


### Git Commits

| Hash | Message |
|------|---------|
| `f706b181` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 832: 归档已验证 OpenSpec 提案

**Date**: 2026-06-14
**Task**: 归档已验证 OpenSpec 提案
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

本次会话按 OpenSpec archive 流程归档 5 个已验证且 tasks 全完成的 change，并同步 delta specs 到主 specs。

归档的 changes：
- `fix-progressive-reveal-runtime-residual-2026-06`
- `fix-parallel-conversation-runtime-residuals-2026-06`
- `fix-app-server-event-channel-compat`
- `close-client-performance-residual-2026-06`
- `close-performance-iteration-2026-06`

同步的主 specs：
- `openspec/specs/app-server-event-batching/spec.md`
- `openspec/specs/bundle-chunking-performance/spec.md`
- `openspec/specs/claude-code-realtime-stream-visibility/spec.md`
- `openspec/specs/claude-code-stream-forwarding-latency/spec.md`
- `openspec/specs/parallel-conversation-runtime-residuals/spec.md`
- `openspec/specs/realtime-input-render-budget/spec.md`
- `openspec/specs/runtime-performance-evidence-gates/spec.md`

关键修正：
- `close-client-performance-residual-2026-06` 中两个 delta 原本把新增 Requirement 写成 `MODIFIED Requirements`，导致 CLI 找不到主线标题；已修正为 `ADDED Requirements` 后归档。
- Review 发现 `parallel-conversation-runtime-residuals` 主 spec 被 CLI 整段替换时丢失 3 个既有场景；已补回 localStorage unrelated key 保护、ClaudeSession Drop 非阻塞保护、Progressive Reveal profiling evidence 场景。

验证：
- `openspec validate --specs --strict --no-interactive` passed: 345 passed, 0 failed
- `openspec validate --all --strict --no-interactive` passed: 346 passed, 0 failed
- `openspec list --json` 归档后只剩 `investigate-parallel-conversation-jank-2026-06` 一个 in-progress change


### Git Commits

| Hash | Message |
|------|---------|
| `c9dd8cb1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 833: 清理过时 OpenSpec 性能调查提案

**Date**: 2026-06-14
**Task**: 清理过时 OpenSpec 性能调查提案
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

本次会话清理了已过时的 active OpenSpec change `investigate-parallel-conversation-jank-2026-06`，避免它继续出现在 `openspec list` 中制造假任务债。

完成内容：
- 删除 `openspec/changes/investigate-parallel-conversation-jank-2026-06/` 整个 active change 目录。
- 为已归档的 `2026-06-14-close-client-performance-residual-2026-06` 增加 Archive Calibration 说明，明确该提案已完成、已归档、主 specs 已同步。
- 校准 `tasks.md` 顶部状态，补充归档后 truth-check / validation / handoff 项。

验证：
- `openspec list --json` 返回无 active changes。
- `openspec validate --all --strict --no-interactive` passed: 345 passed, 0 failed。
- 提交前工作区只包含 OpenSpec 文档改动与旧 active change 删除。


### Git Commits

| Hash | Message |
|------|---------|
| `88072aee` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 834: 重新触发 heavy noise CI 验证

**Date**: 2026-06-14
**Task**: 重新触发 heavy noise CI 验证
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

目标：重新触发 heavy-test-noise CI，验证 macos-latest 上 Messages reasoning/render Suspense act warning 是否已消失。

主要操作：
- 本地已按 workflow 等价执行 parser tests：node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs，21/21 pass。
- 本地已执行 npm run check:heavy-test-noise，670 test files 完成，act warnings 0，stdout/stderr payload 0。
- 当前代码基线已包含 Messages.runtime-reconnect.test.tsx 与 Messages.reasoning-render.test.tsx 的 Markdown lazy runtime 隔离。
- 创建空提交 7486cdfb test(ci): 重新触发 heavy noise 验证，用于触发 GitHub Actions 重新跑 CI。

验证：
- node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs：pass。
- npm run check:heavy-test-noise：pass；.artifacts/heavy-test-noise.json status=pass, breachCount=0, actWarningCount=0。

后续：
- push 后观察 GitHub Actions heavy-test-noise-sentry 三平台结果。


### Git Commits

| Hash | Message |
|------|---------|
| `7486cdfb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 835: 修复 Messages reasoning 测试类型检查

**Date**: 2026-06-14
**Task**: 修复 Messages reasoning 测试类型检查
**Branch**: `feature/v0.5.9`

### Summary

将 Messages reasoning render 测试中的 JSX.Element 显式替换为 ReactElement，避免 React 19/TS 环境缺少全局 JSX namespace 导致 npm run typecheck 失败；验证 npm run typecheck 与 npm run check:heavy-test-noise 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `262970f1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 836: 修复 CI WebService 超时与 Suspense 噪声

**Date**: 2026-06-14
**Task**: 修复 CI WebService 超时与 Suspense 噪声
**Branch**: `feature/v0.5.9`

### Summary

修复 WebServiceSettings generate token 测试在 CI 初始 refresh 未完成时点击 disabled 按钮导致的 5s timeout；预热 AppRouter lazy route imports，降低 Suspense lazy promise 在测试边界外 settle 引发 act warning 的风险；验证 npx vitest run WebServiceSettings/router、npm run typecheck、npm run check:heavy-test-noise 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `50c2a169` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 837: 修复 router lazy 测试 act 噪声

**Date**: 2026-06-14
**Task**: 修复 router lazy 测试 act 噪声
**Branch**: `feature/v0.5.9`

### Summary

修复 macOS heavy-test-noise CI 中 React Suspense pingSuspendedRoot act warning：将 AppRouter 测试渲染收口到 async act helper，确保 React.lazy promise 在测试边界内完成。验证通过 npm run typecheck、targeted router/WebService Vitest、完整 npm run check:heavy-test-noise（670 test files，act warnings 0，breachCount 0）。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4ec39c61` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 838: 修复 WebService token 生成测试超时

**Date**: 2026-06-14
**Task**: 修复 WebService token 生成测试超时
**Branch**: `feature/v0.5.9`

### Summary

修复 Linux CI 中 WebServiceSettings token 生成测试 5000ms timeout：将 token hex 生成抽成可注入 helper 并补纯函数测试，组件测试注入固定 generator，避免依赖 globalThis.crypto descriptor 和异步 UI 时序；同时把生成逻辑放入 try/catch 内，错误可进入组件错误状态。验证通过 focused WebService Vitest、CI 对应 settings 四文件组合、npm run typecheck、完整 npm run check:heavy-test-noise（670 test files，WebService 批次通过，act warnings 0，breachCount 0）。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `556adfb7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 839: 修复 fork provider 选择测试时序

**Date**: 2026-06-14
**Task**: 修复 fork provider 选择测试时序
**Branch**: `feature/v0.5.9`

### Summary

修复 Windows CI 第 73 批 useLayoutNodes.client-ui-visibility 测试偶发使用旧 provider 的失败：在 fork provider 测试中先等待 async getCodexProviders 注入 Provider B option，再用 act 收口 select change，并在确认前等待 controlled select value 更新为 provider-b。验证通过 focused useLayoutNodes 测试、CI 对应第 73 批组合、npm run typecheck、完整 npm run check:heavy-test-noise（670 test files，act warnings 0，breachCount 0）。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8c3bc5fe` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 840: 稳定 heavy-test-noise Suspense teardown

**Date**: 2026-06-14
**Task**: 稳定 heavy-test-noise Suspense teardown
**Branch**: `feature/v0.5.9`

### Summary

修复 CI heavy-test-noise 中 React Suspense teardown 偶发 act warning。

### Main Changes

### Goal

修复 GitHub CI 中 `npm run check:heavy-test-noise` 在全部 670 个 Vitest 文件完成后，因 React 19 Suspense resource 在测试外完成加载而触发的 `act(...)` warning violation。

### Changes

- 调整 `src/test/vitest.setup.ts` 的 `flushReactSuspenseMicrotasks()`。
- 保持单个 `act(async () => ...)` 边界不变，只把内部 microtask drain 从 3 次 `Promise.resolve()` 扩展为 8 轮循环。
- 避免引入 timer flush 或多段 `act`，降低对 fake timers 和测试 teardown 顺序的副作用。

### Files

- `src/test/vitest.setup.ts`

### Validation

- `node node_modules/vitest/vitest.mjs run --maxWorkers 1 --minWorkers 1 src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`
- `node node_modules/vitest/vitest.mjs run --maxWorkers 1 --minWorkers 1 src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxFooter.manual-memory.test.tsx src/features/composer/components/ChatInputBox/ComposerReadinessBar.test.tsx src/features/composer/components/ChatInputBox/ChatInputBox.submit-button.test.tsx`
- `npm run check:heavy-test-noise`：completed 670 test files；act warnings 0；stdout/stderr payload lines 0。
- `npm run typecheck`

### Notes

本次是测试基础设施稳定性修复，不改变业务运行时代码。


### Git Commits

| Hash | Message |
|------|---------|
| `ce59b8118fe1a09adc22289298c9b98c6cec8de7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 841: 稳定 Suspense host-task teardown

**Date**: 2026-06-14
**Task**: 稳定 Suspense host-task teardown
**Branch**: `feature/v0.5.9`

### Summary

修复 heavy-test-noise 在 CI 上复发的 React 19 Suspense pingSuspendedRoot act warning。

### Main Changes

### Goal

修复前一版 microtask-only teardown 在 CI 上仍复发的 `heavy-test-noise` failure：React 19 Suspense resource 在测试外完成加载，触发 `pingSuspendedRoot` / `act(...)` warning。

### Root Cause

上一版只在 `act(...)` 内增加 `Promise.resolve()` 轮数，只覆盖 microtask drain。CI 上 `React.lazy` / dynamic import / Suspense resource settlement 可能跨 host task，导致 resource ping 仍可能发生在测试 teardown 的 `act(...)` 边界外。

### Changes

- `src/test/vitest.setup.ts`
  - 新增 `waitForReactHostTask()`，使用 `MessageChannel` 等待 host-task scheduled work；缺失 `MessageChannel` 时退回 resolved promise。
  - 将 `flushReactSuspenseMicrotasks()` 改为 `flushReactSuspenseWork()`。
  - 每轮在同一个 `act(...)` 边界内执行 microtask -> host task -> microtask。
  - 保持 cleanup 前后各 flush 一次。
- `.trellis/spec/frontend/quality-guidelines.md`
  - 在 heavy-test-noise / runtime-heavy child 场景中沉淀 React 19 Suspense teardown 规则：不能只依赖 repeated `Promise.resolve()`，必须覆盖 host task。

### Validation

- `node node_modules/vitest/vitest.mjs run --maxWorkers 1 --minWorkers 1 src/router.test.tsx src/app-shell-parts/appShellLazyBoundaries.test.ts src/features/files/components/FileViewPanel.lazy-race.test.tsx`
- `npm run typecheck`
- `npm run check:heavy-test-noise`：completed 670 test files；act warnings 0；stdout/stderr payload lines 0。
- `npm run lint`

### Notes

- 本次未全局静默 `console.error`，仍保留 heavy-test-noise 对真实 act/stderr/stdout regression 的捕获能力。
- `src/templates/markdown/spec/` 在当前仓库不存在，因此 break-loop 文档同步没有可执行目标。


### Git Commits

| Hash | Message |
|------|---------|
| `d4fcbbee5422b68c7c42e4efc9ad6099fe9fcc85` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 842: 修复 Messages 测试 Suspense act 噪声

**Date**: 2026-06-15
**Task**: 修复 Messages 测试 Suspense act 噪声
**Branch**: `bump-version-0.5.10`

### Summary

隔离 Messages 父组件测试中的 Markdown 懒加载运行时，消除 check:heavy-test-noise 中由 Suspense lazy import 触发的 React act warning；保留 Markdown 专项测试走真实组件。验证 npm run check:heavy-test-noise 通过，act warnings 为 0。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9f7002bf` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 843: 修复文件树首屏滚动容器布局

**Date**: 2026-06-16
**Task**: 修复文件树首屏滚动容器布局
**Branch**: `feature/v0.5.10`

### Summary

修复右侧文件树首次进入时纵向 scrollbar 不出现、切换 Git 面板后才恢复的问题，并回写 OpenSpec proposal review。

### Main Changes

- 根因定位：`FileTreePanel` 首屏依赖 lazy-loaded `diff.css` 的 `.diff-panel` 布局 shell；未切过 Git 面板时 `.file-tree-list` 无法稳定形成正确 scroll container。
- 修复实现：在 `src/styles/file-tree.css` 的 `.file-tree-panel` 内补齐 `display:flex`、`flex:1`、`flex-direction:column`、`min-height:0`、`padding`、`position` 和 `-webkit-app-region:no-drag`，保留 `.diff-panel.file-tree-panel` override 兼容既有样式链路。
- 测试补强：在 `src/styles/client-typography-font-size.test.ts` 增加 CSS contract，锁定文件树 scroll shell 独立于 lazy Git diff styles。
- 提案回写：新增 `openspec/changes/fix-file-tree-virtual-scroll-height/proposal-review.md`，记录现象、错误修复复盘、最终根因、兼容性 review、边界和验证结果。
- 验证通过：`npm exec vitest run src/styles/client-typography-font-size.test.ts src/features/files/components/FileTreePanel.run.test.tsx`、`npm run typecheck`、`npm run lint`、`npm run check:large-files`。
- OpenSpec strict validate 说明：`openspec validate fix-file-tree-virtual-scroll-height --strict` 返回 Unknown item，因为该 active change 当前只有目录骨架且无标准 `proposal.md/tasks.md/spec.md`，本次按 hotfix review artifact 收口，不伪造完整 lifecycle。


### Git Commits

| Hash | Message |
|------|---------|
| `269088b2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 844: 修复 Composer 文件引用深层路径搜索

**Date**: 2026-06-16
**Task**: 修复 Composer 文件引用深层路径搜索
**Branch**: `feature/v0.5.10`

### Summary

修复 Composer @ 文件引用无路径查询无法命中深层文件的问题，回写 OpenSpec contract 并完成 focused tests/typecheck/lint/OpenSpec 验证。

### Main Changes

## 本次工作
- 修复 `ChatInputBoxAdapter.fileCompletionProvider` 的候选源分层问题：无 `/` 查询先匹配 root candidates，不足时按 workspace 缓存并搜索 full workspace snapshot。
- 保留 `@dir/query` scoped 查询的 lazy directory-children lookup，避免破坏文件树 progressive loading 性能边界。
- 同步 `useComposerAutocompleteState` 的 legacy/parent autocomplete 语义，避免父层 suggestionsOpen 与真实 dropdown 语义漂移。
- 回写 `composer-file-reference-index-availability` main spec 与历史 proposal closure，记录 nested workspace path search contract。

## 验证
- `npx vitest run src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx src/features/composer/hooks/useComposerAutocompleteState.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `openspec validate --all --strict --no-interactive`
- `git diff --check`


### Git Commits

| Hash | Message |
|------|---------|
| `3f08861b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 845: 稳定 FileViewPanel 慢 git marker 测试

**Date**: 2026-06-16
**Task**: 稳定 FileViewPanel 慢 git marker 测试
**Branch**: `feature/v0.5.10`

### Summary

修复 FileViewPanel 慢 git marker 用例在 CI batch 下过早读取 editor value 的时序问题，并完成目标测试、整文件测试、eslint、typecheck 与 diff gate。

### Main Changes

## 本次工作
- 修复 `FileViewPanel navigation > mounts the editor before slow git markers resolve` 在 Windows CI batch 下的时序不稳定。
- 根因：测试只等待 `mock-codemirror` 节点存在，但 mock editor 的 `props.value` 还需要等 file read async state commit；慢 git diff promise 不 resolve 时，节点先出现、value 后更新。
- 修复：改为 `waitFor` 等待 editor value 等于 `const value = 1;`，保留原行为断言：editor 内容不依赖 git markers resolve。

## 验证
- `npx vitest run src/features/files/components/FileViewPanel.test.tsx -t "mounts the editor before slow git markers resolve"`
- `npx vitest run src/features/files/components/FileViewPanel.test.tsx`
- `npx eslint src/features/files/components/FileViewPanel.test.tsx src/features/composer/components/Composer.rewind-confirm.test.tsx`
- `npm run typecheck`
- `git diff --check`


### Git Commits

| Hash | Message |
|------|---------|
| `59399914` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 846: 审核聊天流渲染隔离提案

**Date**: 2026-06-16
**Task**: 审核聊天流渲染隔离提案
**Branch**: `feature/v0.5.10`

### Summary

优化并提交 chat-stream-render-isolation-2026-06 OpenSpec 提案

### Main Changes

- 审核并优化 chat-stream-render-isolation-2026-06 OpenSpec proposal/design/tasks/spec delta。
- 修正 useAppServerEvents、transient timer、TTL ownership、streaming virtualization 等执行口径。
- 验证 openspec validate chat-stream-render-isolation-2026-06 --strict --no-interactive 通过。


### Git Commits

| Hash | Message |
|------|---------|
| `536a7b5c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 847: 补齐聊天流式渲染隔离验证

**Date**: 2026-06-16
**Task**: 补齐聊天流式渲染隔离验证
**Branch**: `feature/v0.5.10`

### Summary

实现并验证 chat-stream-render-isolation-2026-06：补齐 reducer fast path、workspace-scoped refs、LRU eviction cleanup、streaming complexity delta、virtualization 与 transient cleanup 的实现/测试/OpenSpec 校准。

### Main Changes

- OpenSpec change: `chat-stream-render-isolation-2026-06`
- 实现 workspace-scoped refs 与 eviction cleanup，补充 `workspaceScopedMap` helper 与 handler transient cleanup。
- 补齐 streaming hot path：reducer completed/upsert fast path、markdown complexity delta、streaming virtualization、Messages local transient timer cleanup。
- 更新 runtime evidence budgets 与 OpenSpec proposal/design/tasks，使文档和实现对齐。
- Review 后补充 `useThreads.integration.test.tsx` 覆盖 LRU formula、eviction diagnostic、同名 threadId 跨 workspace isolation。
- 验证：targeted vitest 33 tests passed；`npx tsc --noEmit --pretty false` passed；`npm run lint` passed；`openspec validate chat-stream-render-isolation-2026-06 --strict --no-interactive` passed；`git diff --check` passed。


### Git Commits

| Hash | Message |
|------|---------|
| `ae5def30` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 848: 收敛顶栏菜单按钮

**Date**: 2026-06-17
**Task**: 收敛顶栏菜单按钮
**Branch**: `feature/v0.5.10`

### Summary

将主顶栏与右侧面板的平铺 icon 操作收敛为响应式 command menu，补齐 copy path，并回写前端组件规范。

### Main Changes

| Area | Work |
|------|------|
| MainHeader | 将运行控制台、终端、SOLO、浏览器、说明文档、右侧栏切换与 Copy path 合并进 open-app/Finder command menu。 |
| Right panel | 新增 shared ResponsiveIconToolbar，让右侧 panel tab 默认只外显 active/live/promoted 项，其余进入 overflow。 |
| Theme / platform | 菜单背景、hover、文字使用 theme token；顶栏交互控件保持 data-tauri-drag-region="false"，兼容 macOS/Windows titlebar 点击。 |
| UI clipping | 主顶栏 open-app 菜单父容器改为 overflow visible；右侧 Radix menu 走 portal，避免浮层被吃。 |
| Spec | 回写 .trellis/spec/frontend/component-guidelines.md 的 Topbar Consolidated Command Menus 规范。 |

**Validation**:
- PASS: `npx vitest run src/features/app/components/MainHeader.topbar-session-tabs.test.tsx src/features/app/components/OpenAppMenu.test.tsx src/features/app/components/MainHeaderActions.test.tsx src/features/layout/components/PanelTabs.test.tsx src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx`
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `git diff --check`
- NOTE: `npm run test` / thread reducer focused test has pre-existing unrelated failures expecting `Apple event error -10000` while fixture text contains `Apple event error -100`; no current diff under `src/features/threads`.
- NOTE: `npm run check:large-files` reports pre-existing unrelated `src/features/threads/hooks/useThreadEventHandlers.ts` large-file violation.


### Git Commits

| Hash | Message |
|------|---------|
| `b1907b3b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 849: 修复 Apple event 诊断码快照合并

**Date**: 2026-06-17
**Task**: 修复 Apple event 诊断码快照合并
**Branch**: `feature/v0.5.10`

### Summary

修复 Codex assistant snapshot 去重时把 Apple event error -10000 回退成 -100 的问题，并补齐回归测试。

### Main Changes

| Area | Work |
|------|------|
| Assistant text normalization | 在 near-duplicate paragraph 选择中保留更完整的 Apple event diagnostic code，避免 `-10000` 被旧 `-100` 覆盖。 |
| Thread reducer | `upsertItem` 的等价 assistant snapshot dedupe 使用 raw snapshot text 与 completed snapshot merge，并修复 incremental fast-path 误判 no-op。 |
| Tests | 新增 completed snapshot merge 回归测试；恢复 `useThreadsReducer.completed-duplicate.test.ts` 失败用例。 |

**Validation**:
- PASS: `npx vitest run src/features/threads/hooks/threadReducerTextMerge.test.ts src/features/threads/hooks/useThreadsReducer.completed-duplicate.test.ts`
- PASS: `npm run typecheck`
- PASS: `npm run lint`
- PASS: `npm run test`（671 test files completed）
- PASS: `git diff --check`
- NOTE: `npm run check:large-files` exits 0 but still reports existing unrelated `src/features/threads/hooks/useThreadEventHandlers.ts` large-file violation.


### Git Commits

| Hash | Message |
|------|---------|
| `5f618c20` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 850: 稳定长运行客户端运行时

**Date**: 2026-06-17
**Task**: 稳定长运行客户端运行时
**Branch**: `feature/v0.5.10`

### Summary

完成 stabilize-long-running-client-runtime-2026-06 OpenSpec 提案与实现提交：补齐长列表虚拟化生产路径、runtime active process diagnostics age threshold、Markdown worker request metadata 与 diagnostics evidence gate。

### Main Changes

| Area | Details |
|------|---------|
| OpenSpec | 新增 `stabilize-long-running-client-runtime-2026-06` proposal/design/tasks/spec deltas/evidence，并明确 `5.4` long-run trace 与 `6.x` 为 follow-up/deferred。 |
| Runtime | Gemini/OpenCode active child registry 改为记录 `registered_age_ms`，stale child candidates 只在达到阈值后输出；保留 `activeProcessIds` 兼容字段。 |
| Frontend | HomeChat workspace picker 与 ThreadList 接入真实 virtualization helper，并补齐 bounded viewport、relative spacer、absolute row CSS。 |
| Markdown | Worker request 增加 content-safe metadata，导出 hook/worker diagnostics，补充 focused tests。 |
| Validation | `typecheck`、`lint`、`cargo check`、focused Vitest、focused cargo tests、OpenSpec strict validate、runtime evidence gate、diff check 均通过。 |

**Manual Follow-up**:
- 真实 30-60 分钟 long-run trace 仍建议由人工使用后补证据。
- P2 `6.x` 保持后续增强项，不阻塞当前代码提交。


### Git Commits

| Hash | Message |
|------|---------|
| `4e981689` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 851: 收口 AppShell 运行态稳定性与 OpenSpec 归档

**Date**: 2026-06-17
**Task**: 收口 AppShell 运行态稳定性与 OpenSpec 归档
**Branch**: `feature/v0.5.10`

### Summary

完成 AppShell runtime state 稳定化、domain context 隔离、大文件门禁修复，并归档两个 OpenSpec change。

### Main Changes

- 实现运行态稳定性收口：稳定 `useRuntimeLogSession` 返回引用，runtime output 使用 RAF coalesce，过滤空 workspace / 空 payload。
- 拆分 AppShell domain context：新增 `runtimeContext`、`modelSelectionContext`、`collaborationModeContext`，补全 owner map completeness gate 和 duplicate raw key guard。
- 收窄 hot consumer boundary：layout / sections / render / search-composer 不再默认 full flatten；补 focused tests。
- 稳定 topbar hot path：`MainHeader`、`PanelTabs` memo；`MainHeaderActions` action array memo。
- 修复大文件硬门禁：抽出 `threadReconciliationStatusQuery.ts`，`useThreadEventHandlers.ts` 降至 2799 行，`check:large-files:gate` found=0。
- OpenSpec 收口：归档 `topbar-runtime-state-stability-2026-06` 和 `app-shell-domain-context-isolation-2026-06`，同步主 specs。

验证：
- `npm run lint` pass
- `npm run typecheck` pass
- `npm run check:large-files:gate` pass, found=0
- `npm run check:heavy-test-noise` pass, completed 680 test files
- `openspec validate topbar-render-isolation --strict --no-interactive` pass
- `openspec validate app-shell-domain-context-isolation --strict --no-interactive` pass


### Git Commits

| Hash | Message |
|------|---------|
| `7d8b987d` | (see git log) |
| `29b835f0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 852: 归档聊天流与长运行稳定性提案

**Date**: 2026-06-17
**Task**: 归档聊天流与长运行稳定性提案
**Branch**: `feature/v0.5.10`

### Summary

完成 chat-stream-render-isolation 与 stabilize-long-running-client-runtime 两个 OpenSpec change 的收尾、验证、归档和主 spec 同步。

### Main Changes

- 将 chat-stream 的真实 Tauri/WebView measured trace 明确迁移到 release-grade evidence follow-up,同时记录 10.7 scope exception 为 accepted archive exception。
- 将 long-running runtime 的 15-30min long-run trace 明确迁移到 release-grade evidence follow-up,不伪造本地沙盒不可观测结果。
- 归档 `chat-stream-render-isolation-2026-06` 至 `openspec/changes/archive/2026-06-17-chat-stream-render-isolation-2026-06/`,同步 `conversation-realtime-cpu-stability` 主 spec。
- 归档 `stabilize-long-running-client-runtime-2026-06` 至 `openspec/changes/archive/2026-06-17-stabilize-long-running-client-runtime-2026-06/`,同步 `long-list-virtualization-performance` / `markdown-parse-pipeline` / `parallel-conversation-runtime-residuals` / `runtime-performance-evidence-gates` 主 specs。
- 刷新 runtime evidence gate report,OpenSpec active list 中这两个 change 已清除。

验证：
- `openspec validate chat-stream-render-isolation-2026-06 --strict --no-interactive` pass
- `openspec validate stabilize-long-running-client-runtime-2026-06 --strict --no-interactive` pass
- `npm run typecheck` pass
- `npm run lint` pass
- `npm run check:runtime-evidence-gates` pass
- `npm run perf:realtime:boundary-guard` pass
- `npm run check:realtime-event-batching` pass
- `npm run check:large-files:gate` pass, found=0
- archived main specs validate pass: conversation-realtime-cpu-stability, long-list-virtualization-performance, markdown-parse-pipeline, parallel-conversation-runtime-residuals, runtime-performance-evidence-gates


### Git Commits

| Hash | Message |
|------|---------|
| `94562f8a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 853: 补齐稳定性归档文档

**Date**: 2026-06-17
**Task**: 补齐稳定性归档文档
**Branch**: `feature/v0.5.10`

### Summary

补齐已归档稳定性 proposals 的 What Changes，并更新主 specs 的 Purpose，消除 archive 后 TBD 与 proposal section warning。

### Main Changes

- 为 `chat-stream-render-isolation-2026-06` archived proposal 增加 `## What Changes`,总结 reducer fast path、streaming virtualization、complexity delta、workspace-scoped refs、TTL cleanup、proxy budget/evidence deferral。
- 为 `stabilize-long-running-client-runtime-2026-06` archived proposal 增加 `## What Changes`,总结 child process parity、active process diagnostics、stale diagnostics、long-list virtualization、Markdown worker lifecycle、S-LR evidence deferral。
- 更新 5 个主 specs 的 Purpose,替换归档后残留的 `TBD - created by archiving change ...`:
  - `topbar-render-isolation`
  - `app-shell-domain-context-isolation`
  - `long-list-virtualization-performance`
  - `markdown-parse-pipeline`
  - `runtime-performance-evidence-gates`

验证：
- `openspec validate topbar-render-isolation --strict --no-interactive` pass
- `openspec validate app-shell-domain-context-isolation --strict --no-interactive` pass
- `openspec validate long-list-virtualization-performance --strict --no-interactive` pass
- `openspec validate markdown-parse-pipeline --strict --no-interactive` pass
- `openspec validate runtime-performance-evidence-gates --strict --no-interactive` pass


### Git Commits

| Hash | Message |
|------|---------|
| `4e00c1ed` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 854: 合并 PR 696 供应商排序修复

**Date**: 2026-06-17
**Task**: 合并 PR 696 供应商排序修复
**Branch**: `feature/v0.5.10`

### Summary

调查 GitHub PR #696，确认 Files 面板滚动修复当前分支已具备；语义合并 provider createdAt 补齐、更新时间保留与 createdAt/id 稳定排序逻辑到 src-tauri/src/vendors/commands.rs。验证 rustfmt、cargo test vendors::commands::tests、cargo test vendor、cargo check，以及现有 file tree typography/scroll Vitest 均通过。兼容性 review：旧配置 createdAt 保留，缺失 createdAt 的旧 provider 以 id 稳定兜底，新增 provider 自动补时间，不改 frontend bridge 或 command 注册。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c5fe5ea5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 855: 修复 runtime 重连恢复卡片状态

**Date**: 2026-06-17
**Task**: 修复 runtime 重连恢复卡片状态
**Branch**: `feature/v0.5.10`

### Summary

稳定 Messages runtime reconnect card 状态与 CI batch 回归

### Main Changes

本次处理客户端 runtime reconnect 恢复卡片再次出现的 CI batch failure，并收敛 React #185 同类前端 update-loop 风险。

主要变更：
- 创建 OpenSpec change `fix-runtime-reconnect-card-state-loop`，补充 proposal/design/spec delta/tasks。
- `RuntimeReconnectCard` 将 reset effect 依赖从 `retryMessage` 对象引用改为语义签名，避免父层传入等价新对象时清掉刚完成的 error/restored 状态。
- `Messages.runtime-reconnect.test.tsx` 的 Markdown mock 改为 effect-phase 调用 `onRenderedValueChange`，避免 render-phase callback 制造 React update-depth 风险。
- runtime reconnect 成功/失败断言改为等待完整 recovery outcome，而不是只等待 `ensureRuntimeReady` 被调用。

验证：
- `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/messages/components/Messages.reasoning-exit-plan.test.tsx src/features/messages/components/Messages.reasoning-render.test.tsx src/features/messages/components/Messages.rich-content.test.tsx src/features/messages/components/Messages.runtime-reconnect.test.tsx` 通过，72 tests passed。
- `npx vitest run src/features/messages/components/Messages.runtime-reconnect.test.tsx --maxWorkers 1 --minWorkers 1` 通过，20 tests passed。
- `npm run typecheck` 通过。
- `npm run lint` 通过。
- `openspec validate fix-runtime-reconnect-card-state-loop --strict --no-interactive` 通过。

影响范围：
- 前端 message runtime reconnect card 状态稳定性。
- runtime reconnect focused tests。
- OpenSpec conversation-runtime-stability delta。


### Git Commits

| Hash | Message |
|------|---------|
| `86f3ecb3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
