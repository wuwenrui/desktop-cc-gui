# Journal - chenxiangning (Part 21)

> Continuation from `journal-20.md` (archived at ~2000 lines)
> Started: 2026-06-10

---



## Session 783: 补充 Codex 供应商面板背景验收

**Date**: 2026-06-10
**Task**: 补充 Codex 供应商面板背景验收
**Branch**: `feature/v0.5.8`

### Summary

将 Codex 新建会话 provider selector 二级浮层背景不透底要求回写到旧 OpenSpec 提案，并完成 strict validate。

### Main Changes

- 更新 `openspec/changes/add-codex-provider-scoped-session-launch/proposal.md`，补充 provider selector 二级浮层必须使用与一级 workspace menu 对齐的实底背景，避免底层会话文字、代码 diff 或日志文本透出造成文字重叠。
- 在验收标准中加入 provider selector 背景不透明要求。
- 在测试影响中加入 frontend provider selector visual smoke / CSS review 验证点。
- 验证：`openspec validate add-codex-provider-scoped-session-launch --strict --no-interactive` 通过。


### Git Commits

| Hash | Message |
|------|---------|
| `9b8b17d9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 784: 归档已验证 OpenSpec 提案批次

**Date**: 2026-06-10
**Task**: 归档已验证 OpenSpec 提案批次
**Branch**: `feature/v0.5.8`

### Summary

批量归档 7 个已验证 OpenSpec change，同步主 capability specs，并刷新 OpenSpec workspace 快照。

### Main Changes

- Archived and synced 7 verified OpenSpec changes:
  - `extend-client-font-size-coverage`
  - `add-semantic-diff-review`
  - `deepen-semantic-diff-review`
  - `harden-live-message-canvas-rendering`
  - `polish-project-map-files-api-mvp`
  - `refine-project-map-api-contract-detail-view`
  - `harden-file-markdown-preview-rendering`
- Updated main specs including `client-global-ui-scaling`, `file-tree-visual-consistency`, `git-panel-diff-view`, `conversation-live-message-canvas-rendering`, Project Map relationship/API specs, and Markdown preview specs.
- Updated `openspec/project.md` to reflect tracked active=5, archive=451, specs=320, and documented the remaining all-validate blocker.
- Validation:
  - `openspec validate --specs --strict --no-interactive` passed for 320 specs.
  - `openspec validate --all --strict --no-interactive` remains blocked by pre-existing active change `harden-realtime-composer-status-panel-performance` missing spec deltas.
- Left untracked and intentionally excluded: `.trellis/tasks/06-10-client-module-integration-plan/`, `openspec/changes/unify-client-workflow-runtime-model/`.


### Git Commits

| Hash | Message |
|------|---------|
| `8615451e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 785: 提示词增强支持手动配置模型

**Date**: 2026-06-10
**Task**: 提示词增强支持手动配置模型
**Branch**: `feature/v0.5.8`

### Summary

增强提示词窗体改为用户主动运行，并支持按次选择供应商、模型和超时时间。

### Main Changes

| Area | Details |
|------|---------|
| OpenSpec | Added `add-prompt-enhancer-manual-provider-timeout` proposal/design/tasks/spec for Composer prompt enhancer manual-run behavior. |
| Composer UI | Prompt enhancer dialog now shows provider, model, timeout, and an explicit start action before runtime execution. |
| Hook behavior | `usePromptEnhancer` now separates dialog opening from enhancement execution, applies selected engine/model/timeout, and preserves stale-request invalidation. |
| Tests | Focused hook suite passed: `pnpm vitest run src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.test.tsx` → 1 file / 7 tests passed. |

**Updated Files**:
- `openspec/changes/add-prompt-enhancer-manual-provider-timeout/**`
- `src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.ts`
- `src/features/composer/components/ChatInputBox/PromptEnhancerDialog.tsx`
- `src/features/composer/components/ChatInputBox/ChatInputBoxFooter.tsx`
- `src/features/composer/components/ChatInputBox/ChatInputBox.tsx`
- `src/features/composer/components/ChatInputBox/styles/enhance-prompt.css`
- `src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.test.tsx`
- `src/i18n/locales/zh.part6.ts`
- `src/i18n/locales/en.part6.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `5bb5b56f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 786: 收口客户端运行态 P0

