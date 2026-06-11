# Deepen Semantic Diff Review

## Goal

把第一版 turn-level 语义 diff 从“可看摘要”推进到“可追溯 review surface”：接入同 turn 验证命令证据、扩展 deterministic extractor、为每条结论提供 evidence refs，并预留结构化 AI review contract，但本轮不自动调用模型。

## What I Already Know

- 第一版语义 diff 已经可接受，用户希望继续深耕。
- 当前机制不是 AI 对答过程中生成并存储语义 diff，而是从 conversation items、tool file changes 和 diff hunks 确定性派生。
- 用户要求“全部内容都做”，但不提交，由用户验收。
- OpenSpec change: `deepen-semantic-diff-review`。

## Requirements

- 接入同一 turn 的 validation command evidence。
- 扩展 semantic fact model，带 source 和 structured evidence refs。
- 扩展 extractor：TypeScript/React/test/config/general symbol facts。
- UI 展示 compact evidence line。
- Evidence UI 合并为单行，文件证据可点击打开到对应行号。
- AI review 只做 contract 和 merge guard，不自动调用模型。
- 保留当前平铺极简视觉。

## Acceptance Criteria

- [x] semantic summary item 包含 source/evidence refs。
- [x] 同 turn 的 test/lint/typecheck/openspec command 能显示为验证证据。
- [x] test 文件变更不会被误说成测试已执行。
- [x] TS/React/test/config hunks 能抽取具体事实。
- [x] AI review facts 无 evidence refs 时被丢弃。
- [x] Evidence label/ref 不重复显示，文件证据可点击打开到行号。
- [x] focused tests 覆盖上述行为。
- [x] OpenSpec strict validation passes。
- [x] 按用户要求提交并 push。

## Definition Of Done

- Focused Vitest passes.
- Lint/typecheck run or skipped reason recorded.
- OpenSpec validation passes.
- Code commit created and pushed.

## Out Of Scope

- 不自动调用 LLM。
- 不新增后端 command 或持久化 schema。
- 不自动执行验证命令。
- 不修改 Git commit/stage/revert 行为。

## Technical Notes

- Main files: `src/features/git/utils/semanticDiffSummary.ts`, `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx`, locale files, tests.
- Current data path: `ConversationItem[] -> buildWorkspaceSessionActivity -> SessionActivityEvent[] -> buildTurnArtifactSummary -> buildSemanticDiffSummary`.
