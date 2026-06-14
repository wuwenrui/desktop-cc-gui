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
