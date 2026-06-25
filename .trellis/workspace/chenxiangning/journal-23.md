# Journal - chenxiangning (Part 23)

> Continuation from `journal-22.md` (archived at ~2000 lines)
> Started: 2026-06-18

---



## Session 872: 归档 Codex 首响应性能证据变更

**Date**: 2026-06-18
**Task**: 归档 Codex 首响应性能证据变更
**Branch**: `feature/v0.5.11`

### Summary

完成 measure-codex-post-ack-first-delta-latency OpenSpec 收尾：同步 conversation-realtime-client-performance 与 conversation-stream-latency-diagnostics 主 specs，归档 change 到 openspec/changes/archive/2026-06-18-measure-codex-post-ack-first-delta-latency，并验证全量 OpenSpec、rendererDiagnostics 测试与 perf runtime report 测试通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ae1a41d9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 873: 修复流式结束窗口并升级 React

**Date**: 2026-06-18
**Task**: 修复流式结束窗口并升级 React
**Branch**: `feature/v0.5.11`

### Summary

修复 Messages finalizing live markdown window 在 React 19.2 时序下被同帧清理的问题，并将 React/ReactDOM 统一升级到 19.2.7。

### Main Changes

## 本次记录

- 升级 React / ReactDOM 到 19.2.7，@types/react 到 19.2.17，@types/react-dom 到 19.2.3。
- 修复 Messages 在 Codex/Claude 流式结束时 finalizing live markdown surface 过早消失的问题。
- 将 active live assistant id 从 live source 提取，避免 deferred snapshot 慢一帧导致 finalizing frame 丢失。
- 扩展 resolveStreamingPresentationItems，使 active live row 可按同 id 更新覆盖，但禁止同 id 不同 kind/role 误替换 reasoning 行。
- 将 Codex 完整文本可见后的 finalizing 清理改为 320ms 短窗口 timer，避免 render callback 同帧清掉 UI 状态。

## 验证

- npm exec vitest run -- src/features/messages/components/Messages.test.tsx src/features/messages/components/messagesLiveWindow.test.ts src/features/messages/components/Messages.live-behavior.test.tsx src/features/messages/components/Messages.windows-render-mitigation.test.tsx src/features/messages/components/Messages.streaming-presentation.test.tsx src/features/messages/components/Messages.codex-live-streaming.test.tsx src/features/messages/components/Messages.transient-timer-cleanup.test.tsx src/app-shell.startup.test.tsx src/app-shell-parts/useSelectedComposerSession.test.tsx src/app-shell-parts/selectedComposerSession.test.ts
- npm run typecheck
- npm ls react react-dom @types/react @types/react-dom --depth=0

## 隔离说明

- record 前工作区仍有非本次改动：src/services/tauri.ts、openspec/changes/optimize-governance-sentry-noise-and-large-file-split/、src/services/tauri/git.ts、src/services/tauri/workspaceFiles.ts。
- 本次业务 commit 与 session record 均未纳入上述非本次改动。


### Git Commits

| Hash | Message |
|------|---------|
| `2f1ba6d6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 874: 收口：门禁噪音治理、Tauri 拆分与 AppShell 稳定性

**Date**: 2026-06-18
**Task**: 收口：门禁噪音治理、Tauri 拆分与 AppShell 稳定性
**Branch**: `feature/v0.5.11`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| OpenSpec | Added `optimize-governance-sentry-noise-and-large-file-split` proposal/design/tasks/spec deltas for governance sentry optimization and large-file modularization. |
| CI governance | Changed large-file governance so PR/push keeps hard gate only, moves near-threshold watch to advisory schedule/manual flow, and scopes heavy-test-noise log artifact upload to failures. |
| Tauri services | Split `src/services/tauri.ts` by extracting Git service calls and workspace file service calls into domain modules while keeping the public facade. |
| AppShell stability | Stabilized Claude thinking visibility reporting through a ref-backed dedupe gate and added regression coverage for callback identity stability. |

**Validation**:
- `openspec validate optimize-governance-sentry-noise-and-large-file-split --strict --no-interactive`
- `node --test scripts/check-large-files.test.mjs`
- `npm run check:large-files:gate`
- near-threshold watch report mode
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
- `npm run check:heavy-test-noise`
- `npm exec vitest run src/features/layout/hooks/useLayoutNodes.client-ui-visibility.test.tsx src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx src/app-shell.startup.test.tsx`
- `npm run typecheck`
- `npm run lint`
- `git diff --check`

**Commits**:
- `1c4b4a39` docs(openspec): 新增门禁收口变更规范
- `8e68f276` ci(governance): 收敛大文件与重测试告警噪音
- `31c0e5b3` refactor(tauri): 拆分 Git 与工作区文件服务
- `cdc81b8d` fix(app-shell): 稳定 Claude thinking 状态上报


### Git Commits

| Hash | Message |
|------|---------|
| `1c4b4a39` | (see git log) |
| `8e68f276` | (see git log) |
| `31c0e5b3` | (see git log) |
| `cdc81b8d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 875: 修复 Codex 默认配置首轮恢复

**Date**: 2026-06-18
**Task**: 修复 Codex 默认配置首轮恢复
**Branch**: `feature/v0.5.11`

### Summary

