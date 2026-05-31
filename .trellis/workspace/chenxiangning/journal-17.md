# Journal - chenxiangning (Part 17)

> Continuation from `journal-16.md` (archived at ~2000 lines)
> Started: 2026-05-27

---



## Session 607: Project Map 节点拖拽与重复节点修复

**Date**: 2026-05-27
**Task**: Project Map 节点拖拽与重复节点修复
**Branch**: `feature/v0.5.3`

### Summary

(Add summary)

### Main Changes

本轮完成 Project Map 画布交互与数据归一化收口：
- 修复节点本体 pointer capture 后 move/up 落在 node 上时拖拽 preview 和持久化不触发的问题。
- 强化总览 Root 节点视觉层级，使用更明显的尺寸、蓝色 anchor border、halo 和 badge。
- 修复同一 ProjectMapNode.id 跨多个 lens payload 重复出现导致 graph 渲染多个相同节点的问题，在 topology normalization 层按稳定 id 去重并合并 topology/evidence。
- 更新 OpenSpec change improve-project-map-drag-and-root-visual 的 proposal/design/tasks/spec。

验证：
- npm exec vitest -- run src/features/project-map/components/ProjectMapPanel.test.tsx --maxWorkers 1 --minWorkers 1：28 passed。
- npm exec vitest -- run src/features/project-map/services/projectMapPersistence.test.ts src/features/project-map/utils/incrementalGeneration.test.ts --maxWorkers 1 --minWorkers 1：20 passed。
- openspec validate improve-project-map-drag-and-root-visual --strict：passed。
- npm run typecheck：passed。
- npm run lint：passed。
- npm run check:large-files：found=0。
- git diff --check：passed。


### Git Commits

| Hash | Message |
|------|---------|
| `ced4bf9e` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 608: 修复 Project Map 跨工程生成串线

**Date**: 2026-05-27
**Task**: 修复 Project Map 跨工程生成串线
**Branch**: `feature/v0.5.3`

### Summary

(Add summary)

### Main Changes

## Summary

修复 Project Map 在两个工程同时收集信息时可能串线的问题。根因是生成 worker 使用 mutable active dataset 状态，且持久化边界未校验 snapshot ownership。

## Changes

- 为 Project Map worker 增加 immutable ownership context：workspaceId、storageKey、storageLocation、worker-local dataset。
- worker progress/completion/failure 只写回启动时的 storageLocation；只有当前 UI 仍匹配 workspace + storageKey + storageLocation 时才同步 UI state。
- frontend persistence 写入前校验 dataset manifest storageKey 与 expectedStorageKey。
- read-side quarantine persisted manifest storageKey mismatch，避免展示污染 snapshot。
- Rust `project_map_write_snapshot` 解析 `manifest.json.storageKey` 并拒绝 mismatch 写入。
- OpenSpec 主 spec 已回写，change 已归档到 `openspec/changes/archive/2026-05-27-fix-project-map-cross-workspace-run-isolation/`。

## Validation

- `npm exec vitest -- run src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapPersistence.test.ts --maxWorkers 1 --minWorkers 1`：40 passed。
- `npm run lint`：passed。
- `npm run typecheck`：passed。
- `cargo test --manifest-path src-tauri/Cargo.toml project_map`：9 passed。
- `openspec validate --all --strict --no-interactive`：passed。
- `git diff --check`：passed。


### Git Commits

| Hash | Message |
|------|---------|
| `05f07b8c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 609: 收口 Claude 自定义模型事实源归一化

**Date**: 2026-05-27
**Task**: 收口 Claude 自定义模型事实源归一化
**Branch**: `feature/v0.5.3`

### Summary

(Add summary)

### Main Changes

## Summary

- 新增 `normalizeClaudeCustomModels` / `readClaudeCustomModelsFromStorage`，将 Claude custom model 读取统一为 shape-only normalization。
- 替换 composer selector、engine controller、vendor settings hook 的 Claude custom model 读取路径，避免 user-entered model id 被 generic regex allowlist 过滤。
- CustomModelDialog 对 Claude 使用 `shape-only` 校验，Codex/Gemini 等非 Claude 路径继续保留 `model-id` 校验。
- 新增 OpenSpec change `fix-claude-custom-model-fact-source-normalization` 并补齐 proposal/design/tasks/spec delta。

## Verification

- `git diff --check`
- `npm exec vitest run src/features/composer/components/ChatInputBox/modelOptions.test.ts src/features/engine/hooks/useEngineController.test.tsx src/features/vendors/components/CustomModelDialog.test.tsx src/features/vendors/hooks/usePluginModels.test.tsx`
- `npm run typecheck`
- `openspec validate --all --strict --no-interactive`
- `npm run lint`

## Commit

- `0c981fc9 fix(claude-model): 保留自定义模型事实源`


### Git Commits

| Hash | Message |
|------|---------|
| `0c981fc9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 610: 收口 Codex 启动配置预览

**Date**: 2026-05-28
**Task**: 收口 Codex 启动配置预览
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

## 本次完成

- 实现 Codex Launch Configuration phase 1：global / workspace executable 与 arguments 的 preview、保存提示和继承来源展示。
- 新增 backend `codex_preview_launch_profile` 解析链路，复用现有 `codexBin`、`codexArgs`、workspace `codex_bin`、workspace `settings.codexArgs` 与 worktree parent args precedence。
- 让 Codex doctor 复用 global launch profile resolver，降低 preview 与 doctor 解释漂移。
- 接入 Tauri command、daemon RPC、frontend service/type、Settings UI 与中英文 i18n。
- 回写 OpenSpec proposal，记录 implementation closure、自动化验证结果和待人工执行的桌面回测矩阵。

## 验证

- `git diff --check` passed。
- `npm run lint` passed。
- `npm run typecheck` passed。
- `npm exec vitest run src/features/settings/components/settings-view/sections/CodexSection.test.tsx src/services/tauri.test.ts` passed: 110 tests。
- `cargo test --manifest-path src-tauri/Cargo.toml launch_profile --lib` passed: 5 tests。
- `openspec validate add-codex-structured-launch-profile --strict --no-interactive` passed。

## 后续

- OpenSpec 3.2 仍保持未完成：需要在真实桌面环境执行人工矩阵，重点覆盖 global 清空草稿、workspace args override、worktree parent inherit、保存不打断当前 runtime、preview/doctor 一致性。
- 当前工作区仍有一组未提交的 `project-map` 相关变更和 `openspec/changes/stabilize-project-map-for-v0-5-4/`，本次 commit 未包含这些文件。


### Git Commits

