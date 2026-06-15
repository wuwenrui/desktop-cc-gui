## ADDED Requirements

### Requirement: Runtime Evidence Gates MUST Expose Release Budget Fields

Runtime evidence gate artifacts MUST 在 observed values 旁暴露 budget metadata，使后续 optimization changes 可以用结构化字段判断 pass/fail/unsupported。

#### Scenario: budget fields accompany observed values

- **WHEN** `docs/perf/runtime-evidence-gates.json` 重新生成
- **THEN** each budgeted scenario MUST include observed value, target value when defined, hard-fail threshold when defined, unit, evidence class, and source artifact path
- **AND** unsupported scenarios MUST keep `value: null` and include unsupported reason

#### Scenario: release checklist can fail on budget regression

- **WHEN** local or CI performance checklist reads runtime evidence gate artifacts
- **THEN** it MUST determine pass, fail, or unsupported from structured fields without scraping narrative markdown
- **AND** unsupported or proxy evidence MUST NOT be reported as release-grade measured evidence