修复 codex-tui/default-config 首轮空白 draft 遇到 thread not found 时误入 stale fork/恢复卡的问题。调整前端 Codex send fallback 顺序，使可证明 disposable 的 first-turn draft 在 refresh 无法 rebind 后优先 fresh replay，再进入 stale fork fallback；保留 durable thread 的保守恢复语义。同步将默认 disk provider 文案统一为 codex-tui/default-config，并补充 OpenSpec/Trellis 契约与回归测试。验证通过 lint、typecheck、全量 npm run test、runtime contracts、cargo test --no-run、OpenSpec strict validate。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `44c31fb4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 876: 稳定 Codex 默认配置冷启动首发

**Date**: 2026-06-18
**Task**: 稳定 Codex 默认配置冷启动首发
**Branch**: `feature/v0.5.11`

### Summary

修复 codex-tui/default-config 新客户端冷启动首个 Codex 会话 first prompt 可能因 runtime readiness race 触发 thread not found 恢复卡的问题。后端对 turn/start thread not found 增加 same-runtime thread/resume + short bounded readiness backoff retry；前端对 first-turn empty draft 的 same-id refresh 不再视为 verified rebind，而是 fresh replay 到新 thread。新增 useThreadMessaging 回归测试覆盖 activeThreadId=null 新会话首发、refresh 返回 same missing thread 的场景，并同步 Trellis/OpenSpec 契约。验证通过 focused Vitest、typecheck、OpenSpec strict validate、Rust lib thread_not_found tests；全量 cargo --no-run 当前被非 Codex 文件刷新改动阻塞。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `a84b801e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 877: 修复文件树刷新失效

**Date**: 2026-06-18
**Task**: 修复文件树刷新失效
**Branch**: `feature/v0.5.11`

### Summary

修复文件树手动刷新与文件操作后列表 stale 问题；新增 forceRefresh bridge contract；清理 FileTreePanel lazy subtree cache；文件操作后 optimistic reveal 并后台校准；daemon/desktop mode 透传刷新语义；补充 Vitest/Rust 回归测试；更新 hook-guidelines code-spec。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c5fe7b17` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 878: 修复 tauri wrapper 参数断言

**Date**: 2026-06-18
**Task**: 修复 tauri wrapper 参数断言
**Branch**: `feature/v0.5.11`

### Summary

(Add summary)

### Main Changes

修复 `src/services/tauri.test.ts` 中 startup-heavy wrapper 单测断言与当前 workspace file listing bridge contract 不一致的问题。

主要变更：
- 将 `list_workspace_files` 的 invoke 期望补齐 `forceRefresh: false`。
- 保持生产代码 `src/services/tauri/workspaceFiles.ts` 不变，因为 `.trellis/spec/frontend/hook-guidelines.md` 已规定 initial load / polling 应显式传 `forceRefresh: false` 以保留 listing-budget cache 行为。

验证：
- `npm exec vitest run src/services/tauri.test.ts` 通过，115 tests passed。

注意：
- 本次代码提交只包含 `src/services/tauri.test.ts` 一行测试断言更新。
- 仓库中既有 OpenSpec staged 变更未纳入本次代码提交，保持原工作区状态。


### Git Commits

| Hash | Message |
|------|---------|
| `1613366c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 879: 收口 v0.5.11 消息恢复与性能证据

**Date**: 2026-06-18
**Task**: 收口 v0.5.11 消息恢复与性能证据
**Branch**: `feature/v0.5.11`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|---|---|
| Thread recovery | Extracted Codex stale-thread/fresh-continuation/fork recovery into `useCodexMessageRecovery` and kept `useThreadMessaging` caller contract stable. |
| Streaming dispatch | Added first-token reasoning urgent dispatch predicate and coverage while preserving steady-state batching. |
| Perf evidence | Added `evidenceClassUpgrade` mode, `proxyRatio`, warn-only archive readiness behavior, synthetic-aware ratio denominator, and PR readiness workflow. |
| OpenSpec | Completed `refactor-v0511-thread-messaging-recovery-and-streaming`; split large-file wave3, recovery cookbook, and remaining measured producer work into `follow-up-v0511-large-file-cookbook-and-measured-evidence`. |
| Validation | Ran typecheck, lint, focused Vitest, perf script node tests, perf archive readiness JSON, and strict OpenSpec validation for both current and follow-up changes. |

**Code commit**: `3f3474c0 feat(threads): 收口 v0.5.11 消息恢复与性能证据`

**Follow-up OpenSpec**:
- `openspec/changes/follow-up-v0511-large-file-cookbook-and-measured-evidence/`


### Git Commits

| Hash | Message |
|------|---------|
| `3f3474c0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 880: 拆分 tauri service facade wrapper

**Date**: 2026-06-18
**Task**: 拆分 tauri service facade wrapper
**Branch**: `feature/v0.5.11`

### Summary

按 follow-up v0.5.11 OpenSpec 推进 large-file wave3：将 src/services/tauri.ts 中的 session、permission、app-server wrapper 拆到 src/services/tauri/session.ts、permission.ts、appServer.ts，保留原 facade re-export 兼容旧入口；同步勾选已完成 OpenSpec tasks。验证通过 npm run typecheck、npm run lint、npm exec vitest run src/services/tauri.test.ts、npm run check:large-files、npm run check:runtime-contracts、openspec validate follow-up-v0511-large-file-cookbook-and-measured-evidence --strict --no-interactive。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `9c80e25c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 881: 拆分 FileTreePanel 视图状态

**Date**: 2026-06-18
**Task**: 拆分 FileTreePanel 视图状态
**Branch**: `feature/v0.5.11`

### Summary

继续 follow-up v0.5.11 large-file wave3：从 FileTreePanel.tsx 抽出 useFileTreeViewState.ts 管理文件树 view state、lazy cache、manual refresh reset；新增 FileTreeRefreshControls.tsx 承接加载失败和重试 UI；同步 OpenSpec tasks 5/6。验证通过 npm run typecheck、npm run lint（0 errors，React exhaustive-deps 对 custom hook setters/refs 仍提示 warnings）、FileTreePanel.run/detached focused tests、FileViewPanel focused tests、npm run check:large-files、openspec validate --strict --no-interactive。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `8d1c4705` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 882: 补充 Codex 恢复 cookbook

**Date**: 2026-06-18
**Task**: 补充 Codex 恢复 cookbook
**Branch**: `feature/v0.5.11`

### Summary

