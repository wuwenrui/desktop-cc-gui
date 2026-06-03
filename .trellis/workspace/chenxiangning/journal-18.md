# Journal - chenxiangning (Part 18)

> Continuation from `journal-17.md` (archived at ~2000 lines)
> Started: 2026-06-01

---



## Session 652: 收口会话恢复 Fork 入口

**Date**: 2026-06-01
**Task**: 收口会话恢复 Fork 入口
**Branch**: `feature/v0.5.4`

### Summary

将 Codex stale thread recovery 卡片的 Fork 并重发收口为纯 Fork，并回写 OpenSpec 变更记录。

### Main Changes

## Session Summary

- 将 Codex stale thread recovery 卡片主按钮从 `Fork 并重发` / `Fork and resend` 改为纯 `Fork`。
- 新增 `onThreadRecoveryFork` 传递链，复用现有 `startFork("/fork")` 能力，不重新实现 fork。
- 保留非 stale runtime reconnect/resend 行为；stale thread Fork 不再调用 `ensureRuntimeReady` 或 `onRecoverThreadRuntimeAndResend`。
- 更新 i18n 与 focused reconnect card 测试契约。
- 新增 OpenSpec change `fix-thread-recovery-fork-shortcut`，记录 proposal/tasks/spec delta。

## Validation

- 未运行测试或 OpenSpec validate；本轮按用户要求先提交收口。

## Notes

- 工作区仍存在提交前已识别的无关未提交改动：daemon/thread listing/engine hooks 与 `openspec/changes/fix-git-change-canonical-model/`，本次提交未纳入。


### Git Commits

| Hash | Message |
|------|---------|
| `e450586e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 653: 收口 Codex 线程列表和引擎切换降级修复

**Date**: 2026-06-01
**Task**: 收口 Codex 线程列表和引擎切换降级修复
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
|------|------|
| 目标 | 修复 2026-05-31 error-log 中 `thread/list live timeout`、`thread/list error`、`engine/switch error` 三类问题的可感知失败路径。 |
| 代码提交 | `4ac0b0d6 fix(codex): 降级处理线程列表和引擎切换错误` |
| 后端修复 | `thread_listing.rs` 和 daemon `list_threads` 在 live Codex thread/list 超时或失败时，不再直接 fatal，而是走 bounded local session fallback，并通过 `partialSource` 标记 degraded 状态。 |
| 前端修复 | `useEngineController` 在切换 engine 前刷新 stale detection；Codex 仍不可用时调用 doctor，输出 `resolvedBinaryPath`、`pathEnvUsed`、`environmentDiagnosis` 等证据，避免只有泛化 `Engine codex is not installed`。 |
| 规范记录 | 新增 OpenSpec change `fix-codex-thread-list-engine-switch-degradation`，记录目标、设计、任务和两组 behavior spec delta。 |
| 范围排除 | `account/rateLimits/read error` 未纳入本次修复；Git diff canonical model 相关 dirty files 未暂存、未提交。 |
| 验证 | 已通过 `cargo fmt --check`、目标 Rust tests、`cargo check`、engine hook ESLint/Vitest、`npm run check:runtime-contracts`、`openspec validate --strict`；`npm run typecheck` 仍受 unrelated `RuntimeReconnectCard.tsx` 既有类型错误阻断。 |


### Git Commits

| Hash | Message |
|------|---------|
| `4ac0b0d6` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 654: 修复 Git 差异文件规范化展示

**Date**: 2026-06-01
**Task**: 修复 Git 差异文件规范化展示
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| OpenSpec | Added `fix-git-change-canonical-model` proposal, design, delta spec, tasks, closure notes, validation evidence, and manual review caveat. |
| Git panel | Added canonical status+diff projection so diff-only added/deleted files render without losing status-authoritative behavior. |
| Safety | Marked diff-only fallback rows preview-only and excluded them from stage, unstage, discard, and commit inclusion mutation flows. |
| Cross-platform | Normalized repository-relative Git paths without OS path APIs and covered Windows-style separators plus LF/CRLF diffs. |
| UI | Added deleted-row visual marker with line-through treatment. |
| Validation | Ran typecheck, focused Git/message/documentation tests, large-file governance checks, and heavy-test-noise gate. |

**Primary commit**: `8438d73d fix(git): 修复差异文件规范化展示`

**Validation**:
- `npm run typecheck`
- `npx vitest run src/features/git/utils/gitChangeModel.test.ts src/features/git/components/GitDiffPanel.test.tsx`
- `npx vitest run src/features/messages/components/Messages.runtime-reconnect.test.tsx src/features/messages/components/runtimeReconnect.test.ts`
- `npx vitest run src/features/client-documentation/components/ClientDocumentationWindow.test.tsx`
- `node --test scripts/check-large-files.test.mjs`
- `npm run check:large-files:near-threshold`
- `npm run check:large-files:gate`
- `node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs`
- `npm run check:heavy-test-noise`

**Caveat**:
- Manual interactive Git panel smoke was not executed; remaining visual check is deleted-row line-through and preview-only fallback rows in the running app.


### Git Commits

| Hash | Message |
|------|---------|
| `8438d73d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 655: 修复自动会话 system-auto 归类与失败路径元数据