| Hash | Message |
|------|---------|
| `5ec3c7cc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 611: Project Map v0.5.4 稳定性收口

**Date**: 2026-05-28
**Task**: Project Map v0.5.4 稳定性收口
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

目标：收口 v0.5.4 Project Map 稳定性改动，并将当前工作区代码事实回写到 OpenSpec 提案。

主要改动：
- 新增 OpenSpec change `stabilize-project-map-for-v0-5-4`，覆盖 proposal/design/tasks/spec deltas/implementation inventory/verification。
- 加固 Project Map run ownership：生成 request/run metadata 捕获 workspace/storage ownership，worker progress/completion/failure 使用 captured context。
- 加固 frontend/backend storage guard：frontend 写入校验 expected storageKey；Rust snapshot 写入要求 manifest、拒绝 malformed/mismatched manifest，并在 root-level snapshot lock 下完成 backup/write。
- 稳定 Auto Ingestion 和 candidate safety：保留 createCandidate 与 autoApplyEvidenceBacked 差异，弱证据/unsupported/memory-only claims 保持 candidate。
- 稳定 graph projection：使用 normalized node projection 驱动 layout 和 inspector，避免 duplicate stable node id 造成图和详情漂移。
- 增加 failed run category 展示和 i18n 文案，structured output / ownership / evidence / persistence failure 在 task drawer 可诊断。
- Project Map generation options 在 Codex runtime catalogs 为空或失败时复用 canonical `CODEX_MODEL_CATALOG`，避免维护 parallel fallback model list。

验证：
- `npm exec vitest run src/features/project-map/hooks/useProjectMapGenerationOptions.test.tsx` 通过，3 tests。
- `npm exec vitest run src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/services/projectMapPersistence.test.ts src/features/project-map/utils/incrementalGeneration.test.ts src/features/project-map/utils/interactiveLayout.test.ts src/features/project-map/utils/autoIngestion.test.ts src/features/project-map/components/ProjectMapPanel.test.tsx` 通过，7 files / 118 tests。
- `cargo test --manifest-path src-tauri/Cargo.toml project_map` 通过，11 tests。
- `openspec validate stabilize-project-map-for-v0-5-4 --strict --no-interactive` 通过。
- `npm run lint` 通过。
- `npm run typecheck` 通过。
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check` 通过。
- `git diff --check` 通过。

剩余风险：
- 本轮未做 packaged macOS/Windows/Linux desktop visual smoke；verification.md 已明确平台手测缺口。
- 无 schema migration；回滚不需要数据迁移。


### Git Commits

| Hash | Message |
|------|---------|
| `020ebee8` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 612: 稳定 Markdown 文件预览

**Date**: 2026-05-28
**Task**: 稳定 Markdown 文件预览
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

## Summary

完成文件 Markdown 预览稳定性收口：把 OpenSpec change `stabilize-file-markdown-preview-render-architecture` 的 9.x follow-up 落到实现与测试，覆盖 Markdown block rendering correctness、partial refresh non-amplification、interaction state islands。

## Changes

- 为文件 Markdown table wrapper 增加 preview-local horizontal scroll cache，保持 wide table 在同文档 remount、annotation rerender、same-content refresh 后不回到最左侧。
- 将 `flowchart` fenced block 纳入 Mermaid renderer lifecycle，与 `mermaid` block 一样支持 Source/Render tab、render cache 和 previous-success SVG 稳定性。
- 增加 focused regression，覆盖 table/list/nested list/task list/math/code block rendering semantics、flowchart Mermaid lifecycle、wide table scroll restore、annotation rerender 下 table scroll 保活。
- 更新 OpenSpec proposal/design/spec/tasks，明确 Markdown Preview Correctness & Interaction Stability follow-up，并标记 9.1-9.9 完成。

## Validation

- `pnpm lint` passed
- `pnpm typecheck` passed
- `pnpm test` passed, 553 test files completed
- `pnpm check:large-files:gate` passed, found=0
- `openspec validate --all --strict --no-interactive` passed, 326 items
- `git diff --check` clean


### Git Commits

| Hash | Message |
|------|---------|
| `2f2f18a9` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 613: 归档已完成 OpenSpec 提案

**Date**: 2026-05-28
**Task**: 归档已完成 OpenSpec 提案
**Branch**: `feature/v0.5.4`

### Summary

将 20 个已验证 OpenSpec change 移入 2026-05-28 archive，并同步主 specs 与 workspace 治理快照。

### Main Changes

- Archived 20 completed OpenSpec changes under `openspec/changes/archive/2026-05-28-*`.
- Synced main specs for harness governance, performance gates, file rendering scheduler, composer control surface, reasoning effort, workspace session catalog, runtime evidence gates, and related Project Map capabilities.
- Updated `openspec/project.md` with the 2026-05-28 archive closure snapshot.
- Commit scope intentionally excluded unrelated `src/**` edits and the two new active changes under `openspec/changes/fix-*`.
- Validation note: `openspec validate --all --strict --no-interactive` reported 316 passed / 1 failed; the single failure was unrelated active change `fix-user-input-dismiss-settlement`, which currently has no delta specs and was not included in commit `6716a06d`.


### Git Commits

| Hash | Message |
|------|---------|
| `6716a06d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 614: 修复未开文件树时 composer 文件引用

**Date**: 2026-05-28
**Task**: 修复未开文件树时 composer 文件引用
**Branch**: `feature/v0.5.4`

### Summary

修复 composer @ 文件引用依赖右侧文件树打开的问题，并补充 OpenSpec 契约与 focused regression test。

### Main Changes

- Review 发现并修正 transient disconnect 边界：initial load flag 使用 activeWorkspace.id，不使用 activeWorkspace.connected，保留 useWorkspaceFiles 内部 connected guard 与短暂断连不清空快照的既有契约。
- `src/app-shell.tsx` 将 workspace file index 初始加载从 file tree panel visibility 中解耦，polling 仍保持 file tree 可见时才启用。
- `src/features/workspaces/hooks/useWorkspaceFiles.test.tsx` 新增 regression：`initialLoadEnabled=true` 且 `pollingEnabled=false` 时仍加载一次首个 workspace snapshot，并且 30s 后不触发 polling。
- 新增 OpenSpec change `fix-composer-file-reference-without-file-tree-open`，proposal 已回写 Implementation Closure 与验证结果。
- 验证通过：`npx vitest run src/features/workspaces/hooks/useWorkspaceFiles.test.tsx src/features/composer/hooks/useComposerAutocompleteState.test.tsx`。
- 验证通过：`npm run typecheck`。
- 验证通过：`openspec validate fix-composer-file-reference-without-file-tree-open --strict --no-interactive`。


### Git Commits

| Hash | Message |
|------|---------|
| `50e20eb2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 615: 继续归档已验证 OpenSpec 提案

**Date**: 2026-05-28
**Task**: 继续归档已验证 OpenSpec 提案
**Branch**: `feature/v0.5.4`

### Summary

继续批量归档 30 个已完成且验证通过的 OpenSpec change，同步主 specs 并刷新 workspace 治理快照。

### Main Changes

- Archived 30 remaining verified OpenSpec changes under `openspec/changes/archive/2026-05-28-*`.
- Synced main specs for 28 changes, including session management, markdown preview rendering, stale-thread recovery, runtime stability, governance evidence, file reference, email controls, and related UI/runtime capabilities.
- Archived `add-email-driven-session-continuation` and `fix-composer-tool-popover-stability` with `--skip-specs` because their stale MODIFIED delta headers no longer matched current main spec headings; archived artifacts preserve the historical deltas.
- Updated `openspec/project.md` inventory to active changes = 5, archive changes = 369, main specs = 291.
- Validation: `openspec validate --all --strict --no-interactive` passed with 296 passed / 0 failed.
- Commit scope intentionally excluded existing `src/**` edits and the still-active `openspec/changes/fix-user-input-dismiss-settlement/` work.


### Git Commits

| Hash | Message |
|------|---------|
| `72c5cc60` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 616: 归档用户输入跳过结算提案