继续 follow-up v0.5.11 recovery cookbook：在 .trellis/spec/backend/codex-provider-scoped-runtime.md 增加 Codex stale recovery cookbook，定义 staleRecoveryClassification.reasonCode/staleReason/userAction 语义，补充 recovery failure playbook、GEMINI/CLAUDE provider recovery template，并链接 codex-message-recovery-hook 与 codex-stale-thread-binding-recovery。同步 OpenSpec tasks 8-11。验证通过 openspec validate follow-up-v0511-large-file-cookbook-and-measured-evidence --strict --no-interactive 与 git diff --check。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e97d78ff` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 883: 收口 v0.5.11 性能证据边界

**Date**: 2026-06-18
**Task**: 收口 v0.5.11 性能证据边界
**Branch**: `feature/v0.5.11`

### Summary

为 v0.5.11 runtime evidence measured 行补充 sampleCount/sourceArtifact，为剩余 proxy 行补充 measurementBlocker/requiredSourceArtifact；刷新 perf baseline 与 runtime evidence reports，并完成 OpenSpec tasks 收口。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `d6941daa` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 884: 批量归档 v0.5.11 已验证 OpenSpec 提案

**Date**: 2026-06-18
**Task**: 批量归档 v0.5.11 已验证 OpenSpec 提案
**Branch**: `feature/v0.5.11`

### Summary

批量归档 11 个已完成 v0.5.11 OpenSpec change，按顺序同步 delta specs 到主 specs，更新 openspec/project.md 闭包快照。验证 openspec validate --all --strict --no-interactive 通过，active changes 清零。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c486776c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 885: 修复性能归档门禁

**Date**: 2026-06-18
**Task**: 修复性能归档门禁
**Branch**: `feature/v0.5.11`

### Summary

修复 Perf archive readiness CI 在 GitHub runner 上依赖全局 openspec 导致 exit 3 的问题，并清理 stale archive readiness 报告，使门禁降级为可放行的 advisory warning。

### Main Changes

- 为 `scripts/perf-archive-readiness.mjs` 增加 `openspec/changes` repo-local fallback，避免 CI runner 没有全局 `openspec` 时直接 exit 3。
- 在 workflow 中打印非 0 exit 的 JSON report，提升 CI 可诊断性。
- 增加 node:test 覆盖：无 openspec binary 时 fallback 可用，且 stale completed changes 仍会 hard fail。
- 将 `docs/perf/runtime-evidence-gates.json` 中已归档的 performance changes 从 `completed` 移到 `previousArchiveContext`，同步更新 OpenSpec governance markdown。
- 验证：`node --test scripts/perf-archive-readiness.test.mjs` 通过；`npm run --silent perf:archive-readiness -- --json` 返回 exit 2 / warn / hardFailures=[]，符合 workflow 放行策略。


### Git Commits

| Hash | Message |
|------|---------|
| `e7837d2d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 886: 修复性能归档评论权限

**Date**: 2026-06-19
**Task**: 修复性能归档评论权限
**Branch**: `feature/v0.5.11`

### Summary

修复 Perf archive readiness 在 PR comment 步骤因 fork/read-only token 触发 403 的后续 CI 问题，并升级 github-script 到 Node 24 runtime。

### Main Changes

- 将 `.github/workflows/perf-archive-readiness.yml` 中 `actions/github-script@v7` 升级为 `actions/github-script@v8`，匹配 Node 24 runtime，消除 Node 20 deprecation warning。
- 将 workflow 的 Node 安装版本从 20 调整为 24，避免继续显式使用即将废弃的 Node 20。
- 将 PR 评论步骤改为非阻塞 reporting：始终写入 `$GITHUB_STEP_SUMMARY`，fork PR 直接跳过 comment，comment API 失败时只输出 warning，不再让门禁失败。
- 验证：Ruby YAML parse 通过；`git diff --check -- .github/workflows/perf-archive-readiness.yml` 无输出。


### Git Commits

| Hash | Message |
|------|---------|
| `3a1de15e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 887: 修正运行时提示侧栏入口和弹层

**Date**: 2026-06-19
**Task**: 修正运行时提示侧栏入口和弹层
**Branch**: `feature/v0.5.11`

### Summary

将 runtime notice 入口移动到侧栏底部与设置同层，展开弹窗通过 portal 提层避免裁剪，宽度调整为 560px readable compact，并回写 OpenSpec 变更与测试。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b5ddea13` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 888: 清理文件树 Hook 依赖告警

**Date**: 2026-06-19
**Task**: 清理文件树 Hook 依赖告警
**Branch**: `feature/v0.5.11`

### Summary

补齐 FileTreePanel hooks dependency arrays，并将 toggleFolder 稳定为 useCallback，使 npm run lint 从 34 个 hooks warning 降为 0 warning。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `223e589c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 889: Codex 并行会话生命周期隔离加固

**Date**: 2026-06-20
**Task**: Codex 并行会话生命周期隔离加固
**Branch**: `feature/v0.5.11`

### Summary

加固 Codex 并行会话 owner gating、settled-turn quarantine、幕布 scope guard 与 deferred completion scoped reconciliation；同步记录手工三并行仍复现，change 暂不 archive-ready。

### Main Changes

| Area | Detail |
|------|--------|
| Codex lifecycle | Added explicit/bounded ownership resolver, removed active-tab lifecycle owner fallback, and hardened settled-turn quarantine against late duplicate starts and turnless late events. |
| Deferred completion | Added scoped backend reconciliation for deferred `turn/completed`; terminal same-scope response may flush, running/unknown/mismatch stays blocked. |
| Render scope | Scoped `Messages` deferred render/presentation snapshots by `workspaceId + threadId` to prevent tab-switch curtain bleed. |
| Startup/reducer guards | Added reducer idempotency and model catalog attempt guard to avoid startup restore/update-depth amplification. |
| Docs | Created OpenSpec change `fix-codex-parallel-runtime-ended-isolation` and updated Trellis frontend specs. Marked the change as implementation checkpoint, not archive-ready, because manual 3-session runtime testing still reproduces stuck loading. |

**Validation**:
- `npm test` passed: 681 test files.
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm run check:runtime-contracts` passed.
- `npm run doctor:strict` passed before doc calibration.
- `openspec validate fix-codex-parallel-runtime-ended-isolation --type change --strict --no-interactive` passed.
- `git diff --check` passed.

