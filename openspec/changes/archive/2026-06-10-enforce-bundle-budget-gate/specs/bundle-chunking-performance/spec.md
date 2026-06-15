## ADDED Requirements

### Requirement: Bundle Chunking Gate MUST Enforce Structured Size Budgets

bundle chunking gate MUST 读取 built frontend assets，计算 raw/gzip size，并与 structured budget config 对比。

#### Scenario: asset sizes are grouped by stable budget id

- **WHEN** `npm run check:bundle-chunking` 在 production build 后运行
- **THEN** checker MUST read assets under `dist/assets`
- **AND** checker MUST compute raw bytes and gzip bytes for matching js, mjs, and css assets
- **AND** checker MUST report grouped results for app JS, app CSS, heavy optional vendor chunks, and total js/mjs/css payload

#### Scenario: hard-fail budgets exit non-zero

- **WHEN** budget group 配置为 fail mode 且存在 hard-fail threshold
- **AND** measured gzip size exceeds that threshold
- **THEN** `npm run check:bundle-chunking` MUST exit non-zero
- **AND** output MUST identify budget id, matched files, measured size, target, and hard-fail threshold

#### Scenario: advisory budgets do not block staged optimization rollout

- **WHEN** budget group 配置为 advisory mode
- **AND** measured size exceeds target or future hard-fail threshold
- **THEN** checker MUST print over-budget status
- **AND** checker MUST NOT exit non-zero solely because of that advisory group

### Requirement: Heavy Optional Chunks MUST Not Be Reported As Startup-Safe Without Evidence

bundle gate MUST 区分 measured startup-path isolation 与 unknown eagerness status，避免把 unknown 写成 pass。

#### Scenario: startup eagerness evidence is explicit

- **WHEN** checker evaluates heavy optional groups such as Mermaid, CodeMirror, document preview, or PDF preview
- **THEN** checker MUST report startup eagerness as `measured-lazy`, `measured-eager`, or `not-measured`
- **AND** `measured-eager` for a fail-mode heavy optional chunk MUST fail the gate
- **AND** `not-measured` MUST NOT be described as startup-safe