**Date**: 2026-06-10
**Task**: 收口客户端运行态 P0
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| HomeChat | Replanned New Home as creation-first, removed workspace run dashboard/cockpit, artifacts, and Task Center entrypoints. |
| Runtime visibility | Moved P0 user-visible runtime hints to contextual surfaces: Sidebar session badges, Conversation linked-run indicator, and shared RunDetailSurface. |
| Task module deferral | Hid Project Map / Orchestration task entrypoints while preserving internal Task Center and task code for later redesign. |
| Evidence/detail | Kept TaskRun as execution truth and RunDetailSurface as shared explanation surface for status, diagnostics, artifacts, evidence, and linked conversation. |
| OpenSpec | Recalibrated unify-client-workflow-runtime-model proposal, design, tasks, and delta spec to match the HomeChat replanning and defer AppShell/useThreads deep refactor. |
| Validation | OpenSpec validate passed; focused tests passed: 5 files, 111 tests; typecheck passed; lint passed with one existing warning. |

**Validation commands executed**:
- `openspec validate unify-client-workflow-runtime-model --strict --no-interactive`
- `pnpm vitest run src/features/home/components/HomeChat.test.tsx src/features/tasks/components/RunDetailSurface.test.tsx src/features/messages/components/Messages.test.tsx src/features/tasks/components/TaskCenterView.test.tsx src/features/project-map/components/ProjectMapPanel.test.tsx`
- `npm run typecheck`
- `npm run lint`

**Notes**:
- Deferred AppShell orchestration split, useThreads runtime split, and core @ts-nocheck removal to a separate architecture proposal.
- No backend command or storage migration was added.


### Git Commits

| Hash | Message |
|------|---------|
| `91cf4440` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 787: 稳定 Project Map 批量候选确认测试

**Date**: 2026-06-10
**Task**: 稳定 Project Map 批量候选确认测试
**Branch**: `feature/v0.5.8`

### Summary

修复 ProjectMapPanel 批量确认候选测试在慢速 CI 环境中因全局 DOM waitFor 轮询导致的超时风险。

### Main Changes

| Area | Description |
|------|-------------|
| Project Map test | 将批量确认候选用例改为 `act` flush async click 后直接断言 mock 调用和结果消息。 |
| CI stability | 移除对大 DOM 的重复 `waitFor + screen.getByText` 轮询，降低 Windows batch timeout 风险。 |

**Updated Files**:
- `src/features/project-map/components/ProjectMapPanel.test.tsx`

**Validation**:
- `npm run typecheck`
- `npx vitest run src/features/project-map/components/ProjectMapPanel.test.tsx -t "accepts all current candidates from the toolbar" --reporter verbose`
- `npx vitest run src/features/project-map/components/ProjectMapPanel.test.tsx --reporter verbose`
- `npx eslint src/features/project-map/components/ProjectMapPanel.test.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `cf159107` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 788: 修复追加上下文用户气泡列宽

**Date**: 2026-06-10
**Task**: 修复追加上下文用户气泡列宽
**Branch**: `feature/v0.5.8`

### Summary

修复消息幕布中用户消息带便签、记忆、浏览器等追加上下文时的气泡列宽参照不一致问题。普通用户气泡与 context stack 共用同一右侧列宽变量，追加卡片限制在共享列内，并补充 CSS contract test。验证通过目标 Vitest、typecheck、lint、large-file gate。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `11eb5b27` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 789: 拆分 AppShell 运行态编排边界

**Date**: 2026-06-10
**Task**: 拆分 AppShell 运行态编排边界
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| AppShell boundary | Completed split-app-shell-runtime-boundaries OpenSpec implementation and committed the architecture safety-door refactor. |
| Action contracts | Added typed runtime/task-run/navigation/context AppShell action boundary factories with focused tests. |
| Thread runtime | Extracted session lifecycle and message runtime controllers behind existing compatibility facades. |
| Type safety | Removed @ts-nocheck from app-shell.tsx, renderAppShell.tsx, and useAppShellSections.ts through typed context seams. |
| Validation | Passed OpenSpec strict validation, focused Vitest suites, npm run typecheck, and npm run lint with only an existing warning. |
| Trellis | Archived the completed split AppShell runtime boundaries task. |


### Git Commits

| Hash | Message |
|------|---------|
| `6837f5a5` | (see git log) |
| `09126ce7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 790: 添加 v0.5.8 changelog

**Date**: 2026-06-10
**Task**: 添加 v0.5.8 changelog
**Branch**: `feature/v0.5.8`

### Summary

