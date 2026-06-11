## Why

传统 diff 是开发者信任改动的底层证据，但它只解释“哪几行变了”，不解释“这是哪一轮 AI 对话产生的产物、为什么改、影响了哪些行为、有没有破坏约定、验证过什么”。AI 参与改动后，用户需要在会话活动里直接看到每一轮对话对应的产物与意图，而不是跳到文件 diff viewer 才理解改动。

## What Changed

- 将会话活动顶部分类中的“文件”改为“产物”。
- 在每个对话轮次内聚合 file-change events，去重压缩为一个 turn-level 产物模块。
- 合并旧的 `File change` 卡片和内部文件行，轮次内只显示文件列表，不再为每个 file-change event 额外渲染一张卡片。
- 在同一轮次的产物模块中提供 `产物 / 语义 diff` tabs。
- 语义 diff 基于当前轮次的 changed files 和 diff evidence 派生，展示变更意图、行为变化、潜在风险、验证状态。
- 传统 line diff 仍通过文件行的 diff preview/open 行为进入，不在 Git diff viewer 顶部额外展示语义面板。

## Latest Requirement Writeback

- Turn artifact module header MUST compress kicker、title、file statistics and tabs into one horizontal row where space allows; avoid three stacked metadata points that repeat the same meaning.
- The `语义 diff` tab MUST use a one-column information layout to reduce horizontal waste in the conversation activity panel.
- The `语义 diff` tab MUST include `本轮语义 / Turn meaning`, sourced from the user message that initiated the turn when available. The content is user-authored conversation text, not an inferred implementation fact, and MUST be rendered as escaped UI text.
- The turn artifact module MUST use a minimal flat visual treatment: no outer card border, no inset/raised shadow, no framed tab rail, and no section card backgrounds that create a concave/convex surface.
- Turn artifact contents MUST align closer to the conversation body; left indentation and file-row padding should be compact enough that the artifact list does not appear detached from the turn.
- The `产物 / 语义 diff` tab controls MUST include leading icons so the right-side tab switcher remains quickly scannable after the visual chrome is removed.
- The purpose of the UI is turn attribution: users should be able to answer “which conversation turn produced which artifacts, and why those files were changed” without reading raw line diff first.

## Scope

### In Scope

- Session Activity turn-level artifact aggregation and tab UI.
- 基于文件路径、状态、diff 内容和改动统计生成语义摘要。
- 前端 UI、i18n、focused unit tests。

### Out Of Scope

- LLM 语义审查生成。
- 后端 command / storage contract。
- 自动读取 CI、terminal、session journal 作为验证证据。
- 改动应用、提交、回滚逻辑。
- 在 standalone Git diff viewer 顶部展示语义 diff panel。

## Impact

- Affected frontend: `src/features/session-activity/**`, `src/features/git/utils/semanticDiffSummary.ts`, `src/styles/session-activity.css`, `src/i18n/locales/*part5.ts`
- Backend impact: none.
- Runtime contract impact: none.

## Validation Plan

- `openspec validate add-semantic-diff-review --strict --no-interactive`
- `npx vitest run src/features/session-activity/components/WorkspaceSessionActivityPanel.test.tsx src/features/git/utils/semanticDiffSummary.test.ts`
- `npm run typecheck`