**Known Open Risk**:
- User manual testing still reproduces one running/loading residue in 3 parallel Codex/Minimax sessions.
- Next fix must first capture `deferred-completion-reconciliation-*`, `three-evidence-reconciliation-*`, `turn-completed-deferred`, and `quarantined-codex-event-skipped` payloads to classify whether terminal authority never arrives, backend status remains running/unknown, or frontend cleanup guard rejects a valid terminal signal.


### Git Commits

| Hash | Message |
|------|---------|
| `ef834bdb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 890: 修复独立文件窗口首屏样式加载

**Date**: 2026-06-20
**Task**: 修复独立文件窗口首屏样式加载
**Branch**: `feature/v0.5.11`

### Summary

修复 detached file explorer 首屏未选择文件时未加载 detached-file-explorer.css 导致 UI 回退到主窗口布局的问题；窗口 root 直接加载 detached shell styles，补充 OpenSpec spec/proposal 回写，并通过 targeted test、typecheck 与 OpenSpec specs strict 校验。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `dd4d7caa` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 891: 修复门禁脚本失败

**Date**: 2026-06-20
**Task**: 修复门禁脚本失败
**Branch**: `feature/v0.5.11`

### Summary

(Add summary)

### Main Changes

| 项目 | 说明 |
|------|------|
| Heavy test noise | 修复 `useThreads.memory-race.integration.test.tsx` 在 batch 142 中因 completion email terminal identity 丢失导致的 timeout。 |
| Large file governance | 将 `useThreadEventHandlers.ts` 的 three-evidence reconciliation 逻辑抽到 `useThreadTurnSettlementReconciliation.ts`，将 `useThreads.ts` 的 runtime ownership helper 抽到 `threadRuntimeOwnershipHelpers.ts`，使 hard gate 低于 2800 行阈值。 |
| Contract | 在 `onTurnTerminalExternal` payload 中保留 `rawTurnId`，业务 settlement 继续用 normalized turn id，completion email intent 使用 raw turn id 识别缺失 terminal identity。 |
| 验证 | `typecheck`、`lint`、`git diff --check`、`check:large-files:gate`、`check:heavy-test-noise`、目标 threads 测试通过。 |

**Code Commit**: `1646ee5a fix(threads): 修复门禁失败与大文件债务`


### Git Commits

| Hash | Message |
|------|---------|
| `1646ee5a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 892: 归档性能证据债务提案

**Date**: 2026-06-20
**Task**: 归档性能证据债务提案
**Branch**: `feature/v0.5.11`

### Summary

完成 OpenSpec change clean-up-perf-archive-readiness-debt：同步 runtime-performance-evidence-gates 主 spec，归档提案，补齐 perf archive-readiness accepted budget/proxy/unsupported debt 元数据，并通过相关测试、lint、typecheck 与 OpenSpec 全量验证。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `53e5e07a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 893: 合入 Claude 供应商排序与模型拉取

**Date**: 2026-06-21
**Task**: 合入 Claude 供应商排序与模型拉取
**Branch**: `feature/v0.5.11`

### Summary

(Add summary)

### Main Changes

目标：检查并合入 PR #705 到 feature/v0.5.11，处理 review blocker，并按 OpenSpec/Trellis 规则完成提交收口。

主要变更：
- 合入 Claude 供应商拖拽排序：新增 sortOrder、vendor_reorder_claude_providers、ProviderList DnD、useProviderManagement 乐观排序与失败回滚。
- 合入 Claude 供应商模型拉取：新增 vendor_fetch_claude_models、Tauri service wrapper、ProviderDialog 拉取按钮、共享 datalist 建议、i18n 与样式。
- 校准默认 Claude provider settings template：顶层 managed settings 不再误放 env，移除 unsafe env defaults。
- 保留 PR 附带 file-tree 滚动容器修复。
- Review 后撤销 AGENTS.md 的 Windows-only pwsh Shell Baseline 回退，最终提交不包含 AGENTS.md 改动。
- 新增 OpenSpec change：add-claude-provider-management-order-and-model-fetch，包含 proposal/design/tasks/spec delta，并通过 strict validate。

验证：
- npm run lint 通过。
- npm run typecheck 通过。
- npm exec -- vitest run src/features/vendors/components/ProviderDialog.test.ts src/features/vendors/components/ProviderDialog.fetch-models.test.tsx src/features/vendors/components/ProviderList.test.tsx src/features/vendors/hooks/useProviderManagement.test.tsx src/services/tauri.test.ts 通过，5 files / 124 tests passed。
- cargo test --manifest-path src-tauri/Cargo.toml vendors::commands::tests:: --quiet 通过，12 tests passed。
- openspec validate add-claude-provider-management-order-and-model-fetch --strict --no-interactive 通过。

后续：
- 手动 QA：拖拽排序持久化、active provider 回位、真实 endpoint 拉取模型、错误 URL/key 提示。
- 手动 QA 通过后可执行 OpenSpec sync/archive。


### Git Commits

| Hash | Message |
|------|---------|
| `31732a32` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 894: 修复超时引导卡片失败状态

**Date**: 2026-06-21
**Task**: 修复超时引导卡片失败状态
**Branch**: `feature/v0.5.11`

### Summary

修复请求输入卡片在 5 分钟超时后 submit/skip/close 失败的问题，补齐 stale settlement 跨层 contract 与回归测试。

### Main Changes

- 新增 RequestUserInputSettlementOptions / RequestUserInputSettlementResult，显式表达 timed-out stale settlement。
- useThreadUserInput 在 timeout hint 下识别 workspace disconnected / timeout / stale / cancelled 等后端失败为 stale cleanup，清理 pending queue，不把失败写成 submitted。
- RequestUserInputMessage 在倒计时归零后的 auto-dismiss、Submit、Skip 中携带 timeout hint，并修复折叠 stale card 后继续 Skip 丢失上下文的问题。
- usePlanApplyHandlers 透传 settlement options；当 settlement 为 stale 时阻断 plan apply / Codex resume 等后续副作用。
- 补充 useThreadUserInput、RequestUserInputMessage、usePlanApplyHandlers 回归测试。
- 新增 OpenSpec change: fix-user-input-stale-submit-settlement。

验证：
- npx vitest run src/features/threads/hooks/useThreadUserInput.test.tsx src/features/app/components/RequestUserInputMessage.test.tsx src/app-shell-parts/usePlanApplyHandlers.test.tsx
- npm run typecheck
- npm run lint
- npm run check:large-files:gate
- node --test scripts/check-large-files.test.mjs
- npm run check:heavy-test-noise
- node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs
- npm run check:large-files:near-threshold
- openspec validate fix-user-input-stale-submit-settlement --strict --no-interactive
- git diff --check


### Git Commits

| Hash | Message |
|------|---------|
| `6d69dd8c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 895: 归档 Claude 供应商与 Codex 并行运行提案