基于 v0.5.7..HEAD 的 git log 汇总新增 CHANGELOG.md v0.5.8 中英文 release note，并单独提交 changelog 文件。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1bd88ff5` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 791: Review 两日提交并修复跨平台边界

**Date**: 2026-06-10
**Task**: Review 两日提交并修复跨平台边界
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Runtime boundary | Fixed UTF-8 unsafe byte slicing in fallback failure summary and added multibyte regression coverage. |
| Provider profile | Hardened managed provider id validation for Windows-invalid path segments and added regression coverage. |
| Frontend lint | Removed stale prompt enhancer callback dependency after review validation. |

**Validation**:
- `npm run check:large-files:near-threshold`
- `npm run check:large-files:gate`
- `node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
- `pnpm vitest run src/features/composer/components/ChatInputBox/hooks/usePromptEnhancer.test.tsx src/features/git/utils/semanticDiffSummary.test.ts src/app-shell-parts/appShellActionBoundaries.test.ts`
- `npm run lint`
- `npm run typecheck`
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml provider_profile::tests`
- `cargo test --manifest-path src-tauri/Cargo.toml fallback_failure_summary_truncates_multibyte_text_without_panicking`


### Git Commits

| Hash | Message |
|------|---------|
| `011247f7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 792: Fix Windows titlebar controls overlap

**Date**: 2026-06-10
**Task**: Fix Windows titlebar controls overlap
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| OpenSpec | Added `fix-windows-titlebar-controls-overlap` proposal/design/tasks/spec delta/verification for Windows titlebar safe-zone behavior. |
| Frontend CSS | Added shared titlebar window-control width and gap variables, then offset Windows layout-swapped floating sidebar restore control away from the window controls. |
| Tests | Added CSS contract coverage and Windows `TitlebarExpandControls` rendering coverage for distinct window controls and floating sidebar restore groups. |
| Validation | Passed focused Vitest, OpenSpec strict validation, typecheck, lint, and large-file gate. |

**Code Commit**: `997596d4 fix(titlebar): 避让 Windows 窗口控制区`

**Validation Commands**:
- `npx vitest run src/styles/layout-swapped-platform-guard.test.ts src/features/layout/components/SidebarToggleControls.test.tsx`
- `openspec validate fix-windows-titlebar-controls-overlap --strict --no-interactive`
- `npm run typecheck`
- `npm run lint`
- `npm run check:large-files`

**Notes**:
- Left unrelated `src/styles/project-map.api-contract.css` change unstaged.
- Windows visual confirmation is still recommended on an actual Windows runtime.


### Git Commits

| Hash | Message |
|------|---------|
| `997596d4` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 793: 修复接口探索面板高度

**Date**: 2026-06-10
**Task**: 修复接口探索面板高度
**Branch**: `feature/v0.5.8`

### Summary

修复 Project Map API Explorer 面板局部高度不随 focused 面板伸展的问题。将 API workspace、dashboard 和三列 grid 改为可继承剩余高度，并移除 rail/inspector 固定 590px 截断，避免底部出现大块空白。验证：check:large-files、lint、typecheck 通过；全量 test 在 121/159 批次因 realtimeBoundaryGuard 批量运行 5s 超时中断，单独重跑该 guard 通过。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `7b649ea6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 794: 修复长会话锚点跳转失效

**Date**: 2026-06-10
**Task**: 修复长会话锚点跳转失效
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

## Task
修复消息幕布在长会话/虚拟化场景下，左侧锚点和右侧“跳到消息”点击后无法跳转的问题。

## Changes
- `src/features/messages/components/Messages.tsx`: 统一锚点跳转入口，目标节点不存在时进入 pending jump，并在会话头切换时清理 pending 状态。
- `src/features/messages/components/MessagesTimeline.tsx`: 当 pending jump 命中虚拟化未挂载行时，按 projection row index 调用 `virtualizer.scrollToIndex(..., { align: "center" })`，待目标节点挂载后交回父层做精确滚动。
- `src/features/messages/components/messagesTimelineProjection.ts`: 新增 `findTimelineProjectionRowIndexByItemId`，用于 message id 定位 projection row。
- 新增 `Messages.virtualized-jump.test.tsx`，覆盖长会话虚拟化下跳到未挂载消息时必须驱动 virtualizer 的回归场景。

## Validation
- `npx vitest run src/features/messages/components/messagesTimelineProjection.test.ts src/features/messages/components/Messages.live-behavior.test.tsx src/features/messages/components/Messages.virtualized-jump.test.tsx`
- `npx eslint src/features/messages/components/Messages.tsx src/features/messages/components/MessagesTimeline.tsx src/features/messages/components/messagesTimelineProjection.ts src/features/messages/components/messagesTimelineProjection.test.ts src/features/messages/components/Messages.virtualized-jump.test.tsx --ext .ts,.tsx`
- `npm run typecheck`
- `git diff --check`

## Notes
- 未提交用户已有样式改动：`src/styles/session-activity.css`、`src/styles/sidebar.css`。


### Git Commits

| Hash | Message |
|------|---------|
| `fed155e8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 795: 调整运行中状态浅色配色

