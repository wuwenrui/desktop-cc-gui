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