**Date**: 2026-06-21
**Task**: 归档 Claude 供应商与 Codex 并行运行提案
**Branch**: `feature/v0.5.11`

### Summary

核对 Claude provider 管理与 Codex 并行 runtime ended 隔离实现证据，同步 OpenSpec 主规格，并归档两个已完成 change。

### Main Changes

本次完成两个 OpenSpec change 的真实收尾：

- add-claude-provider-management-order-and-model-fetch
- fix-codex-parallel-runtime-ended-isolation

关键动作：
- 核对相关前后端代码、hook、事件归属逻辑和测试文件。
- 补齐主 specs：claude-provider-management、codex-conversation-liveness、codex-provider-scoped-session-launch、conversation-realtime-cpu-stability。
- 对未真实执行的人工验证项保留 caveat，没有伪造完成状态。
- 使用 openspec archive --skip-specs 归档两个 change，因为主 specs 已手动同步。

验证结果：
- npm run typecheck 通过。
- Claude provider focused Vitest：123 tests passed。
- Codex ownership/liveness focused Vitest：97 tests passed。
- Rust vendor tests：12 tests passed。
- openspec validate --all --strict --no-interactive：356 passed, 0 failed。


### Git Commits

| Hash | Message |
|------|---------|
| `351c48b5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 896: 降低瞬态 runtime 恢复提示干扰

**Date**: 2026-06-22
**Task**: 降低瞬态 runtime 恢复提示干扰
**Branch**: `feature/v0.5.12`

### Summary

调整实时对话中 transient managed-runtime cleanup 的恢复提示展示，保留后端 lifecycle 语义与恢复动作，仅降低 UI 干扰。

### Main Changes

本次修复实时对话中 `Runtime 连接已中断` 卡片对 transient cleanup 的误导式展示：

- 新增 OpenSpec change：`soften-transient-runtime-reconnect-card`。
- 在 `runtimeReconnect` hint 增加 UI-only `tone: blocking | transient`。
- 将 `stale_reuse_cleanup` / `internal_replacement` 分类为 transient managed-runtime cleanup。
- `RuntimeReconnectCard` 对 transient 状态显示轻量 “Runtime 正在恢复” 提示。
- `MessagesRows` 只在 blocking reconnect 时隐藏 assistant 原文；transient cleanup 卡片与原文同时保留。
- 未修改后端、`runtime/ended` payload、runtime lifecycle ownership 或 terminal settlement 规则。

验证：
- `npx vitest run src/features/messages/components/runtimeReconnect.test.ts src/features/messages/components/Messages.runtime-reconnect.test.tsx`：30 tests passed。
- `npm run typecheck`：通过。
- `openspec validate soften-transient-runtime-reconnect-card --strict --no-interactive`：通过。


### Git Commits

| Hash | Message |
|------|---------|
| `cdd3a483` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 897: 弱化可恢复 runtime 提示样式

**Date**: 2026-06-22
**Task**: 弱化可恢复 runtime 提示样式
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

| Item | Details |
|------|---------|
| Goal | 将可自动恢复的 transient runtime cleanup 提示从 recovery/error card 弱化为 lightweight notice，避免用户误判为断联失败。 |
| OpenSpec | 回写 `soften-transient-runtime-reconnect-card` proposal / design / spec delta / tasks，明确 transient cleanup 使用轻量 notice、theme tokens、保留交互逻辑。 |
| UI | 更新 `messages.part1.css` 的 `.message-runtime-recovery-card.is-transient`，降低阴影、边框、背景、按钮权重；保留 reconnect / resend 行为。 |
| i18n | 将中英文文案调整为 `Runtime 切换中` / `Runtime switching`，强调后台 cleanup 与自动继续。 |
| Validation | `openspec validate soften-transient-runtime-reconnect-card --strict --no-interactive`; focused Vitest runtime reconnect suites; `npm run typecheck`; `npm run lint -- --quiet`; `npm run check:large-files` all passed. |

**Updated Files**:
- `openspec/changes/soften-transient-runtime-reconnect-card/proposal.md`
- `openspec/changes/soften-transient-runtime-reconnect-card/design.md`
- `openspec/changes/soften-transient-runtime-reconnect-card/specs/conversation-live-message-canvas-rendering/spec.md`
- `openspec/changes/soften-transient-runtime-reconnect-card/tasks.md`
- `src/i18n/locales/en.part1.ts`
- `src/i18n/locales/zh.part1.ts`
- `src/styles/messages.part1.css`


### Git Commits

| Hash | Message |
|------|---------|
| `b5a9d3a8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 898: 收紧 runtime 恢复提示展示

**Date**: 2026-06-22
**Task**: 收紧 runtime 恢复提示展示
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