**Date**: 2026-06-10
**Task**: 调整运行中状态浅色配色
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

## Summary
- 将左侧会话列表 processing/running 状态从橙色切换为蓝色系，提高浅色主题下的可读性。
- 同步调整 Session Activity running chip 的暗色/浅色主题配色，保持不同面板的运行态视觉一致。

## Changed Files
- `src/styles/sidebar.css`
- `src/styles/session-activity.css`

## Validation
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run check:large-files`


### Git Commits

| Hash | Message |
|------|---------|
| `a3b3f8c6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 796: 修复浏览器快照浅色主题可读性

**Date**: 2026-06-10
**Task**: 修复浏览器快照浅色主题可读性
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|---|---|
| 代码提交 | `b262d353 fix(browser-context): 提升浅色主题快照卡可读性` |
| OpenSpec | 新增 `openspec/changes/fix-browser-context-light-theme-contrast/`，包含 proposal/tasks/verification/spec delta |
| 前端修复 | Composer 浏览器快照卡和消息摘要卡恢复 `expired/degraded/unsupported` 独立状态 class 与 i18n label |
| 样式修复 | 提升浅色主题、Windows WebView2 system-light 和显式 light theme 下的卡片文字、chip、操作按钮、状态 badge 对比度 |
| 状态保真 | `BrowserContextSummaryCard` 保留 `observation`，避免历史摘要丢失 expired 状态 |
| 测试 | 增加 expired 状态回归测试，覆盖 preview card 和 summary card 的 `is-expired` class |
| 验证 | `npx vitest run src/features/browser-agent/components/BrowserContextPreview.test.tsx src/features/browser-agent/components/BrowserContextSummaryCard.test.tsx`; `npm run typecheck`; `npm run lint`; `npm run check:large-files`; `git diff --check`; `openspec validate fix-browser-context-light-theme-contrast --strict --no-interactive` 全部通过 |
| 平台备注 | 当前环境非 Windows，仍建议在 Windows WebView2 浅色主题下做一次视觉确认 |


### Git Commits

| Hash | Message |
|------|---------|
| `b262d353` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 797: 修复消息 Fork 改写工作区

**Date**: 2026-06-10
**Task**: 修复消息 Fork 改写工作区
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Root cause | Message-tail Fork reused rewind flow without explicit mode, so missing mode defaulted to `messages-and-files` and could run workspace restore. |
| Fix | `onForkFromMessage` now passes `mode: "messages-only"` to `forkSessionFromMessageForWorkspace`, making message Fork a session-only operation. |
| Spec | Added OpenSpec change `fix-message-fork-workspace-mutation` documenting that message-tail Fork must not restore, delete, revert, or overwrite workspace files. |
| Test | Extended adapter contract coverage to assert the message Fork path includes `mode: "messages-only"`. |
| Verification | Ran targeted Vitest, OpenSpec strict validate, typecheck, lint, large-file check, and `git diff --check`; all passed. |


### Git Commits

| Hash | Message |
|------|---------|
| `88d6d494` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 798: 补充消息 Fork 文件保护回归测试

**Date**: 2026-06-10
**Task**: 补充消息 Fork 文件保护回归测试
**Branch**: `feature/v0.5.8`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Test | Strengthened `useThreadActions.codex-rewind.test.tsx` so `messages-only` message fork asserts no workspace file read, delete, or write occurs. |
| Spec record | Updated `fix-message-fork-workspace-mutation` verification record to include the runtime regression test command. |
| Verification | Ran related Vitest files, OpenSpec strict validate, typecheck, lint, large-file check, and `git diff --check`; all passed. |


### Git Commits

| Hash | Message |
|------|---------|
| `5e155324` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 799: 归档已验证 OpenSpec 提案

**Date**: 2026-06-10
**Task**: 归档已验证 OpenSpec 提案
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

完成 OpenSpec 已验证提案归档提交。

主要变更：
- 归档 8 个已完成 change：add-codex-provider-scoped-session-launch、add-prompt-enhancer-manual-provider-timeout、harden-codex-provider-session-catalog-recovery、fix-message-fork-workspace-mutation、fix-browser-context-light-theme-contrast、fix-windows-titlebar-controls-overlap、split-app-shell-runtime-boundaries、unify-client-workflow-runtime-model。
- 同步 main specs，新增 app-shell-runtime-boundaries、client-workflow-runtime-model、codex-provider-scoped-session-launch、composer-prompt-enhancer、windows-titlebar-control-safe-zone。
- 更新 openspec/project.md 的 active/archive/spec 计数、active change 列表和 2026-06-10 closure snapshot。