**Date**: 2026-05-28
**Task**: 归档用户输入跳过结算提案
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| 项目 | 记录 |
|---|---|
| OpenSpec | 归档 `fix-user-input-dismiss-settlement` 到 `openspec/changes/archive/2026-05-28-fix-user-input-dismiss-settlement/`，同步 `codex-chat-canvas-user-input-elicitation` 与 `conversation-fact-contract` 主 specs。 |
| Frontend | 将 RequestUserInput 的 X/收起保持为本地 collapse，将“跳过并继续”接到 empty-answer settlement，成功后移除 pending request，stale/disconnected 保持容错清理。 |
| Tests | 通过 `openspec validate fix-user-input-dismiss-settlement --strict --no-interactive`、focused Vitest、`npm run typecheck`、`npm run lint`、`openspec validate --all --strict --no-interactive`。 |
| Commit | `12804db3 fix(input): 修复用户输入跳过结算`。 |
| Note | 工作区仍保留未提交的 runtime/settings/thread-tooling 相关改动，未纳入本次提交。 |


### Git Commits

| Hash | Message |
|------|---------|
| `12804db3` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 617: 精修请求输入收起与跳过交互

**Date**: 2026-05-28
**Task**: 精修请求输入收起与跳过交互
**Branch**: `feature/v0.5.4`

### Summary

拆分请求输入卡片的收起与跳过语义，补齐 archived OpenSpec 提案，并纳入 RuntimePool/launch tooling 相关全量变更。

### Main Changes

本次提交：50283b5d fix(user-input): 精修请求输入收起与跳过交互

主要改动：
- 请求输入卡片交互语义拆分：AskUserQuestion close/cancel 使用 dialog-specific label；RequestUserInput 的收起与跳过继续语义在提案中补齐。
- 回写 OpenSpec archived change：补充 compact actionable surface、timeout auto-settlement failure retryable、AskUserQuestion cancel label 等 review fixes。
- 合并当前工作区全量变更：Settings / RuntimePool section、thread messaging session tooling、i18n、renderAppShell 相关调整。

验证记录：
- npm exec vitest run src/features/app/components/RequestUserInputMessage.test.tsx src/features/app/components/AskUserQuestionDialog.test.tsx src/features/messages/components/chatCanvasSmoke.test.tsx src/features/threads/hooks/useThreadUserInput.test.tsx
- npm run lint
- npm run typecheck
- git diff --check


### Git Commits

| Hash | Message |
|------|---------|
| `50283b5d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 618: 修复大文件门禁运行产物噪声

**Date**: 2026-05-28
**Task**: 修复大文件门禁运行产物噪声
**Branch**: `feature/v0.5.4`

### Summary

Review 今天提交后修复 large-file governance 扫描 .artifacts 本地运行产物导致 hard gate false-positive 的问题，并补充回归测试。

### Main Changes

- 修复 scripts/check-large-files.mjs：将 .artifacts 加入 EXCLUDED_DIRS，避免本地 runtime artifacts、Cargo registry 缓存等 ignored 文件参与大文件门禁。
- 补充 scripts/check-large-files.test.mjs 回归测试：验证 .artifacts/** 大文件被跳过，同时普通源码大文件仍会被报告。
- 验证：node --test scripts/check-large-files.test.mjs；node --test scripts/check-heavy-test-noise.test.mjs scripts/test-batched.test.mjs；npm run check:large-files:gate；npm run check:large-files:near-threshold；npm run check:heavy-test-noise；npm run typecheck；npm run lint；cargo test codex::launch_profile；git diff --check。


### Git Commits

| Hash | Message |
|------|---------|
| `85010546` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 619: 校准用户输入跳过与历史回显

**Date**: 2026-05-29
**Task**: 校准用户输入跳过与历史回显
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

本次目标：将工作区代码与已归档 OpenSpec change `fix-user-input-dismiss-settlement` 的 proposal/design/tasks 做收口校准，并完成提交。

主要变更：
- 明确 live RequestUserInput 卡片的 X/收起仅做 presentation-only collapse，显式“跳过并继续”走 runtime empty-answer settlement。
- 保留多问题 AskUserQuestion 中已填写的 partial answers，并通过 `skippedQuestionIds` 标记当前及剩余跳过问题。
- 在 settlement 后本地完成 originating `askuserquestion` tool row，避免 timeline 残留 running 状态。
- 为 Claude AskUserQuestion answer echo 增加 `AskUserQuestionResultBase64` structured marker，并让 frontend history normalizer 优先使用结构化 payload，legacy 文本解析继续兼容。
- 加强 `threadItemsAskUserQuestion` 与 `claudeHistoryLoader` 对 tool id / question id 绑定、`=` / `;` free-text 的回归覆盖。
- 同步 OpenSpec archived proposal/design/tasks 与 `CHANGELOG.md` v0.5.4 release note。
- 同批收口 composer slash command 可发现性补齐，包含 `/share`、`/spec-root` 以及 Codex mode commands 的 popup/autocomplete 测试覆盖。

验证结果：
- `npm exec vitest run src/features/app/components/RequestUserInputMessage.test.tsx src/features/threads/hooks/useThreadUserInput.test.tsx src/utils/threadItems.test.ts src/features/threads/loaders/claudeHistoryLoader.test.ts src/services/tauri.test.ts src/features/composer/components/ChatInputBox/ChatInputBoxAdapter.test.tsx src/features/composer/hooks/useComposerAutocompleteState.test.tsx src/features/messages/components/chatCanvasSmoke.test.tsx`：8 files / 343 tests passed。
- `cargo test --manifest-path src-tauri/Cargo.toml ask_user_question_answer`：相关 Rust tests passed。
- `openspec validate --all --strict --no-interactive`：295 passed, 0 failed。
- `npm run typecheck`：passed。
- `npm run lint`：passed。
- `npm run check:runtime-contracts`：passed。

剩余风险：
- 本轮未做桌面手工 QA；当前结论基于 focused automated tests、typecheck、lint、runtime contract 和 OpenSpec strict validation。


### Git Commits

| Hash | Message |
|------|---------|
| `571687cd` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 620: 收口远程工作区与首页发送按钮修复

**Date**: 2026-05-29
**Task**: 收口远程工作区与首页发送按钮修复
**Branch**: `feature/v0.5.4`

### Summary

提交 Git remote forwarding、workspace folder performance、homepage composer submit button 修复，并补齐 OpenSpec artifacts。

### Main Changes

## Goal

收口当前工作区变动，形成可追踪的代码提交与 OpenSpec 提案闭环。

## Main Changes

- Git remote daemon parity: desktop Git/GitHub commands in remote backend mode forward to daemon RPC, with a test-only forwarding matrix guard.
- Workspace folder performance: workspace file and directory-child scans move blocking filesystem work behind blocking-task boundaries; session folder commands forward to daemon in remote backend mode.
- Homepage composer UX: plain text input enables the ChatInputBox submit button immediately, and homepage submit button styling stays canonical blue across theme selectors.
- OpenSpec backfill: added/updated `fix-remote-git-root-scan`, `fix-workspace-folder-open-performance`, and `fix-home-composer-submit-button-state-and-theme` artifacts.

## Validation

- `cargo test --manifest-path src-tauri/Cargo.toml git_remote_forwarding_matrix_has_unique_daemon_methods`
- `cargo test --manifest-path src-tauri/Cargo.toml list_workspace_files`
- `cargo test --manifest-path src-tauri/Cargo.toml workspace_session_folder`
- `npm run typecheck`
- `npm exec vitest run src/features/composer/components/ChatInputBox/ChatInputBox.submit-button.test.tsx src/features/home/components/HomeChat.styles.test.ts`
- `openspec validate fix-remote-git-root-scan --strict --no-interactive`
- `openspec validate fix-workspace-folder-open-performance --strict --no-interactive`
- `openspec validate fix-home-composer-submit-button-state-and-theme --strict --no-interactive`

## Follow-ups

- Before archive, decide whether to sync the three completed OpenSpec changes into main specs in one batch or keep them active until manual remote/backend QA is recorded.


### Git Commits

| Hash | Message |
|------|---------|
| `bb510fc7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 621: 修复 Web Service 空壳资源白屏

