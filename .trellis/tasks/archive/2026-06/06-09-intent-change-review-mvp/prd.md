# Intent Change Review MVP

## Goal

让用户在会话活动中直接看到每一轮 AI 对话产生了哪些产物、为什么改这些文件、影响了哪些行为、有什么风险、验证证据在哪里。传统 line diff 继续保留，但语义 diff 必须放回对应 conversation turn，而不是作为全局 Git diff viewer 面板。

## What I Already Know

- 用户明确不接受泛泛而谈的“语义 diff”，尤其反感只说“更新 N 个文件 / 触及源码行为”。
- 用户的新要求是：
  - `文件` 改成 `产物`。
  - 每轮会话里显示文件改动去冗余和压缩，只保留文件列表。
  - 合并旧 `File change` card 和下方具体文件列表。
  - 图 2 的语义 diff 放在对话轮次里，通过 tab 展示。
  - 核心目标是知道 AI 在哪一轮对话改了哪些文件，以及为什么改、意图是什么。
- 传统 diff 仍是可信证据，但它应该从文件行进入，不应抢占会话轮次语义。
- OpenSpec change: `add-semantic-diff-review`。

## Assumptions

- MVP 不直接调用模型生成语义审查，先提供基于 hunk / code token evidence 的确定性事实抽取。
- 语义摘要必须明确置信与证据边界，不能把未验证内容说成已验证。
- 无法抽取具体事实时，UI 只提示需要查看 hunk，不编造业务意图。

## Requirements

- Session Activity 顶部 category 中 `文件 / File` 改为 `产物 / Artifacts`。
- 同一个 turn 内的 file-change events 聚合成一个 turn-level artifact module。
- 同一路径文件去重压缩，只保留一行文件入口。
- 不再渲染独立 `File change` timeline card，避免与文件列表重复。
- turn artifact module 提供 `产物 / 语义 diff` tabs。
- turn artifact header 合并为单行，减少 kicker、title、stats、tabs 的垂直冗余。
- `语义 diff` tab 使用单列内容布局，优先节省空间。
- `语义 diff` tab 顶部增加 `本轮语义`，从当前 turn 的用户消息提取压缩文本，并作为普通文本转义展示。
- `语义 diff` tab 展示 intent / behavior / risk / validation 四组内容。
- 摘要优先从当前 turn 的 diff hunk 抽取具体代码事实，例如 exception handler、HTTP status、response envelope、endpoint mapping、export/public declaration。
- 文件类型/行数只能作为兜底或风险提示，不能作为主要语义内容。
- 验证状态缺少外部命令证据时，明确显示“未接入验证证据”。
- 文件行仍可打开实际文件位置或传统 diff preview。

## Acceptance Criteria

- [x] 顶部分类显示 `产物 / Artifacts`，不再显示 `文件 / File`。
- [x] 展开的 turn 中只显示一个 artifact module，文件列表按路径去重。
- [x] `fileChange` events 不再作为独立 timeline card 渲染。
- [x] artifact module 的 semantic tab 位于同一个 turn 内。
- [x] artifact module header 合并为紧凑单行。
- [x] semantic tab 使用单列 layout。
- [x] semantic tab 展示转义后的本轮语义。
- [x] Spring exception handler 等 hunk 能显示具体 handler、exception、HTTP status、response body contract。
- [x] 无验证证据时不会显示“已验证”。
- [x] 有 focused unit/component tests 覆盖语义摘要派生与 turn artifact UI。

## Definition Of Done

- Focused tests pass.
- Typecheck passes or skipped reason recorded.
- Lint passes or skipped reason recorded.
- Large-file guard passes or skipped reason recorded.
- OpenSpec change validates strictly.
- Behavior/spec artifacts updated.

## Out Of Scope

- 不在本次接入 LLM 生成审查结论。
- 不新增后端 command 或持久化格式。
- 不自动判断 API 兼容性或运行测试命令历史。
- 不替代传统 diff 和现有 commit/stage/revert 操作。
- 不在 standalone Git diff viewer 顶部新增语义 diff panel。

## Technical Notes

- Primary frontend files:
  - `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx`
  - `src/features/git/utils/semanticDiffSummary.ts`
  - `src/styles/session-activity.css`
  - `src/i18n/locales/en.part5.ts`
  - `src/i18n/locales/zh.part5.ts`