验证结果：
- 归档前 8 个候选 change strict validation 均通过。
- openspec validate --specs --strict --no-interactive 通过，325 specs passed。
- OpenSpec consistency full check 0 errors，保留既有 warnings。
- openspec validate --all --strict --no-interactive 仍被既有 active change harden-realtime-composer-status-panel-performance 缺少 spec deltas 阻塞。

未纳入本次提交：AGENTS.md 本地修改，以及 4 个未开始 active proposal 目录。


### Git Commits

| Hash | Message |
|------|---------|
| `f4dfba2d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 800: 归档阻塞 OpenSpec 提案

**Date**: 2026-06-10
**Task**: 归档阻塞 OpenSpec 提案
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

本次按用户要求清理并归档 OpenSpec 阻塞提案：

- 将 add-custom-theme-palette-presets 归档到 openspec/changes/archive/2026-06-10-add-custom-theme-palette-presets，并同步 settings-custom-theme-presets main spec。
- 将 harden-codex-tui-compatible-user-agent 归档到 openspec/changes/archive/2026-06-10-harden-codex-tui-compatible-user-agent，并创建 codex-tui-compatible-user-agent main spec。
- 删除 harden-codex-tui-compatible-user-agent tasks 中未完成的 Deferred / Not Done 项后归档。
- 将 harden-realtime-composer-status-panel-performance 删除未完成 validation/follow-up task 后以 --skip-specs 归档到 openspec/changes/archive/2026-06-10-harden-realtime-composer-status-panel-performance。
- 删除空的 add-intent-change-review-workflow change 目录。

验证：

- openspec validate --all --strict --no-interactive 通过，330 passed, 0 failed。

注意：

- 本次提交未包含既有未提交改动 AGENTS.md。
- 本次提交未包含仍处于 active planning 的 enforce-bundle-budget-gate、parallelize-bootstrap-locale-loading、refresh-v059-performance-baseline、split-startup-css-loading。


### Git Commits

| Hash | Message |
|------|---------|
| `2a09c927` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 801: 批量落地 v0.5.9 性能优化

**Date**: 2026-06-11
**Task**: 批量落地 v0.5.9 性能优化
**Branch**: `feature/v0.5.9`

### Summary

批量提交 v0.5.9 性能优化与对应 OpenSpec/Trellis 文档：覆盖 AppShell lazy boundaries、startup i18n/bootstrap、startup CSS split、Markdown lazy runtime、FileView typing latency、search bounded hydration、runtime evidence gates 与 perf baseline 刷新。

### Main Changes

- 落地 AppShell performance boundaries 与 lazy view boundaries，降低 startup 主路径负载。
- 并行化 bootstrap locale/i18n 初始化，并补充 `src/i18n/index.test.ts` 与 bootstrap 回归测试。
- 拆分 startup CSS loading，新增 feature style loader hook。
- 引入 Markdown full runtime lazy loading，并把相关异步渲染测试改为 `waitFor` 断言。
- 强化 file preview/editor typing latency 路径，补充 CodeMirror language extension 与 typing diagnostics 测试。
- 更新 search unified index / bounded hydration 指标和 runtime performance evidence gate。
- 刷新 `docs/perf` baseline/history 与 OpenSpec archive/active changes。
- 验证已通过：`git diff --check`、`npm run typecheck`、`npm run lint`、`npm run build`、`npm run check:bundle-chunking`、focused Vitest suites、`npm run test`、`openspec validate --all --strict --no-interactive`。


### Git Commits

| Hash | Message |
|------|---------|
| `6e005ebb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 802: 完成文件预览重依赖延迟加载

**Date**: 2026-06-11
**Task**: 完成文件预览重依赖延迟加载
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| OpenSpec | `lazy-file-preview-dependencies` tasks 已完成并归档；proposal/design 回写最终实现、evidence、`@codemirror/search` No-Reintroduction 决策。 |
| Frontend | `FileViewPanel` / `FileViewBody` shell 不再 runtime import CodeMirror；新增 `FileCodeMirrorEditor` lazy boundary 与 `FileCodeMirrorEditorImpl` runtime chunk。 |
| Runtime boundary | `useFileNavigation` 改为通过 editor handle 调用 find panel / navigation flash，CodeMirror search、keymap、annotation widgets、git line markers 保持在 lazy editor chunk 内。 |
| Regression guard | 新增 lazy language loader race test，补充 Trellis quality guideline 和 `openspec/docs/lazy-state-extension-regression-2026-06-11.md`。 |
| Evidence | 刷新 perf baseline/history；`vendor-codemirror-*` 不再从 `dist/index.html` modulepreload，bundle gate 通过。 |
| Validation | `npm run typecheck`、`npm run lint`、`npm run build`、`npm run check:bundle-chunking`、`npm test`、`openspec validate lazy-file-preview-dependencies --strict --no-interactive` 全部通过。 |