本次继续处理 `soften-transient-runtime-reconnect-card`。

- 收紧 `RuntimeReconnectCard` 展示范围：只在最新 assistant message 本身是 runtime reconnect diagnostic 时显示卡片。
- 当后续已经有新的正常 assistant 输出时，旧 `[RUNTIME_ENDED]` / reconnect diagnostic 不再显示卡片，也不再作为普通 assistant 文本残留。
- 保留用户追问后的恢复入口：如果 diagnostic 后面只有 user follow-up，没有新的 assistant 输出，卡片仍保持 active。
- 继续保持 backend runtime lifecycle、recover/resend/fork handler 不变，只调整 message canvas UI 展示。
- 同步 OpenSpec proposal/design/spec/tasks，记录 active diagnostic scope 和 stale diagnostic hide 规则。

验证：
- `openspec validate soften-transient-runtime-reconnect-card --strict --no-interactive`
- `npx vitest run src/features/messages/components/runtimeReconnect.test.ts src/features/messages/components/Messages.runtime-reconnect.test.tsx`
- `npm run typecheck`
- `npm run lint -- --quiet`
- `npm run check:large-files`
- `git diff --check`


### Git Commits

| Hash | Message |
|------|---------|
| `0dace55e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 899: 修复 Codex conversation not found 会话恢复

**Date**: 2026-06-22
**Task**: 修复 Codex conversation not found 会话恢复
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

本次修复 GitHub issue #711 对应的 Codex 旧对话恢复问题：runtime 返回 `conversation not found` / `conversation_not_found` 时，前端和 Rust 侧原本只按普通失败处理，没有进入 stale thread binding recovery。

改动内容：
- 前端 `stabilityDiagnostics` 将 `conversation not found` 归类为可恢复 stale binding，并保持 `staleReason=thread-not-found`。
- `useThreadActions.helpers` 同步补齐相同错误形态，避免恢复提示/手动恢复链路与发送链路漂移。
- Rust `codex_core` 的 `turn/start` retry classifier 同步识别 `conversation not found` / `conversation_not_found`，保持 same-runtime `thread/resume` + bounded retry 策略。
- 增加 Vitest 与 Rust classifier 回归测试，覆盖 issue 报错形态。

验证：
- `npm exec vitest run src/features/threads/utils/stabilityDiagnostics.test.ts src/features/threads/hooks/useThreadMessaging.test.tsx`
- `cargo test --manifest-path src-tauri/Cargo.toml thread_not_found_classifier -- --nocapture`
- `npm run typecheck`
- `cargo test --manifest-path src-tauri/Cargo.toml --no-run`
- `npm run lint`


### Git Commits

| Hash | Message |
|------|---------|
| `9ed9e648` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 900: 优化 release Rust 编译缓存

**Date**: 2026-06-22
**Task**: 优化 release Rust 编译缓存
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

| Area | Details |
|------|---------|
| CI release cache | Updated `.github/workflows/release.yml` to add stable `swatinem/rust-cache` `shared-key` values and `cache-on-failure: true` for macOS arm64, macOS x86_64, Linux x64, and Windows x64 release jobs. |
| sccache activation | Added `Configure sccache environment` steps that write `RUSTC_WRAPPER=sccache`, `SCCACHE_GHA_ENABLED=true`, and platform-specific `SCCACHE_DIR` into `$GITHUB_ENV`, then install `mozilla-actions/sccache-action@v0.0.10` so the real Tauri build step inherits the wrapper. |
| OpenSpec | Added change `2026-06-22-release-pipeline-cache-sccache` with proposal, design, tasks, and `release-pipeline-ci-cache-perf` spec delta. Documented the root problem as slow `workflow_dispatch` release packaging, especially macOS x86_64 run `27905632604`, and captured live verification requirements for future GitHub Actions runs. |
| Verification | Ran `openspec validate 2026-06-22-release-pipeline-cache-sccache --strict --no-interactive`, YAML parse for `.github/workflows/release.yml`, and `npm run typecheck`. Locally attempted macOS x86_64 Tauri build on Apple Silicon; frontend build and Rust x86_64 compilation started with sccache stats, but full local package was blocked by OpenSSL cross-compilation (`HOST=aarch64-apple-darwin`, `TARGET=x86_64-apple-darwin`), which does not represent the real Intel GitHub runner. |

**Follow-up**:
- Trigger a real `workflow_dispatch` release run and check cache hit logs, `sccache --show-stats`, artifact upload, and platform wall-clock values.
- Keep OpenSpec archive pending until live GitHub Actions verification passes.


### Git Commits

| Hash | Message |
|------|---------|
| `11b64eb5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 901: Mermaid 图表全屏查看

**Date**: 2026-06-22
**Task**: Mermaid 图表全屏查看
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 功能 | 为消息侧 `MermaidBlock` 与文件预览侧 `FileMarkdownMermaidBlock` 增加 icon-only 全屏入口。 |
| Viewer | 新增共享 `src/features/markdown/mermaidFullscreen/`，使用 `viewerjs@^1.11.7`、单例 active viewer、显式 `viewer.show()`、StrictMode / panel-lock / theme mutation 防御。 |
| 主题 | 新增 `src/styles/mermaid-fullscreen.css`，按 dark / light / dim 分别适配 backdrop、toolbar、close button 与 viewerjs sprite icon filter。 |
| 测试 | 新增 messages/files/viewer-show/theme 回归测试，目标 vitest 23/23 通过。 |
| OpenSpec | 新增 `openspec/changes/2026-06-22-add-mermaid-block-fullscreen-viewer/` proposal/design/tasks/spec delta，阶段性提交保留 archive gate 未执行。 |