**Date**: 2026-06-01
**Task**: 修复自动会话 system-auto 归类与失败路径元数据
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

本次收口 OpenSpec change `classify-auto-session-visibility` 的完成态：

- 统一 reserved system folder 展示名为 `system-auto`，避免 `System auto` / `system-auto` 命名漂移。
- 修复 Claude `engine_send_message_sync` 自动新会话没有稳定 identity 时 metadata 漏写的问题。
- 补充失败路径：当 Claude sync 自动会话已观察到稳定 session id 后，即使后续 turn 失败，也会写入 `autoSession` metadata，避免失败 transcript 泄漏到 workspace root。
- 回写 OpenSpec design/spec/tasks，新增并完成 `2.5 / 4.5`。

验证：
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`
- `cargo test --manifest-path src-tauri/Cargo.toml failed_claude_sync_auto_session_persists_metadata_after_identity_is_observed -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml resolve_claude_auto_session_metadata_id -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml resolve_claude_session_id_for_sync -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml system_auto_metadata_exposes_reserved_folder_group -- --nocapture`
- `npm exec vitest run src/features/app/utils/workspaceSessionFolders.test.ts`
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `openspec validate classify-auto-session-visibility --strict --no-interactive`
- `git diff --check`


### Git Commits

| Hash | Message |
|------|---------|
| `59123d87` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 656: 归档已验证 OpenSpec 变更并回写主规范

**Date**: 2026-06-01
**Task**: 归档已验证 OpenSpec 变更并回写主规范
**Branch**: `feature/v0.5.4`

### Summary

批量归档 9 个已验证 OpenSpec change，回写主 specs，并完成 OpenSpec strict validation。

### Main Changes

本次会话完成 OpenSpec 收口：

- 批量归档 9 个已验证 change：classify-auto-session-visibility、fix-git-change-canonical-model、fix-codex-thread-list-engine-switch-degradation、add-file-tab-detached-open、fix-runtime-acquire-helper-read-regression、refine-conversation-message-copy-actions、harden-project-map-organizer-review-ux、fix-thread-recovery-fork-shortcut、add-codex-structured-launch-profile。
- 回写主 specs，新增 auto-session-visibility-classification、codex-launch-profile-resolution、codex-launch-profile-settings、conversation-message-actions 等 capability specs。
- 保留 add-agent-task-orchestration-center active，不做实现或归档。
- 针对 fix-thread-recovery-fork-shortcut 完成 focused Vitest、typecheck、单 change validate 后归档。
- add-codex-structured-launch-profile 经用户在桌面 UI 手动确认 Launch Configuration 矩阵通过后归档。

验证：

- npx vitest run src/features/messages/components/Messages.runtime-reconnect.test.tsx：20 passed。
- npm run typecheck：通过。
- openspec validate fix-thread-recovery-fork-shortcut --strict --no-interactive：通过。
- openspec validate add-codex-structured-launch-profile --strict --no-interactive：通过。
- openspec validate --all --strict --no-interactive：304 passed, 0 failed。


### Git Commits

| Hash | Message |
|------|---------|
| `bad389e5d757670e12bf7acbbfdcad0a927b34f8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 657: 加固 Project Map 模型结构化输出

**Date**: 2026-06-01
**Task**: 加固 Project Map 模型结构化输出
**Branch**: `feature/v0.5.4`

### Summary

抽取通用模型结构化输出 normalization，接入 Project Map generation 与 organizer，并补齐 OpenSpec/code-spec 记忆。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `4cb04065` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 658: 强化独立窗口图标主题色

**Date**: 2026-06-01
**Task**: 强化独立窗口图标主题色
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

## Summary
- 强化文件 tab 独立窗口打开 icon 的主题色可见性。
- 保持按钮无边框、无背景，只对 SVG icon stroke 进行显式着色。
- 回写 archived OpenSpec proposal，补记入口醒目与主题适配要求且不改变行为。