### Git Commits

| Hash | Message |
|------|---------|
| `b2fe0224` | (see git log) |
| `bf048d7c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 803: 完善 search index review 修复

**Date**: 2026-06-11
**Task**: 完善 search index review 修复
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

本次按用户要求对当前工作区进行全面 review，并重点检查 search index、large-file governance、heavy-test-noise gate、边界条件与跨平台写法。

主要变更：
- 修复 search index invalidation 从 count-only 改为 content-aware numeric fingerprint，覆盖 same-count file replacement、thread rename、message text edit。
- 补强 `isIndexStale` 的 workspace/provider identity 校验，避免跨 workspace/provider 相同 version 误判 fresh。
- 新增 `searchQueryToken`，让 query token 在 render 阶段幂等推进，并在 `useUnifiedSearch` 中接入 stale guard。
- 新增 search indexing/equivalence/invalidation/perf evidence regression tests。
- 为 `check-heavy-test-noise.mjs` 增加 repo-boundary output path guard，防止治理 artifact 写出仓库。
- 同步 `openspec/changes/search-index-and-bounded-hydration/design.md` 与 `tasks.md`，记录 content-aware invalidation 和验证结果。

验证：
- `npx vitest run src/features/search/indexing/ src/features/search/hooks/searchQueryToken.test.tsx src/features/search/hooks/useUnifiedSearch.test.ts src/features/search/perf/`：94/94 pass。
- `node --test scripts/check-large-files.test.mjs`：12/12 pass。
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`：20/20 pass。
- `npm run check:large-files:near-threshold && npm run check:large-files:gate`：hard gate pass，fail scope found=0。
- `npm run typecheck`：pass。
- `npm run lint`：pass。
- `openspec validate search-index-and-bounded-hydration --strict --no-interactive`：valid。
- `npm run check:heavy-test-noise`：651 test files completed；act warnings 0，stdout payload 0，stderr payload 0。

备注：
- `npm warn Unknown user config "electron_mirror"` 属于环境告警，heavy-test-noise gate 识别为 environment warning，不算 repo-owned violation。


### Git Commits

| Hash | Message |
|------|---------|
| `905c6a37` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 804: 补齐实时链路追踪门禁

**Date**: 2026-06-11
**Task**: 补齐实时链路追踪门禁
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| OpenSpec | `realtime-trace-correlation-gate` |
| 代码提交 | `ea916f00 feat(perf): 补齐实时链路追踪门禁` |
| 实现 | 新增 bounded per-turn trace correlation aggregator，贯穿 user-send、runtime-start、first delta、batch flush、reducer commit、first visible row/text、terminal settlement。 |
| Replay | 新增 `realtimeTurnTraceReplay`，从 replay event stream 合成 turn-level milestone summaries 与 4 个预算指标。 |
| Evidence | 生成 `docs/perf/realtime-turn-trace.json`，扩展 realtime baseline、runtime evidence gates 与 OpenSpec runtime evidence 文档。 |
| 质量 | 补充 trace id uniqueness、replay grouping、proxy evidence classification、runtime milestone wiring、boundary guard、content-safety tests。 |
| 验证 | `npm run typecheck`、`npm run lint`、`npm run test`、`npm run perf:realtime:report -- --profile=extended`、`npm run perf:baseline:aggregate`、`npm run check:runtime-evidence-gates`、`npm run perf:realtime:boundary-guard`、`openspec validate realtime-trace-correlation-gate --strict --no-interactive`、`git diff --check` 均通过。 |
| 遗留 | `scripts/ensure-dev-port.*` 和两个较早 perf history untracked 快照未纳入本次 realtime gate 提交。 |


### Git Commits

| Hash | Message |
|------|---------|
| `ea916f00` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 805: 归档 P0 性能提案至 openspec archive

**Date**: 2026-06-11
**Task**: 归档 P0 性能提案至 openspec archive
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

