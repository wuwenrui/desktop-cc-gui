## Why

Project Map AI organizer recently failed with malformed JSON after switching models, while the main Project Map generation path already had stronger structured-output repair. This exposes a broader architectural gap: model text is unreliable transport, but some feature paths still parse it directly.

## 目标与边界

目标是建立 reusable model structured-output normalization so feature code consumes validated payloads instead of raw model text. The first integration target is Project Map generation and organizer output because that is where the failure is visible and already covered by user-facing run diagnostics.

边界：本变更 does not change persisted Project Map schema, does not introduce model-specific allowlists, and does not make model output trusted without domain validation.

## 非目标

- 不新增 external JSON repair dependency。
- 不实现无限 retry 或后台 daemon retry。
- 不承诺所有 malformed JSON 都可恢复；不可恢复时仍 fail closed。
- 不改变 existing Project Map candidate / node / manifest storage schema。

## What Changes

- Add a shared model structured-output normalization utility for extracting JSON candidates, parsing strict JSON, applying bounded lenient repair, and returning parse diagnostics.
- Reuse the shared normalization utility in Project Map generation instead of keeping repair logic buried in the worker.
- Route Project Map organizer output through the same normalization and one-shot JSON-only repair policy instead of direct `JSON.parse()`.
- Preserve fail-closed behavior: if normalization and repair cannot produce a valid domain payload, the run remains failed with a visible diagnostic and no partial trusted data is written.
- Add focused tests for malformed model output across main generation and organizer paths, including missing array brackets and markdown/non-JSON wrappers.

## Capabilities

### New Capabilities

- `model-structured-output-normalization`: Defines shared behavior for normalizing untrusted model text into validated structured payloads across model providers.

### Modified Capabilities

- `project-map-incremental-generation`: Project Map generation and organizer runs must use shared structured-output normalization and bounded repair before writing map data or candidates.

## 技术方案选项与取舍

| Option | Description | Trade-off | Decision |
|---|---|---|---|
| A | Only strengthen organizer prompt | Fast but fragile; each model can still emit malformed JSON | Rejected |
| B | Add a shared parser/repair layer and adopt it in Project Map paths | Small refactor, testable, reusable for other AI JSON features | Adopted |
| C | Add a new dependency for tolerant JSON parsing | More capability but unnecessary dependency and supply-chain surface | Rejected |

## 验收标准

- Organizer malformed JSON no longer fails before one JSON-only repair attempt is made.
- Main Project Map generation continues to support existing structured-output repair cases.
- Parser/repair helpers are feature-independent and do not include model-name special cases.
- Repair failure still produces `output_parse_failed` and does not write partial candidates or map data.
- Focused tests cover both success-after-repair and fail-closed cases.

## Impact

- Affected code:
  - `src/services/modelStructuredOutput.ts`
  - `src/features/project-map/services/projectMapGenerationWorker.ts`
  - `src/features/project-map/services/projectMapNodeOrganizer.ts`
  - focused Project Map tests
- Affected systems:
  - Project Map background generation
  - Project Map AI organizer
  - Model-provider interoperability for structured JSON output
- Dependencies:
  - No new npm/Rust dependency.

## Implementation Calibration

This change has been implemented as a shared frontend model structured-output normalization layer and Project Map adoption slice.

Code facts:

- `src/services/modelStructuredOutput.ts` owns provider-agnostic extraction, lenient repair, validator-gated parsing, and parse error classification.
- `src/features/project-map/services/projectMapGenerationWorker.ts` uses the shared parser for Project Map generation payloads.
- `src/features/project-map/services/projectMapNodeOrganizer.ts` uses the shared parser and one JSON-only repair attempt for organizer payloads.
- `.trellis/spec/frontend/model-structured-output.md` captures the future implementation rule so raw model output is not directly parsed by feature code.

Validation evidence:

- Focused Vitest: `src/services/modelStructuredOutput.test.ts`, `src/features/project-map/services/projectMapNodeOrganizer.test.ts`, `src/features/project-map/services/projectMapGenerationWorker.test.ts`.
- OpenSpec strict validation: `openspec validate harden-model-structured-output-normalization --strict --no-interactive`.