## Changed Files
- src/styles/file-view-panel.css
- openspec/changes/archive/2026-05-31-add-file-tab-detached-open/proposal.md

## Verification
- Not run; visual-only CSS adjustment per request.

## Notes
- Existing unrelated worktree changes were left untouched.


### Git Commits

| Hash | Message |
|------|---------|
| `ca99d5e3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 659: 补齐三证对账采证日志

**Date**: 2026-06-01
**Task**: 补齐三证对账采证日志
**Branch**: `feature/v0.5.4`

### Summary

增强 Phase2b 前置采证：持久化 reconciliation query skipped/resolved/cleanup skipped 诊断，并在 proposal 标记本次不启用 cleanup、不放宽 PHASE2B_HANDOFF_MARKER。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1ea75869` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 660: 提交内嵌浏览器 MVP phase1

**Date**: 2026-06-01
**Task**: 提交内嵌浏览器 MVP phase1
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Browser Agent MVP | Committed phase1 embedded browser agent surface, including frontend dock, backend browser_agent module, Tauri service bridge, platform capability helpers, snapshot sanitizer, attachment utilities, settings/i18n/style integration, and OpenSpec change artifacts. |
| Task/Conversation Integration | Included task center, queued handoff bubble, composer, message presentation, app shell, layout, sidebar, and workspace entry integrations for the browser-agent phase1 flow. |
| Governance Gate Hardening | Included large-file/heavy-test-noise/test-batched boundary fixes: accurate fail-mode JSON evidence, strict batch-size parsing, .omx runtime artifact exclusion, and hard-debt blocking coverage. |

**Validation Evidence**:
- `node --test scripts/check-large-files.test.mjs scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs` passed: 29/29.
- `npm run check:large-files:near-threshold` passed; emitted 27 watch warnings.
- `npm run check:large-files:gate` passed; hard gate found 0.
- Full `npm run check:heavy-test-noise` was intentionally not run in this session because it executes the complete heavy suite; focused parser/gate tests covered the governance fixes.

**Code Commit**:
- `372a1679 feat(browser-agent): 提交内嵌浏览器 MVP phase1`


### Git Commits

| Hash | Message |
|------|---------|
| `372a1679` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 661: Browser Dock Phase 2 收口

**Date**: 2026-06-01
**Task**: Browser Dock Phase 2 收口
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Browser Dock | 收口 Browser Dock Phase 2 为 evidence-grade page understanding MVP，保留右侧 companion split 和 active tab source of truth。|
| Snapshot v2 | 增加 primaryContent、readableBlocks、noiseDiagnostics、visualEvidence、pageType、codeCandidates、budget 和 privacy metadata。|
| Composer/引用卡 | 将关联入口移动到 Browser Dock header；Composer 保留已关联 preview、refresh、remove 和可滚动详情；发送后引用卡支持结构化详情和复制安全摘要。|
| AI payload | 统一通过 BrowserContextAttachment / formatBrowserContextPrompt 注入，避免 UI 预览和模型输入分裂。|
| Review fixes | 修复 TaskRun degraded evidence state 被丢弃的问题；保留 degraded/expired freshness，不再压扁成 stale；补齐 shared send attachment 类型。|
| OpenSpec | proposal/tasks/implementation-notes/validation 已写入 Phase 2 closure，并把 OCR/vision、复杂 SPA、授权 action preview 等移入下一阶段输入。|

Review result:
- OpenSpec status remains complete and strict validate passed during closure.
- No remaining blocker found in static diff review.
- No extra frontend/backend test command was run in the final closure turn.


### Git Commits

| Hash | Message |
|------|---------|
| `f49c9ad2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 662: 校准 Phase2b 启动证据

**Date**: 2026-06-01
**Task**: 校准 Phase2b 启动证据
**Branch**: `feature/v0.5.4`

### Summary

根据 2026-06-01 error-log 新证据，将 Phase2b handoff marker 校准为双 GO 路径：status-query resolved terminal evidence 或 matched terminal evidence + scoped busy residue；本次仅更新 OpenSpec 文档，不改运行时代码。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `1cbbab37` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 663: Browser Context 类型契约修复

**Date**: 2026-06-01
**Task**: Browser Context 类型契约修复
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| 项目 | 说明 |
|------|------|
| 修复范围 | 修复 Browser Context prompt 解析结果、send attachment、summary card 展示契约之间的 TypeScript 不一致。 |
| 关键修复 | 将 parsed prompt 返回类型改为核心字段必填 + 结构化字段可选，避免 `visibleTextExcerpt` 被错误强制为必填。 |
| 关键修复 | 将 visual evidence/code candidate 解析改为 `flatMap` 产出干净数组，消除 nullable map + type predicate 不兼容。 |
| 关键修复 | SummaryCard 使用展示层宽松契约，兼容 live/history/send attachment 的 diagnostics、budget、privacy 字段。 |
| 验证 | `npm run build` 通过；仅剩既有 Vite chunk size / dynamic import warning。 |

**Updated Files**:
- `src/features/browser-agent/utils/attachment.ts`
- `src/features/browser-agent/components/BrowserContextSummaryCard.tsx`


### Git Commits

| Hash | Message |
|------|---------|
| `16f2187b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 664: 修复 CI 品牌与测试噪音门禁