**Date**: 2026-05-29
**Task**: 修复 Web Service 空壳资源白屏
**Branch**: `feature/v0.5.4`

### Summary

修复 daemon 误选 src-tauri/dist 空壳 index 导致 /app 白屏的问题。

### Main Changes

## Goal

修复 Web Service `/app` 启动白屏。根因是 asset root 解析只检查 `index.html` 是否存在，导致 daemon 从 `src-tauri` 工作目录启动时误选 `src-tauri/dist/index.html` 空壳文件。

## Main Changes

- `src-tauri/src/bin/cc_gui_daemon/web_service_runtime.rs` 增加 asset root 有效性校验。
- 候选 `index.html` 必须包含 React mount root 和 module/asset entry，空壳 `<body></body>` 会被跳过。
- 新增 `fix-web-service-empty-dist-white-screen` OpenSpec hotfix，挂到 `client-web-service-settings` capability。

## Validation

- `cargo test --manifest-path src-tauri/Cargo.toml web_assets_root`
- `cargo test --manifest-path src-tauri/Cargo.toml web_service_runtime`
- `openspec validate fix-web-service-empty-dist-white-screen --strict --no-interactive`

## Follow-ups

- 运行中的 Web Service/daemon 需要重启后才会加载该 hotfix 二进制。
- 若需要立即止血，可临时以 `MOSSX_WEB_ASSETS_DIR=<repo>/dist` 启动 daemon/web service。


### Git Commits

| Hash | Message |
|------|---------|
| `b6f0919a` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 622: 补录 v0.5.4 文件树首屏优化会话

**Date**: 2026-05-29
**Task**: 补录 v0.5.4 文件树首屏优化会话
**Branch**: `feature/v0.5.4`

### Summary

补录 workspace file tree first-paint performance hotfix 与 OpenSpec 记录提交的 Trellis session。

### Main Changes

## Goal

补齐 `395ef21f` 与 `cef1553b` 之后遗漏的 Trellis session record，保持 post-commit record gate 闭环。

## Main Changes

- `395ef21f fix(workspace): 优化文件树首屏加载路径`：将 workspace file tree 首屏加载切到 root directory-child 路径，降低递归扫描压力，并补齐 frontend/Rust 回归覆盖。
- `cef1553b docs(openspec): 补充工作区文件树首屏优化变更记录`：补充 `fix-workspace-filetree-first-paint-performance` OpenSpec proposal/design/spec/tasks，记录兼容边界与性能收口说明。

## Validation

- `openspec validate fix-workspace-filetree-first-paint-performance --strict --no-interactive` passed。
- `openspec validate --all --strict --no-interactive` passed：300 passed / 0 failed。

## Follow-ups

- v0.5.4 release closeout 仍需更新 CHANGELOG、归档 completed OpenSpec changes，并明确 `add-codex-structured-launch-profile` 的人工桌面验证 qualifier。


### Git Commits

| Hash | Message |
|------|---------|
| `395ef21f` | (see git log) |
| `cef1553b` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 623: 收口 v0.5.4 发布规范

**Date**: 2026-05-29
**Task**: 收口 v0.5.4 发布规范
**Branch**: `feature/v0.5.4`

### Summary

更新 v0.5.4 changelog，归档 completed OpenSpec changes，并明确 Codex launch profile 人工验证 qualifier。

### Main Changes

## Goal

执行 v0.5.4 release closeout 的文档与 OpenSpec 收口项。

## Main Changes

- 补充 `CHANGELOG.md` v0.5.4 的 2026-05-29 后续内容：workspace file tree first paint、remote Git forwarding、workspace session folder remote backend、homepage composer send button、Web Service empty dist、file tree async/cache 边界。
- 将 `add-codex-structured-launch-profile` 明确标为 release qualifier / deferred closeout：3.2 desktop app manual matrix 仍未完成，完成前不得归档或伪装 fully closed。
- 归档 8 个 completed OpenSpec changes：
  - `fix-workspace-filetree-first-paint-performance`
  - `fix-web-service-empty-dist-white-screen`
  - `fix-home-composer-submit-button-state-and-theme`
  - `fix-workspace-folder-open-performance`
  - `fix-remote-git-root-scan`
  - `preserve-editor-on-topbar-session-switch`
  - `add-cross-workspace-cost-admin-view`
  - `add-engine-plugin-onboarding-kit`
- 对 CLI 自动同步失败的两个 delta spec 做手工同步后再 `--skip-specs` 归档，避免 header 漂移导致归档中断。

## Validation

- `openspec validate --all --strict --no-interactive` passed：294 passed / 0 failed。
- `git diff --check` passed。

## Follow-ups

- `add-codex-structured-launch-profile` 仍是唯一 active OpenSpec change，状态 6/7；需要真实桌面环境执行 manual matrix 后再归档。
- v0.5.4 仍需推送分支、处理 PR range gate、创建 tag/release。


### Git Commits

| Hash | Message |
|------|---------|
| `3db17cd7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 624: 持久化核心错误日志

**Date**: 2026-05-29
**Task**: 持久化核心错误日志
**Branch**: `feature/v0.5.4`

### Summary

为偶发对话结束后仍显示生成中的问题补充前台结算观测，并将核心 error/stderr 与结算失败证据脱敏写入用户全局 .ccgui/error-log 按日 JSONL，完成 OpenSpec、前端/Rust 测试、typecheck、lint、全量测试验证。

### Main Changes

## 工作内容

- 新增 OpenSpec change `observe-foreground-turn-settlement-gaps`，记录前台 terminal event 到达、settlement rejected/deferred/busy residue 的诊断契约。
- 新增 OpenSpec change `persist-client-error-log`，定义用户全局 `~/.ccgui/error-log/YYYY-MM-DD.jsonl` 核心错误日志契约。
- 前端 `useDebugLog` 增加 best-effort 持久化旁路，只落核心 `error`/`stderr`、turn settlement rejected、terminal settlement rejected/busy residue。
- 新增 `clientErrorLog` sanitizer，对 token/password/secret/authorization/cookie 脱敏，对 prompt/content/output/stdout/stderr/raw/delta 等长文本字段只保留长度摘要。
- Tauri 新增 `append_client_error_log` command，复用 `.ccgui` 路径，创建 `error-log` 目录并按本地日期追加 JSONL。
- 增强 foreground terminal settlement diagnostics，保留 terminal event receipt、最新 progress evidence、suspected-silent 上下文与 busy residue 分类。

## Review 结论

- 边界：未引入自动结算/自动修复 stuck turn，只新增证据链与持久化错误日志。
- 兼容：Tauri command 为旁路 best-effort，写入失败不会影响 Debug 面板、对话生命周期或 runtime 主流程。
- 隐私：不写完整 prompt/assistant/tool/stdout/stderr 文本；敏感 key 脱敏；Rust 侧限制单行大小。
- 回滚：移除 DebugEntry 旁路、Tauri command、OpenSpec deltas 即可，不涉及数据模型迁移。

## 验证

- `openspec validate observe-foreground-turn-settlement-gaps --strict --no-interactive`
- `openspec validate persist-client-error-log --strict --no-interactive`
- `npx vitest run src/features/debug/utils/clientErrorLog.test.ts src/features/debug/hooks/useDebugLog.test.tsx src/services/tauri.test.ts`
- `cargo test --manifest-path src-tauri/Cargo.toml client_error_log`
- `npm run typecheck`
- `npm run lint -- --max-warnings=0`
- `npm run test`，555 test files passed
- `git diff --check`


### Git Commits

| Hash | Message |
|------|---------|
| `df8c3b3d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 625: 三证结算干跑判断

