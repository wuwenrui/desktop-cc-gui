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