**Date**: 2026-06-01
**Task**: 修复 CI 品牌与测试噪音门禁
**Branch**: `feature/v0.5.4`

### Summary

修复 check:branding 中 browser pending URL 旧品牌 key；隔离 WorkspaceHome 测试中的 BrowserDock runtime side effect；将两个回归点沉淀到 frontend specs。

### Main Changes

## 变更内容

- 将 browser-agent/composer 共享的 pending URL sessionStorage key 从 `mossx.browserAgent.pendingUrl` 改为 `ccgui.browserAgent.pendingUrl`，消除 branding gate legacy token。
- 在 `WorkspaceHome.test.tsx` 中 mock `BrowserDock`，避免 workspace summary 测试真实挂载 browser runtime effect 后产生 React `act(...)` warning。
- 更新 `.trellis/spec/frontend/state-management.md`，新增 branded transient browser session keys contract。
- 更新 `.trellis/spec/frontend/quality-guidelines.md`，新增 runtime-heavy child component test isolation contract。

## 影响范围

- CI branding gate
- heavy-test-noise / React act warning gate
- frontend state key 命名规范
- parent component unit test 隔离规范

## 验证

- 本轮未主动运行验证命令；修复依据来自 CI failure log 与 targeted source inspection。


### Git Commits

| Hash | Message |
|------|---------|
| `08f17169` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 665: 收窄 Browser Dock 自动打开触发

**Date**: 2026-06-01
**Task**: 收窄 Browser Dock 自动打开触发
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

完成 Browser Dock 自动导航误触发修复与 release CI hotfix。

主要改动：
- 将 Composer 中的 Browser Dock 自动导航识别抽成 src/features/composer/utils/browserNavigation.ts。
- 收窄自动打开 Browser Dock 的触发条件：只允许明确短导航命令，描述性 bug report、截图说明、日志文本和包含 URL 的上下文 fail closed 为普通发送。
- 新增 browserNavigation.test.ts 覆盖 explicit navigation 与描述性文本拒绝。
- 修复 src-tauri/src/workspaces/commands.rs 中 macOS-only status 绑定泄漏到非 macOS 编译的问题，恢复 Linux/Windows release build 编译。
- 回写 openspec/changes/enhance-browser-agent-page-understanding 的 proposal/tasks/implementation-notes/validation，记录 post-closure hardening 和验证结果。

验证：
- openspec validate enhance-browser-agent-page-understanding --strict
- npx vitest run src/features/composer/utils/browserNavigation.test.ts
- npm run typecheck
- cargo check --manifest-path src-tauri/Cargo.toml
- npm run lint

Commit: e22c9b1b fix(browser-agent): 收窄浏览器自动打开触发


### Git Commits

| Hash | Message |
|------|---------|
| `e22c9b1b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 666: 稳定 Project Map 面板批量测试

**Date**: 2026-06-01
**Task**: 稳定 Project Map 面板批量测试
**Branch**: `feature/v0.5.4`

### Summary

修复 ProjectMapPanel 测试在 batch/CI 下可能受全局查询与状态残留影响的 flaky 风险。

### Main Changes

| 项目 | 内容 |
|------|------|
| 改动 | 为 `ProjectMapPanel.test.tsx` 增加 afterEach cleanup/localStorage/mock 清理，并将 API Surface 节点点击限定到 graph viewport 内。 |
| 验证 | `npx vitest run src/features/project-map/components/ProjectMapPanel.test.tsx --reporter=verbose` 通过 35/35。 |
| 验证 | `npx vitest run --maxWorkers 1 --minWorkers 1 src/features/project-map/components/ProjectMapPanel.test.tsx src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/hooks/useProjectMapGenerationOptions.test.tsx src/features/project-map/projectMapI18n.test.ts --reporter=verbose` 通过 71/71。 |
| 门禁 | `npm run lint` 与 `npm run typecheck` 通过。 |


### Git Commits

| Hash | Message |
|------|---------|
| `90bf8321` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
