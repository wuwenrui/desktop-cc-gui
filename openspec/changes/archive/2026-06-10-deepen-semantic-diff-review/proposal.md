## Why

第一版 turn-level `语义 diff` 已经解决“哪一轮对话产生了哪些产物”的基础问题，但当前内容主要来自 diff hunk 的有限规则抽取，验证证据尚未接入，风险说明偏泛，用户无法继续下钻到每条结论的证据来源。为了让这个模块从“可看摘要”升级为“可信任的 review surface”，需要补齐事实采集、验证关联、证据明细和后续 AI review 的结构化契约。

## What Changed

- 将语义 diff 的数据模型从单纯 i18n summary item 扩展为带 evidence refs 的 fact item。
- 接入同一 conversation turn 内的命令执行证据，区分“检测到测试文件”与“验证命令已成功/失败/未接入”。
- 扩展 deterministic extractor，覆盖 React/TypeScript、通用函数/类型导出、Spring route/handler、测试断言、配置键等常见产物事实。
- 在语义 diff UI 中为每条结论展示一行可追溯证据；文件证据可点击打开到对应行号，避免重复展示同一路径。
- 新增 AI review contract：允许后续把模型生成的 review 作为 explain layer 接入，但每条 AI 结论必须带 evidence refs，且不得覆盖确定性事实。

## Scope

### In Scope

- Session Activity turn artifact semantic summary model and UI.
- Feature-local deterministic extraction from existing diff/tool/command evidence.
- Command validation evidence association within the same turn.
- Evidence refs for semantic facts.
- One-line evidence UI with file-line navigation for file-backed facts.
- AI review data contract and bounded merge path; no automatic model call in this change.
- Focused unit/component tests.

### Out Of Scope

- 实际调用 LLM 生成 review。
- 新增后端 command 或持久化 schema。
- 自动执行验证命令。
- 阻塞 Git 操作或改变 commit selection。
- 替代传统 line diff viewer。

## Impact

- Affected frontend: `src/features/git/utils/semanticDiffSummary.ts`, `src/features/session-activity/components/WorkspaceSessionActivityPanel.tsx`, `src/features/session-activity/types.ts`, `src/i18n/locales/*part5.ts`, focused tests.
- Backend impact: none.
- Runtime contract impact: none.

## Validation Plan

- `openspec validate deepen-semantic-diff-review --strict --no-interactive`
- `npx vitest run src/features/git/utils/semanticDiffSummary.test.ts src/features/session-activity/components/WorkspaceSessionActivityPanel.test.tsx`
- `npm run lint`
- `npm run typecheck`
