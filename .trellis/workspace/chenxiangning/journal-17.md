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
