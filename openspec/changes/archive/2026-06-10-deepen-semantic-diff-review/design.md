## Design Goals

- 让语义 diff 成为可追溯的 review surface，而不是不可验证的自然语言总结。
- 所有事实优先来自 deterministic evidence：diff hunk、文件路径、工具 item、命令执行结果、用户 turn 文本。
- AI review 只能作为 explain layer，必须引用 evidence refs，不能替代或覆盖事实层。
- 验证状态必须严格区分：检测到测试文件、检测到验证命令、验证命令成功、验证命令失败、验证证据未接入。

## Data Flow

```text
ConversationItem[]
  -> buildWorkspaceSessionActivity(): tool/message/reasoning/command/fileChange events
  -> WorkspaceSessionActivityPanel.buildTurnArtifactSummary(events)
  -> SemanticDiffEntry[] + TurnValidationEvidence[] + optional AI review facts
  -> buildSemanticDiffSummary(input)
  -> semantic facts with evidenceRefs
  -> UI renders grouped facts + one-line actionable evidence
```

## Semantic Fact Model

Each semantic item carries:

- `textKey` and `values`: localized copy contract.
- `evidenceKey`: compact evidence label copy.
- `confidence`: `high | medium | low`.
- `evidenceRefs`: structured refs such as file path, diff hunk line, command text/status, user message, or AI review source.
- `source`: `rule | command | ai`.

## Evidence UI Contract

The semantic review surface renders each fact with a single evidence meta line:

- File-backed refs render as `Evidence: <path:line>` and use the structured `path` / `line` fields for navigation.
- Clicking file-backed evidence opens the referenced file and line through the existing activity file navigation path.
- Command-backed refs render the command label in the same evidence line and do not create a second chip row.
- Long paths wrap inside the available surface; they are not truncated with ellipsis and must not overflow the panel.
- Multiple refs are summarized with a bounded `+N evidence refs` suffix instead of duplicating the primary path.

## Validation Evidence Association

A command event in the same turn can become validation evidence when command text matches known validation intent:

- tests: `vitest`, `jest`, `npm test`, `pnpm test`, `cargo test`, `go test`, `pytest`, `mvn test`, `gradle test`.
- lint/typecheck: `npm run lint`, `eslint`, `tsc`, `npm run typecheck`.
- spec/contract: `openspec validate`, `check:runtime-contracts`, `doctor:strict`, `check:large-files`.

Status handling:

- completed validation command => validation success fact.
- failed validation command => validation risk/failure fact.
- test/spec files changed without command => medium-confidence validation hint, not success.
- no command evidence => explicit not-connected fact.

## Extractor Expansion

Deterministic extractors should remain small and evidence-based:

- Java/Spring: exception handlers, HTTP status, response envelope, endpoint mapping.
- TypeScript/React: exported symbols, React components, hooks, event handlers, state hooks.
- Tests: `describe` / `it` / `test` names and assertion presence.
- Config: added or changed top-level keys where extractable.
- General deletion/config/large-change/test-gap risks remain as fallback hints.

## AI Review Contract

No model call is performed in this change. The contract permits future callers to pass structured AI review facts:

```ts
type TurnSemanticReview = {
  source: "ai";
  generatedAt: number;
  facts: Array<{
    category: "intent" | "behavior" | "risk" | "validation";
    text: string;
    confidence: "high" | "medium" | "low";
    evidenceRefs: SemanticEvidenceRef[];
  }>;
};
```

Rules:

- AI facts with no evidence refs are dropped.
- AI facts render as AI-sourced review hints, not verified facts.
- Deterministic rule facts remain visible even when AI facts exist.

## Rollback

- Keep the first-version artifact module and call `buildSemanticDiffSummary(entries)` without validation evidence or AI review input.
- Since this change is frontend-only and non-persistent, rollback has no migration work.