**Date**: 2026-05-29
**Task**: 三证结算干跑判断
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
| --- | --- |
| OpenSpec 设计 | 新增 `design-three-evidence-turn-settlement` 顶层三证结算设计，明确 terminal/state/progress/reconciliation 证据、会话隔离、纯决策 helper、Phase 1-3 rollout。 |
| Phase 1 实现 | 新增 `implement-three-evidence-dry-run-settlement`，实现 `evaluateTurnSettlement(evidence, policy, nowMs)` pure helper，只输出 dry-run decision，不改 lifecycle state。 |
| 前端接入 | 在 `useThreadEventHandlers` 的 completed settlement 和 Codex no-progress suspicion 路径写入 `three-evidence-dry-run` 诊断；`wouldCleanupResidue` 和 `wouldRequestReconciliation` 都只观测，不清理、不请求 backend。 |
| 错误日志 | `clientErrorLog` 仅持久化异常 dry-run decision，跳过正常 `wouldSettle`，避免全局日志噪音。 |
| Review 补充 | Review 时发现 missing-terminal/no-progress 路径未接入 dry-run，已补上并增加边界测试：fresh window 边界按 stale 处理。 |
| 验证 | `openspec validate implement-three-evidence-dry-run-settlement --strict --no-interactive`、`openspec validate design-three-evidence-turn-settlement --strict --no-interactive`、focused Vitest、`npm run typecheck`、`npm run lint -- --max-warnings=0`、`git diff --check`、`npm run test` 全部通过。 |

**Updated Files**:
- `openspec/changes/design-three-evidence-turn-settlement/**`
- `openspec/changes/implement-three-evidence-dry-run-settlement/**`
- `src/features/threads/utils/turnSettlementDecision.ts`
- `src/features/threads/utils/turnSettlementDecision.test.ts`
- `src/features/threads/hooks/useThreadEventHandlers.ts`
- `src/features/threads/hooks/useThreadEventHandlers.test.ts`
- `src/features/debug/utils/clientErrorLog.ts`
- `src/features/debug/utils/clientErrorLog.test.ts`


### Git Commits

| Hash | Message |
|------|---------|
| `2e6a8113` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 626: 三证结算 Phase 2a 状态查询提案

**Date**: 2026-05-29
**Task**: 三证结算 Phase 2a 状态查询提案
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| 项目 | 内容 |
| --- | --- |
| OpenSpec Change | 新增 `design-three-evidence-status-query-reconciliation`。 |
| 目标 | 固化 Phase 2a authoritative status query / reconciliation 设计，只定义“问后端/runtime 真相”的 contract。 |
| 边界 | 不改 `src/**`，不 cleanup loading，不 mark completed，不改 `activeTurnId`，不做 terminal replay，不替换正常 completion path。 |
| 关键设计 | 定义 scoped status query request/response、bounded status enum、scope echo、terminal/running/unknown/query-failed 映射。 |
| 日志线索处理 | 将 `stale_reuse_cleanup`、concurrent runtime acquire timeout、`RUNTIME_RECOVERY_QUARANTINED` 定义为 runtime recovery diagnostic context，不能替代 terminal evidence。 |
| 验证 | `openspec validate design-three-evidence-status-query-reconciliation --strict --no-interactive` 通过。 |

**Updated Files**:
- `openspec/changes/design-three-evidence-status-query-reconciliation/proposal.md`
- `openspec/changes/design-three-evidence-status-query-reconciliation/design.md`
- `openspec/changes/design-three-evidence-status-query-reconciliation/tasks.md`
- `openspec/changes/design-three-evidence-status-query-reconciliation/specs/conversation-lifecycle-contract/spec.md`
- `openspec/changes/design-three-evidence-status-query-reconciliation/specs/engine-runtime-contract/spec.md`
- `openspec/changes/design-three-evidence-status-query-reconciliation/specs/conversation-realtime-client-performance/spec.md`


### Git Commits

| Hash | Message |
|------|---------|
| `2aba361d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 627: 收紧 Composer 输入框与折叠入口

**Date**: 2026-05-29
**Task**: 收紧 Composer 输入框与折叠入口
**Branch**: `feature/v0.5.4`

### Summary

降低主界面 Composer 底部留白和默认输入高度，新增 hover-only 对称折叠入口，并回写 OpenSpec 提案 tune-composer-input-bottom-affordance。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `79517e75` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 628: Phase2a 三证状态查询对账

**Date**: 2026-05-29
**Task**: Phase2a 三证状态查询对账
**Branch**: `feature/v0.5.4`

### Summary

实现 Phase2a 三证状态查询对账：新增 backend/runtime scoped status query，frontend 在 request-reconciliation 时发起会话隔离查询并记录诊断；补齐核心 error-log 落盘与 Rust/Vitest 覆盖。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `6bfc0a21` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 629: 校准 Phase2b 启动标记

**Date**: 2026-05-29
**Task**: 校准 Phase2b 启动标记
**Branch**: `feature/v0.5.4`

### Summary

在三证状态查询对账 OpenSpec design 中补充 PHASE2B_HANDOFF_MARKER，明确 Phase2b 只在 post-Phase2a 真实复现写出 resolved + scoped terminal status + cleanup-residue 后启动，并列出禁止启动信号。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `b2dbddda` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 630: 优化 Codex 会话恢复卡片

**Date**: 2026-05-30
**Task**: 优化 Codex 会话恢复卡片
**Branch**: `feature/v0.5.4`

### Summary

重构 stale thread 恢复卡片的信息层级与主按钮表达，新增 Fork icon+短文案、下一步建议和错误详情弱化展示，并回写 codex-stale-thread-binding-recovery OpenSpec 契约。验证通过 Vitest 目标测试、typecheck、lint、large-file check 与 OpenSpec strict validate。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `0b677057` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 631: 消息尾部操作图标接线

**Date**: 2026-05-30
**Task**: 消息尾部操作图标接线
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| Item | Summary |
|------|---------|
| Feature | Added assistant message tail actions: copy on assistant replies, fork and rewind only on the latest final assistant reply. |
| Fork | Reused the shared composer fork flow via `startFork("/fork")` after a common confirmation dialog. |
| Rewind | Routed latest assistant tail rewind into the existing anchored rewind confirmation flow. |
| UI | Rendered compact borderless icon-only tail actions on a separate row below the final-message marker. |
| Spec | Added OpenSpec change `add-message-tail-action-icons` with proposal, design, tasks, and behavior delta. |
| Tests | Covered latest-only fork/rewind visibility, fork confirmation behavior, app-shell fork adapter reuse, and rewind request handling. |

**Validation**:
- `npx vitest run src/app-shell-parts/useAppShellLayoutNodesSection.test.ts`
- `npm run lint`
- `openspec validate add-message-tail-action-icons --strict --no-interactive`
- `git diff --check`
- Human test passed before commit.

**Commit**: `5a50bda2 feat(messages): 增加消息尾部操作图标`


### Git Commits

| Hash | Message |
|------|---------|
| `5a50bda2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 632: v0.5.4 收口提交