验证已跑：
- `npm run lint`
- `npm run typecheck`
- `npx vitest run src/features/messages/components/MermaidBlock.fullscreen.test.tsx src/features/messages/components/MermaidBlock.viewer-show.test.tsx src/features/files/components/FileMarkdownPreview.mermaid-fullscreen.test.tsx src/styles/mermaid-fullscreen.theme.test.ts`
- `npx openspec validate 2026-06-22-add-mermaid-block-fullscreen-viewer --strict --no-interactive`
- `npm run check:large-files`
- `npm run build`
- `npm run check:bundle-chunking`


### Git Commits

| Hash | Message |
|------|---------|
| `4c38fa13` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 902: Markdown 图片全屏与消息目录

**Date**: 2026-06-22
**Task**: Markdown 图片全屏与消息目录
**Branch**: `feature/v0.5.12`

### Summary

完成并归档 OpenSpec change add-image-fullscreen-and-messages-outline：新增 Markdown 图片全屏 viewer、消息 outline 浮窗、文件预览本地相对图片兼容修复；同步主 specs，补充 focused tests，并通过 typecheck、lint、OpenSpec specs validate、large-file check 与 54 个 focused vitest 用例。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `12f99419` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 903: 修复 CI 品牌检查与文件面板测试抖动

**Date**: 2026-06-22
**Task**: 修复 CI 品牌检查与文件面板测试抖动
**Branch**: `feature/v0.5.12`

### Summary

修复 doctor:win branding gate 与 FileViewPanel typing latency flaky timeout

### Main Changes

本次只提交 CI 修复相关的 3 个文件：
- src/features/markdown/mermaidFullscreen/activeViewer.ts：移除 shipping surface 注释中的 legacy brand 命中词。
- src/styles/mermaid-fullscreen.css：移除 shipping surface 注释中的 legacy brand 命中词。
- src/features/files/components/FileViewPanel.typing-latency.test.tsx：将 active code anchor debounce 测试从真实 setTimeout/waitFor 改为在初始 render 后使用 fake timers 精确推进，避免 CI 批量调度下 5s timeout。

验证：
- npm run check:branding：通过。
- npx vitest run src/features/files/components/FileViewPanel.typing-latency.test.tsx --reporter verbose：通过。
- npx vitest run src/features/files/components/FileViewPanel.test.tsx src/features/files/components/FileViewPanel.typing-latency.test.tsx src/features/files/components/FileViewPanel.lazy-race.test.tsx src/features/files/contracts/fileInteractionEvidenceGate.test.ts --reporter verbose：通过。
- npm run doctor:win：通过。
- npm run test 跑到历史失败点 batch 59 已通过；后续在 batch 78 暴露既有 markdown fast renderer profile 测试契约漂移，未纳入本次提交。

边界：未处理、未提交工作区中已有的 markdown performance 相关改动和 openspec/changes/improve-markdown-render-performance/。


### Git Commits

| Hash | Message |
|------|---------|
| `ea2e348c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 904: 收口 Markdown 渲染性能优化提案

**Date**: 2026-06-22
**Task**: 收口 Markdown 渲染性能优化提案
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

## Summary
- Archived OpenSpec change `improve-markdown-render-performance` into `openspec/changes/archive/2026-06-22-improve-markdown-render-performance/`.
- Synced 11 Markdown performance requirements into main OpenSpec specs.
- Implemented large Markdown low-cost renderer selection, bounded fast preview diagnostics, source-line annotation overlay behavior, bounded outline reveal, rich preview placement cache, and message Markdown streaming guardrails.
- Added synthetic long Markdown fixtures and focused regression coverage for fast renderer profile selection, bounded compile behavior, annotation overlay stability, rich outline compile reuse, and streaming outline throttling.

## Verification
- `openspec validate --all --strict --no-interactive`
- `npm run typecheck`
- `npm run lint`
- `npm run check:large-files`
- `git diff --check`
- `npx vitest run src/features/files/components/FileMarkdownPreview.test.tsx src/features/files/components/__tests__/FileMarkdownPreviewFast.test.tsx src/features/markdown/fastMarkdownRenderer/__tests__/resolveProfile.test.ts src/features/markdown/fastMarkdownRenderer/__tests__/compile.test.ts src/features/markdown/messageMarkdownPrecompute.test.ts src/features/messages/components/Markdown.lazy-runtime.test.ts src/features/messages/components/Markdown.outline-streaming.test.tsx src/features/messages/utils/messageOutlineExtractor.test.ts src/features/messages/components/Messages.codex-live-streaming.test.tsx`

## Notes
- User manually verified the Markdown preview flow after implementation and reported no functional regression / no worse perceived performance.
- Remaining separate follow-up: investigate dev-mode app-wide lag when installed client and dev client are open simultaneously; current evidence points to dev/prod runtime state sharing and duplicate engine/runtime pressure rather than Markdown rendering alone.


### Git Commits

| Hash | Message |
|------|---------|
| `4f231fbd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 905: 归档 Mermaid 全屏 viewer OpenSpec

**Date**: 2026-06-22
**Task**: 归档 Mermaid 全屏 viewer OpenSpec
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| Change | `2026-06-22-add-mermaid-block-fullscreen-viewer` |
| 本次工作 | 审计剩余任务后确认仅剩 OpenSpec archive gate，完成 main spec 同步并将 change 移入 archive。 |
| 关键处理 | 当前 `openspec` CLI 拒绝以数字开头的 change id，无法直接执行 `openspec archive 2026-...`；采用等价手工 archive：同步 `markdown-mermaid-block-fullscreen-viewer` main spec、移动 change 目录、更新 tasks 勾选状态。 |
| 验证 | `openspec validate --specs --strict --no-interactive` 通过，357 passed / 0 failed。 |

**Updated Files**:
- `openspec/specs/markdown-mermaid-block-fullscreen-viewer/spec.md`
- `openspec/changes/archive/2026-06-22-add-mermaid-block-fullscreen-viewer/**`


### Git Commits

| Hash | Message |
|------|---------|
| `18e0ae99` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 906: 修复 Codex provider 恢复绑定