| 阶段 | 内容 |
|---|---|
| P0 收口确认 | 扫描 roadmap P0-01 ~ P0-11 共 11 项；全部落地（3 个 active change + 8 个 archive 06-10 change）；tasks 全 [x]；openspec validate 全部 valid |
| 归档 1 | `lazy-file-preview-dependencies` → `2026-06-11-lazy-file-preview-dependencies`；spec delta: `file-view-document-preview-modes` / `file-view-language-rendering-coverage` 各 `~2 modified` |
| 归档 2 | `search-index-and-bounded-hydration` → `2026-06-11-search-index-and-bounded-hydration`；delta 原用 MODIFIED header 找不到（main spec 同名 requirement 不一致），改 `## ADDED Requirements` 通过；落点 `composer-file-reference-index-availability` `+1 added` |
| 归档 3 | `realtime-trace-correlation-gate` → `2026-06-11-realtime-trace-correlation-gate`；delta 拆为 `## MODIFIED Requirements`（2 个原 requirement replace 升级 body）+ `## ADDED Requirements`（新增 `Realtime Visible Lag Budgets SHALL Use Correlated Milestones`）；落点 `conversation-stream-latency-diagnostics` `~2 modified` / `runtime-performance-evidence-gates` `+1 added ~1 modified` |
| 校验 | 5 个被改 main spec `openspec validate --type spec --strict` 全部 `is valid`；`openspec list` 返回 `No active changes found` |
| 工作区 | 归档前残留的 `ensure-dev-port.mjs` Windows shell 注入修复 + 对应测试 + 2 份 v0.5.9 baseline 历史快照已被 `fbeea497` / `75d49166` 等 commit 收走，无需在本 commit 处理 |
| Commit | `aba7c2fd chore(openspec): 归档 P0 性能提案`（19 files changed, +89 / -102，全部为 rename + spec merge） |

**下一步候选**：
1. 启动 P1 立项：roadmap P1 14 项 + P2 12 项共 26 项未走独立 OpenSpec 流程；散落 commit 线索（`cef83671` MessageRow / `03520fb7` Composer / `99e819c2` git polling 等）可作归档/反向立项素材
2. 验证矩阵实跑：`npm run perf:baseline:all` / `check:bundle-chunking` / `perf:long-list:baseline` / `perf:composer:baseline` / `perf:realtime:extended-baseline` / `perf:realtime:boundary-guard` 全套
3. roadmap 第 15 章"缺口复核"按当前 v0.5.9 实际状态刷新


### Git Commits