**Date**: 2026-05-30
**Task**: v0.5.4 收口提交
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| Item | Summary |
|------|---------|
| Composer UI | Removed the top border from the chat input toolbar for a cleaner compact composer surface. |
| Changelog | Updated the v0.5.4 changelog date and release notes with diagnostics, transparency, composer compactness, and related fixes. |

**Validation**:
- `git diff --check`
- Human confirmed continuing submission.

**Commits**:
- `e75b243d style(composer): 去掉输入区工具栏顶部边框`
- `3fb684e2 docs(changelog): 更新 v0.5.4 变更日志`


### Git Commits

| Hash | Message |
|------|---------|
| `e75b243d` | (see git log) |
| `3fb684e2` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 633: 清理启动诊断与环境恢复噪声

**Date**: 2026-05-30
**Task**: 清理启动诊断与环境恢复噪声
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| Area | Summary |
|------|---------|
| Optional visual effects | Removed liquid-glass plugin calls, npm dependency, Tauri dependency, and capability grant. Kept window effects cleanup as bounded client warning. |
| Environment doctor | Added cross-platform executable diagnosis, Windows wrapper classification for cmd/bat/ps1/exe, redacted proxy evidence, and actionable local probe categories. |
| Session recovery | Added typed `[FORK_TARGET_NOT_FOUND]` Codex rewind error and frontend stale-target diagnostic classification. |
| UI cleanup | Hid successful `unknown` network state, hid unset proxy rows, and added i18n labels for environment/network diagnosis. |
| OpenSpec | Added and completed `harden-client-runtime-environment-recovery` artifacts with implementation notes aligned to actual scope. |

Validation:
- `openspec validate harden-client-runtime-environment-recovery --strict --no-interactive`
- `npm exec vitest run src/features/settings/components/settings-view/sections/CodexSection.test.tsx src/features/settings/components/SettingsView.test.tsx`
- `npm run typecheck`
- `cargo test --manifest-path src-tauri/Cargo.toml backend::app_server_cli::tests --lib`
- `cargo test --manifest-path src-tauri/Cargo.toml codex::doctor::tests --lib`
- `git diff --check`


### Git Commits

| Hash | Message |
|------|---------|
| `ebb5966f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 634: 支持关闭当前会话快捷键

**Date**: 2026-05-30
**Task**: 支持关闭当前会话快捷键
**Branch**: `feature/v0.5.4`

### Summary

新增可配置的关闭当前打开会话快捷键，默认 Command+W，并补齐 OpenSpec 提案、设计、spec delta 与任务记录。

### Main Changes

| Area | Detail |
|------|--------|
| Shortcut | Added `closeCurrentSessionShortcut`, defaulting to `cmd+w`. |
| Behavior | The shortcut mirrors clicking the active topbar session tab `X`; it closes only the open tab and does not stop, delete, or archive the session. |
| Settings | Added Settings -> Shortcuts metadata, icon, and i18n labels for the close-current-session command. |
| OpenSpec | Created `openspec/changes/add-close-current-session-shortcut/` with proposal, design, spec deltas, and completed tasks. |

**Testing**:
- [OK] Human reported tests passed.


### Git Commits

| Hash | Message |
|------|---------|
| `2192844c` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 635: 持久化三证对账早期信号

**Date**: 2026-05-30
**Task**: 持久化三证对账早期信号
**Branch**: `feature/v0.5.4`

### Summary

修复全局 error-log 持久化筛选缺口：把 Codex no-progress watchdog 命中和三证对账 query-requested 早期面包屑写入 ~/.ccgui/error-log，补充回归测试，并在 Phase2a 设计里标明后续判断路径。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `ceafd660` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 636: 接通 Web 添加工作区远端路径输入

**Date**: 2026-05-30
**Task**: 接通 Web 添加工作区远端路径输入
**Branch**: `feature/v0.5.4`

### Summary

修复 Web service runtime 下添加工作区无法获取远端路径的问题，补充 OpenSpec change、frontend 分支、i18n 与 focused tests。

### Main Changes

| Area | Details |
|------|---------|
| OpenSpec | Created `fix-web-service-add-workspace-path-entry` with proposal, design, delta spec, and implementation tasks. |
| Frontend | Added Web service runtime branch in `useWorkspaceActions.handleAddWorkspace` to collect a manual daemon-machine absolute path before reusing `handleAddWorkspaceFromPath`. |
| i18n | Added zh/en prompt copy for daemon-machine absolute path entry. |
| Tests | Added focused coverage for Web service manual path, blank input, cancel input, and preserved desktop picker path. |
| Validation | `openspec validate --all --strict --no-interactive` passed with 307 passed / 0 failed; `npx vitest run src/features/app/hooks/useWorkspaceActions.test.tsx` passed with 14 tests. `npm run typecheck` remains blocked by pre-existing `SettingsView.test.tsx` fixture field `closeCurrentSessionShortcut`, outside this change. |
| Boundary | Did not change daemon RPC, Web shim dialog behavior, remote file browsing, path mapping, storage schema, or engine runtime payload. |


### Git Commits

| Hash | Message |
|------|---------|
| `d16da027` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 637: 接入 Codex goal 命令面板入口

**Date**: 2026-05-30
**Task**: 接入 Codex goal 命令面板入口
**Branch**: `feature/v0.5.4`

### Summary

收敛 /goal UX 方案：保留普通发送语义，仅在 Codex 命令面板展示 /goal、/goal pause、/goal resume、/goal clear，并回写 OpenSpec proposal/design/spec/tasks。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `46de74db` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 638: 标记 Codex goal 手工验证完成

**Date**: 2026-05-30
**Task**: 标记 Codex goal 手工验证完成
**Branch**: `feature/v0.5.4`

### Summary

根据人工测试结果回写 add-codex-goal-slash-command-ux tasks，将 /goal 命令面板展示与普通发送路径验证标记为完成。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `e7061617` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 639: 修复命令补全快捷发送

**Date**: 2026-05-30
**Task**: 修复命令补全快捷发送
**Branch**: `feature/v0.5.4`

### Summary

清理 Composer 工作区变更，仅保留命令补全打开时 Cmd/Ctrl+Enter 仍可按配置发送的修复，并补齐 Composer 发送回调的 selectedEngine 依赖。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `c2ac6c00` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 640: 收口文件树 fallback 根层快照

**Date**: 2026-05-30
**Task**: 收口文件树 fallback 根层快照
**Branch**: `feature/v0.5.4`

### Summary

修复 v0.5.4 review 发现的 workspace 文件树 legacy fallback 根层污染问题，并完成 targeted 验证。

### Main Changes

- 目标：对 v0.5.4 相关代码做边界/跨平台 review 后，修复确认的小问题并提交。
- 主要改动：`useWorkspaceFiles` legacy fallback 改为只应用 root-only snapshot；root child 判断同时排除 `/` 和 `\\`；fallback debug payload 保留 fullSnapshot 计数用于排查。
- 测试更新：`useWorkspaceFiles.test.tsx` 将 legacy fallback 断言改为 root-only，并加入 Windows-style `\\` 路径样本，防止跨平台路径误判。
- Backend 收口：`cc_gui_daemon/file_access.rs` 对 blocking workspace scan join 成功值显式 `Ok(...)` 包装，保持 command 返回契约清晰。
- 验证：`npm exec vitest run src/features/workspaces/hooks/useWorkspaceFiles.test.tsx` 通过；`npm run typecheck` 通过；`cargo check --manifest-path src-tauri/Cargo.toml` 通过；相关 Rust root directory tests 通过；large-file hard gate found=0；large-file near-threshold 仅保留既有 19 个 watch；large-file/heavy-test-noise parser tests 通过；`git diff --check` 通过。
- 注意：record 前工作区另有非本次变更 `src/features/threads/hooks/useThreadEventHandlers.ts`、`src/features/debug/utils/clientErrorLog.ts`，本次未触碰、未提交。


### Git Commits

| Hash | Message |
|------|---------|
| `24780685` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 641: 记录 Codex 无进展 watchdog 生命周期

**Date**: 2026-05-30
**Task**: 记录 Codex 无进展 watchdog 生命周期
**Branch**: `feature/v0.5.4`

### Summary

为 Codex no-progress watchdog 增加 scheduled/fired/skipped 生命周期诊断，并把 codex-no-progress-watchdog-* 写入全局 error-log；补充 hook 与 error-log 回归测试，更新 Phase2a 设计里的下一步排查依据。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `f2cf941d` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 642: 收窄 watchdog 持久化日志范围

**Date**: 2026-05-30
**Task**: 收窄 watchdog 持久化日志范围
**Branch**: `feature/v0.5.4`

### Summary

Review 后修正 Codex no-progress watchdog 生命周期观测的全局日志范围：scheduled 仅保留在内存 debug stream，error-log 只持久化 fired/skipped，避免正常 progress reschedule 高频刷 ~/.ccgui/error-log；补充过滤测试并更新 Phase2a 设计说明。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `de9efefc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 643: 收口 0.5.4 OpenSpec 归档状态