**Date**: 2026-06-22
**Task**: 修复 Codex provider 恢复绑定
**Branch**: `feature/v0.5.12`

### Summary

修复 Codex stale thread recovery 在 provider-scoped 会话下丢失 provider binding 的问题；补 canonical backend lookup、frontend provider inheritance、AppShell 稳定 resolver 防 update loop，并清理 focused heavy-test-noise act warning。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `db554da4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 907: 修复 Messages Vitest OOM 与 branding gate

**Date**: 2026-06-22
**Task**: 修复 Messages Vitest OOM 与 branding gate
**Branch**: `feature/v0.5.12`

### Summary

拆分 Messages live streaming 测试，避免 full Markdown runtime 在批量 Vitest 中触发 OOM；清理 file markdown feature flag 中的 mossx disable key，恢复 doctor:win branding gate。

### Main Changes

- 将 Messages.test.tsx 中的 live streaming / finalizing / selection freeze / rapid reasoning contract 测试迁移到 Messages.live-markdown-streaming.test.tsx，并 mock Markdown renderer，保留 Messages 层行为断言。
- 删除 Messages.test.tsx 中重复覆盖且成本过高的 live inline code throttle 集成测试；该行为由 Markdown.file-links.test.tsx、Markdown streaming throttle 测试与 MessagesRows.stream-mitigation.test.tsx 分层覆盖。
- 移除 src/features/files/utils/fileMarkdownFeatureFlags.ts 中的 mossx.fileMarkdownDisableLargeFastHtml legacy storage read，保留 ccgui key。
- 验证：doctor:win、typecheck、lint --quiet、Messages 失败批次附近组合测试、Messages live markdown streaming、MessagesRows stream mitigation、Markdown file links 均通过。


### Git Commits

| Hash | Message |
|------|---------|
| `39bdbb13` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 908: 移除首页最近会话入口

**Date**: 2026-06-22
**Task**: 移除首页最近会话入口
**Branch**: `feature/v0.5.12`

### Summary

删除 HomeChat 首页最近会话展示区，回写 workspace-home-shadcn-ux OpenSpec 主规范，并验证 focused HomeChat tests、typecheck、lint、large-file 与 OpenSpec strict validation。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `118e4eb7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 909: 修复供应商模型目录与 Codex 刷新断联

**Date**: 2026-06-22
**Task**: 修复供应商模型目录与 Codex 刷新断联
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 问题 | Codex 模型选择器刷新会触发 runtime reload，导致运行中的 Codex 会话出现 `settings_restart` 断联；grouped selector 使用 active engine models 导致 Codex/Claude 自定义模型在非当前 provider 下不可见。 |
| 修复 | 将 Codex selector refresh 改为 catalog-only；移除 provider switch 的隐式 runtime reload；新增 provider-scoped model catalog 传递链路；Codex provider `customModels` additive merge 到 composer-visible custom model store。 |
| 验证 | `npm run lint`、`npm run typecheck`、focused Vitest 15 tests passed、`openspec validate --changes fix-provider-model-catalog-and-codex-refresh-isolation --strict --no-interactive` 通过。 |
| Commit | `657d1351 fix(composer): 修复供应商模型目录与 Codex 刷新断联` |


### Git Commits

| Hash | Message |
|------|---------|
| `657d1351` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 910: 修复 Mermaid 全屏测试竞态

**Date**: 2026-06-22
**Task**: 修复 Mermaid 全屏测试竞态
**Branch**: `feature/v0.5.12`

### Summary

定位 MermaidBlock fullscreen 测试偶发 timeout 根因：测试在按钮存在但仍 disabled 时点击，click 被忽略后等待 portal 超过 testTimeout。新增 waitForEnabledFullscreenButton 辅助函数，统一等待按钮存在且可用后再点击；验证目标批次、全量 test、typecheck、lint 与 heavy-test-noise 均通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4cc6389e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 911: 稳定流式对话目录渲染

**Date**: 2026-06-22
**Task**: 稳定流式对话目录渲染
**Branch**: `feature/v0.5.12`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 背景 | 近期 messages outline floater 接入 live assistant Markdown 后，流式对话体感出现顿挫风险。|
| 根因 | `MessagesTimeline` 为 live row 反复创建 `onOutlineReady` callback，`Markdown` effect 会因 callback identity 变化重复扫描相同 `throttledValue`；同时等价 outline payload 仍会提交新 state object。|
| 修复 | 为 live assistant outline 建立 stable callback adapter；新增 `messagesOutlineState` helper，对同 message + 同 outline entries 返回 previous snapshot reference；`Markdown` 对最近的 visible source 做 one-entry outline extraction cache。|
| 文档 | 新增 OpenSpec change `fix-message-outline-streaming-jank`，并补充 `.trellis/spec/frontend/messages-streaming-render-contract.md`，明确 outline / TOC 属于 auxiliary navigation state，不得反向驱动 live render hot path。|
| 验证 | 通过 focused Vitest、`npm run typecheck`、`npm run lint`、`openspec validate fix-message-outline-streaming-jank --strict --no-interactive`。|

**Updated Files**:
- `.trellis/spec/frontend/messages-streaming-render-contract.md`
- `openspec/changes/fix-message-outline-streaming-jank/proposal.md`
- `openspec/changes/fix-message-outline-streaming-jank/design.md`
- `openspec/changes/fix-message-outline-streaming-jank/tasks.md`
- `openspec/changes/fix-message-outline-streaming-jank/specs/message-markdown-streaming-compatibility/spec.md`
- `openspec/changes/fix-message-outline-streaming-jank/specs/messages-outline-floater/spec.md`
- `src/features/messages/components/Markdown.tsx`
- `src/features/messages/components/MessagesTimeline.tsx`
- `src/features/messages/components/messagesOutlineState.ts`
- `src/features/messages/components/Markdown.outline-streaming.test.tsx`
- `src/features/messages/components/messagesOutlineState.test.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `17ffb6b5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