| Hash | Message |
|------|---------|
| `aba7c2fd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 806: 提交 OpenSpec 性能预算提案

**Date**: 2026-06-11
**Task**: 提交 OpenSpec 性能预算提案
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| Commit | `41ffa534 docs(openspec): 新增渲染与资源预算优化提案` |
| Summary | 新增 5 个 OpenSpec change，覆盖 composer/message row 渲染预算、workspace tree/large file listing、backend IO cache/bridge payload、renderer resource backpressure、markdown off-main-thread pipeline。 |
| Scope | 仅提交 `openspec/changes/**` 下指定 5 个提案目录，未纳入当前工作区其他源码改动。 |
| Notes | 每个 change 包含 proposal、tasks、design 与对应 spec delta；提交前做了明显占位词扫描。 |

**Updated Files**:
- `openspec/changes/composer-and-message-row-render-budget/**`
- `openspec/changes/workspace-tree-and-large-file-listing-budget/**`
- `openspec/changes/backend-io-cache-and-bridge-payload-budget/**`
- `openspec/changes/renderer-resource-backpressure/**`
- `openspec/changes/markdown-off-main-thread-pipeline/**`


### Git Commits

| Hash | Message |
|------|---------|
| `41ffa534` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 807: 为 5 个 P1 提案补串行执行顺序

**Date**: 2026-06-12
**Task**: 为 5 个 P1 提案补串行执行顺序
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

| 阶段 | 内容 |
|---|---|
| 判断并行可行性 | 分析 5 个 P1 提案的物理写入面 + 跨提案耦合点；结论：仅 A+E 可并行（共享 `rendererDiagnostics` / `runtime-performance-evidence-gates`），B 与 C 共写 `workspaces/files.rs`，A 与 D 共写 `app-shell.tsx`，5 个全部并行必冲突 |
| 决定串行顺序 | 改用 A → D → C → B → E 全串行：A 先解 Composer 与 shell 订阅；D 再拆 `app-shell.tsx` listener owner registry；C 落地 `ScanCache` / `spawn_blocking` helper / `payloadBudget` 注解；B 复用 C 基础设施改 `workspaces/files.rs` 分页契约；E 最后做 markdown worker |
| 改写 proposal | 5 个 proposal.md 末尾新增 `## Execution Order / 执行顺序` 段：Position / Predecessors / Successors / Required Public Artifacts / Cross-Change Constraint / Blocking Rule |
| 改写 tasks | 5 个 tasks.md 顶部 prepend `## Execution Step / 执行步序` 段：Step 编号 + 前置提案提示 + 串行链阻塞规则 |
| 验证 | 5 个 change 全部 `openspec validate --strict --no-interactive` 返回 `is valid`；3 个新 OpenSpec change 目录（`composer-queued-fusion-*` / `git-status-rename-*` / `layout-plan-panel-live-resize-preview`）未触碰 |
| Commit | `944e3536 docs(openspec): 为 5 个 P1 提案补串行执行顺序`（10 files changed, +127 lines） |
| 状态 | 工作区剩 28 个 src 改动 + 3 个 untracked change 目录均来自用户/团队，未混入本次 commit |

**改天实施入口**：按 `944e3536` 回到任一 proposal，看 `Execution Order` 段确认自己的 Step 编号与前置产物；改源码前先 `rg "## Required Public Artifacts"` 找到下游依赖的接口契约，确保本 change 不会破坏下游。


### Git Commits

| Hash | Message |
|------|---------|
| `944e3536` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 808: 收口本迭代已完成任务

**Date**: 2026-06-12
**Task**: 收口本迭代已完成任务
**Branch**: `feature/v0.5.9`

### Summary

(Add summary)

### Main Changes

本次按用户要求收口本迭代 P0 / performance task 状态漂移。

主要动作：
- 使用 `python3 ./.trellis/scripts/task.py archive <task> --no-commit` 将 8 个已由 OpenSpec archive 验证的 Trellis tasks 移入 `.trellis/tasks/archive/2026-06/`。
- 提交任务归档：`c646bcc0 chore(trellis): 收口本迭代已完成任务`。
- 未修改业务代码，仅维护 Trellis task 状态。

归档任务：
- `06-01-browser-dock-phase3-observation-core`
- `06-10-refresh-v059-performance-baseline`
- `06-10-enforce-bundle-budget-gate`
- `06-10-harden-file-editor-typing-latency`
- `06-10-parallelize-bootstrap-locale-loading`
- `06-10-split-startup-css-loading`
- `06-11-lazy-markdown-runtime`
- `06-11-split-app-shell-performance-boundaries`

验证结果：
- `npx openspec list`：当前 active changes 只剩 5 个 P1 resource / renderer budget proposals。
- `npx openspec validate --specs --strict --no-interactive`：328 passed, 0 failed。
- `python3 ./.trellis/scripts/task.py list --mine`：6 月已完成任务不再出现在 active list。
- active P0 只剩 3 个 4 月遗留 planning tasks，未在本次误关：`split-engine-opencode-command-surface`、`split-git-branch-commands`、`split-runtime-session-lifecycle`。

后续建议：
- 单独判断 4 月 3 个 P0 的真实归属：保留 backlog、降级，或另开收口。


### Git Commits

| Hash | Message |
|------|---------|
| `c646bcc0` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 809: 落地 P1 性能预算链路

**Date**: 2026-06-12
**Task**: 落地 P1 性能预算链路
**Branch**: `feature/v0.5.9`

### Summary

实现 renderer/backend/workspace/markdown 性能预算链路，补齐 runtime evidence gate 与相关回归测试。

### Main Changes

## Session Summary

本次提交落地 P1 performance chain 的主要实现与证据更新：

- 新增 backend payload/cache budget substrate：`src-tauri/src/backend_budget.rs`，并接入 workspace file listing / git bridge metadata。
- 新增 renderer resource backpressure substrate：event backpressure、listener owner、focus refresh wave、media resource owner、renderer diagnostics。
- 强化 composer/message row render budget：ChatInputBox value-path 隔离、input history stale-drop、MessagesRows render diagnostics。
- 增加 workspace tree large-file listing budget：file tree sourceVersion、listing budget metadata、shared workspace file index。
- 增加 markdown precompute pipeline：`messageMarkdownPrecompute` 与 fast markdown worker 复用路径。
- 更新 runtime evidence gate 生成脚本、JSON/Markdown 报告和 OpenSpec active change proposal/tasks。

## Verification

- `npm run typecheck` passed
- `npm run lint` passed
- `npm run test` passed: 658 test files completed
- `openspec validate --all --strict --no-interactive` passed: 333 items
- `npm run check:runtime-evidence-gates` passed
- `npm run check:runtime-contracts` passed
- `npx vitest run src/app-shell-parts/useAppShellLayoutNodesSection.test.ts src/features/threads/hooks/useThreads.engine-source.test.tsx` passed
- `git diff --check` passed

## Notes

During verification, `TaskCreateModal.test.tsx` exposed an async state assertion race after global test cleanup became stricter. The test now waits for the generated title value instead of reading synchronously. Runtime contract verification also exposed that `updateThreadParent` was used by `useAppShellLayoutNodesSection` but not fully surfaced through `AppShell` / `useThreads`; the contract chain is now explicit and verified.


### Git Commits

| Hash | Message |
|------|---------|
| `f7ae0a99` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
