## ADDED Requirements

### Requirement: 当前版本 Baseline MUST Use Package Version As Evidence Anchor

性能 baseline refresh MUST 使用当前 package version 与 git commit 作为 evidence anchor；roadmap 文件名只作为规划来源，不得覆盖仓库版本事实。

#### Scenario: baseline target follows package version

- **WHEN** `npm run perf:baseline:all` 生成 latest baseline artifacts
- **THEN** `docs/perf/baseline.md` 与 `docs/perf/baseline.json` MUST 使用 `package.json.version` 作为 target version
- **AND** artifacts MUST include 当前 git commit
- **AND** 当 package version 是 `0.5.9` 时，baseline MUST NOT 声称自己是 `v0.5.8`

#### Scenario: immutable history is written for refreshed version

- **WHEN** baseline refresh 对 package version `0.5.9` 成功完成
- **THEN** system MUST write `docs/perf/history/v0.5.9-baseline.md`
- **AND** system MUST write `docs/perf/history/v0.5.9-baseline.json`
- **AND** older history files MUST NOT be overwritten

### Requirement: Baseline Reports MUST Include Previous-Version Delta Table

refreshed baseline report MUST 对 previous checked-in baseline 与 current baseline 做可追溯 comparison，只比较 scenario id 与 unit 可对齐的 metric。

#### Scenario: comparable metrics show previous and current values

- **WHEN** `docs/perf/baseline.md` 为 refreshed baseline 生成
- **THEN** report MUST include previous value, current value, delta, unit, and evidence class
- **AND** 不可比较 metric MUST 标记为 `missing`、`unsupported` 或 `not comparable` 并附 reason