**Date**: 2026-05-30
**Task**: 收口 0.5.4 OpenSpec 归档状态
**Branch**: `feature/v0.5.4`

### Summary

归档 0.5.4 已完成 OpenSpec changes，刷新主 specs、project snapshot 与 changelog；保留 launch profile 手测项和 0.5.5 orchestration center 规划项。

### Main Changes

## 本次工作

- 归档 13 个已完成的 0.5.4 OpenSpec changes，并同步 delta specs 到主 specs。
- 刷新 `openspec/project.md`：active=2、archive=391、specs=299。
- 补充 `CHANGELOG.md` 中 0.5.4 的 close-current-session shortcut、Codex goal command discovery、runtime diagnostics/environment recovery、Web workspace path entry、filetree fallback 等条目。
- 新增并保留 `add-agent-task-orchestration-center` 作为 0.5.5 规划/执行 change，不纳入 0.5.4 release gate。
- 保留 `add-codex-structured-launch-profile` active，等待真实 desktop manual matrix 后再归档。

## 验证

- `npm run typecheck` passed。
- `git diff --check` passed。
- `openspec validate --all --strict --no-interactive` passed：301 passed, 0 failed。

## Commit

- `b4453658 docs(openspec): 收口 0.5.4 归档状态`


### Git Commits

| Hash | Message |
|------|---------|
| `b4453658` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 644: 拆分线程事件处理辅助逻辑

**Date**: 2026-05-31
**Task**: 拆分线程事件处理辅助逻辑
**Branch**: `feature/v0.5.4`

### Summary

将 useThreadEventHandlers 中的 options 类型与 terminal event helper 抽离为独立模块，降低 hook 文件复杂度。

### Main Changes

- 提交：7db221a7 refactor(threads): 拆分线程事件处理辅助逻辑
- 改动：新增 threadEventHandlerTypes.ts 承载 ThreadEventHandlersOptions；新增 threadTerminalEventHelpers.ts 承载 foreground terminal event method set 与 thread/turn/result extraction helpers；useThreadEventHandlers.ts 改为导入这些 helper。
- 影响：纯结构性重构，不改变线程事件运行时行为。
- 验证：提交前已运行 Project Map 聚焦测试 5 个文件 123 tests passed；本提交为 threads 纯拆分，未单独发现 whitespace 问题。


### Git Commits

| Hash | Message |
|------|---------|
| `7db221a7` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 645: 强化待整理发现的 AI 整理候选

**Date**: 2026-05-31
**Task**: 强化待整理发现的 AI 整理候选
**Branch**: `feature/v0.5.4`

### Summary

为 Project Map 待整理发现增加 AI organizer、parent-move 候选、安全确认与批量采纳能力。

### Main Changes

- 提交：54ea3040 feat(project-map): 强化待整理发现的 AI 整理候选
- 改动：新增 projectMapNodeOrganizer 服务与测试；增加 organizer run metadata、parentMove candidate 类型、单个/批量候选确认安全校验、Unassigned Discoveries 入口、任务抽屉结果解释、candidate badge 导航、Accept all 操作、双语文案与样式。
- 影响：AI organizer 只生成 review candidates，不直接修改拓扑；parent move confirmation 会校验 source parent、target parent、cycle、root flattening 与 hierarchy fit。
- 验证：npm exec vitest run src/features/project-map/services/projectMapNodeOrganizer.test.ts src/features/project-map/utils/candidates.test.ts src/features/project-map/hooks/useProjectMapDataset.test.tsx src/features/project-map/services/projectMapGenerationWorker.test.ts src/features/project-map/components/ProjectMapPanel.test.tsx；5 files / 123 tests passed。


### Git Commits

| Hash | Message |
|------|---------|
| `54ea3040` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 646: 同步项目地图整理体验规范

**Date**: 2026-05-31
**Task**: 同步项目地图整理体验规范
**Branch**: `feature/v0.5.4`

### Summary

同步 Project Map organizer、hierarchy hardening 与 OpenSpec archive/main spec 记录。

### Main Changes

- 提交：1a4d56cc docs(openspec): 同步项目地图整理体验规范
- 改动：新增 harden-project-map-organizer-review-ux change artifacts；归档 2026-05-30 add-project-map-ai-node-organizer 与 stabilize-project-map-hierarchy；同步 project-map-incremental-generation 与 project-xray-panel 主 spec。
- 影响：OpenSpec behavior truth 与刚提交的 Project Map organizer 实现对齐，记录 AI organize、parent-move candidate、batch accept、unsafe skip、root hierarchy preservation 等约束。
- 验证：openspec validate --all --strict --no-interactive；302 passed, 0 failed。


### Git Commits

| Hash | Message |
|------|---------|
| `1a4d56cc` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 647: 补齐三证查询超时收口

**Date**: 2026-05-31
**Task**: 补齐三证查询超时收口
**Branch**: `feature/v0.5.4`

### Summary

Phase 2a reconciliation status query 增加 15 秒诊断 timeout，悬挂时写入 query-failed 终态日志；保持诊断旁路，不清理 processing/activeTurnId，并补充 Vitest 与 OpenSpec 约束。

### Main Changes

(Add details)

### Git Commits

| Hash | Message |
|------|---------|
| `2017a5ab` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 648: 收敛助手回复复制入口

**Date**: 2026-05-31
**Task**: 收敛助手回复复制入口
**Branch**: `feature/v0.5.4`

### Summary

调整 conversation message action：assistant 分段回复只在最终消息显示复制按钮，并复制整轮 assistant 文本；补充 OpenSpec change refine-conversation-message-copy-actions 与 focused Messages 测试。

### Main Changes

- 修改 `src/features/messages/components/Messages.tsx`：在 `effectiveItems` 上派生 final assistant id -> turn copy text 映射，复制边界为最近 user message 后到 final assistant message。
- 修改 `src/features/messages/components/MessagesTimeline.tsx`：assistant tail action 仅在 `isFinal === true` 的 assistant row 渲染，copy 使用聚合 payload。
- 修改 `src/features/messages/components/Messages.test.tsx`：覆盖 segmented assistant turn 只在 final row 有 assistant copy action，且 clipboard 写入完整 assistant turn 文本。
- 新增 `openspec/changes/refine-conversation-message-copy-actions/`：proposal、design、delta spec、tasks，固化 conversation-message-actions contract。
- 验证：`openspec validate refine-conversation-message-copy-actions --strict --no-interactive`、`npx vitest run --maxWorkers 1 --minWorkers 1 src/features/messages/components/Messages.test.tsx`、`npm run typecheck` 均通过。


### Git Commits

| Hash | Message |
|------|---------|
| `f7ca349f` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 649: 修复自动会话可见性元数据链路

**Date**: 2026-05-31
**Task**: 修复自动会话可见性元数据链路
**Branch**: `feature/v0.5.4`

### Summary

(Add summary)

### Main Changes

| 类别 | 内容 |
|------|------|
| 代码提交 | `33839580 fix(session): 修复自动会话可见性元数据链路` |
| 任务 | `05-31-classify-auto-session-visibility` 已完成并归档 |
| 主要修复 | daemon RPC 解析并传递 `autoSession`，Codex/Claude/OpenCode/Gemini 自动会话 metadata 统一落盘 |
| 边界处理 | 增加非法 `session_id`、空 `sessionPurpose`、路径型 `ownerFeature` 的拒绝测试，确保失败不写索引 |
| 前端契约 | 普通用户线程不发送空 metadata；PR question、project-map generation、review fallback 使用明确 auto-session metadata |
| 跨平台 | 保持 `Path`/`PathBuf` 路径处理，避免硬编码分隔符；Windows 样例路径相关测试在 heavy gate 中通过 |
| 验证 | `npm run check:heavy-test-noise`、`npm run check:large-files:gate`、`npm run check:large-files:near-threshold`、`npm run typecheck`、`cargo fmt --manifest-path src-tauri/Cargo.toml --check`、`cargo test --manifest-path src-tauri/Cargo.toml auto_session_metadata -- --nocapture`、`git diff --check` 均通过 |


### Git Commits

| Hash | Message |
|------|---------|
| `33839580` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 650: 修复 daemon helper read runtime 守卫

**Date**: 2026-05-31
**Task**: 修复 daemon helper read runtime 守卫
**Branch**: `feature/v0.5.4`

### Summary

为 daemon Codex helper read 接入 RuntimeManager acquire/recovery guard，补充 acquiring 状态回归测试，并验证 OpenSpec 与 runtime contract。

### Main Changes

## 本次完成
- 为 daemon `DaemonState` 增加 `Arc<RuntimeManager>`，初始化时复用 `runtime_orphan_sweep_on_launch` 设置。
- 将 daemon `connect_workspace_core` 从 `runtime_manager=None` 改为传入 shared manager。
- 新增 helper 专用 `connect_codex_workspace_session`，只在 Codex helper read 需要时强制 Codex session，保留普通 connect 对 Claude/Gemini/OpenCode 的兼容轻量路径。
- `model_list` 与 `account_rate_limits` 在 live request 前确保进入 guarded Codex session。
- stale session cleanup / rewind reconnect 改为通过 runtime manager attribution。
- 新增 shared core 回归测试，断言有 runtime manager 时 connect 会记录 `RuntimeLifecycleState::Acquiring`。

## 验证
- `cargo fmt --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml connect_workspace_with_runtime_manager_records_acquiring_before_spawn_completes -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml explicit_connect_with_runtime_manager_does_not_loop_or_quarantine -- --nocapture`
- `cargo test --manifest-path src-tauri/Cargo.toml begin_runtime_acquire_or_retry -- --nocapture`
- `npm run typecheck`
- `npm run check:runtime-contracts`
- `openspec validate fix-runtime-acquire-helper-read-regression --strict --no-interactive`

## 边界
- 未修改 frontend command name / payload shape。
- 未修改 runtime state-machine API。
- 未将 Claude/Gemini/OpenCode 普通 daemon connect 改为强制 Codex runtime。
- 未纳入无关工作区改动：`.agents/skills/huashu-design/SKILL.md`、`openspec/changes/add-file-tab-detached-open/`。


### Git Commits

| Hash | Message |
|------|---------|
| `0cf871b1` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete


## Session 651: 修复文件 tab 独立窗口拖拽与多实例

**Date**: 2026-05-31
**Task**: 修复文件 tab 独立窗口拖拽与多实例
**Branch**: `feature/v0.5.4`

### Summary

修复从文件 tab 打开的 detached file explorer 多实例、默认折叠 sidebar 与动态 Tauri window label capability，补齐 OpenSpec 和 Trellis contract。

### Main Changes

## 完成内容
- 文件 tab 新增独立窗口打开入口，使用当前 tab path 创建新的 detached file explorer 实例。
- 普通 `file-explorer` 入口继续 open-or-focus；tab 入口使用 `file-explorer-*` 动态 label 和 per-window session key。
- tab detached window 默认折叠 file tree sidebar，并修复 per-window session 异步恢复后默认折叠不生效的问题。
- 修复动态 `file-explorer-*` 窗口未覆盖 Tauri capability 导致拖拽异常的问题，保持与原独立文件窗口相同 menubar drag contract。
- 回写 OpenSpec change `add-file-tab-detached-open`，并在 `.trellis/spec/frontend/quality-guidelines.md` 沉淀动态 WebviewWindow label capability contract。

## 验证
- `npx vitest run src/features/files/detachedFileExplorer.test.ts src/features/files/components/DetachedFileExplorerWindow.test.tsx src/features/files/components/FileViewPanel.test.tsx src/features/files/components/FileExplorerWorkspace.test.tsx src/router.test.tsx`：通过，5 files / 86 tests。
- `npm run typecheck`：通过。
- `git diff --check && openspec validate add-file-tab-detached-open --strict --no-interactive`：通过。
- `npm run lint`：0 errors，1 个既有 warning：`src/features/composer/components/Composer.tsx` 的 `selectedEngine` hook dependency warning，非本次改动。

## 边界确认
- 不改变 OpenAppMenu 外部编辑器打开语义。
- 不改变普通 detached explorer 的单窗口复用语义。
- 不把文件内容 header/tab strip 改成窗口拖拽区，避免点击与拖拽语义冲突。


### Git Commits

| Hash | Message |
|------|---------|
| `586f12eb` | (see git log) |

### Testing

- [OK] (Add test results)

### Status

[OK] **Completed**

### Next Steps

- None - task complete
