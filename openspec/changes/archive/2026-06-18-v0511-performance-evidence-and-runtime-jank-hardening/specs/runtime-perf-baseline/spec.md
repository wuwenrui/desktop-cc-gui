## ADDED Requirements

### Requirement: V0511 Baseline MUST Anchor To Current Package Version And Commit

The current performance baseline MUST use the repository's current `package.json.version` and git commit as its evidence anchor.

#### Scenario: baseline uses current version

- **WHEN** `npm run perf:baseline:all` generates baseline artifacts on `feature/v0.5.11`
- **THEN** `docs/perf/baseline.json` and `docs/perf/baseline.md` MUST identify the baseline as v0.5.11
- **AND** the artifacts MUST include the current git commit

#### Scenario: history artifact preserves versioned evidence

- **WHEN** v0.5.11 baseline generation succeeds
- **THEN** the system MUST write an immutable `docs/perf/history/v0.5.11-baseline*.json` artifact
- **AND** it MUST write the matching markdown history artifact

### Requirement: V0511 Cold Start Timing MUST Require Real Startup Markers

Cold-start first paint and first interactive timing MUST be measured only from real startup marker snapshots.

#### Scenario: startup marker snapshot provided

- **WHEN** `scripts/perf-cold-start-baseline.mjs` receives a valid `--startup-markers` input containing `first-paint` and `first-interactive`
- **THEN** it MUST emit numeric `S-CS-COLD/firstPaintMs` and `S-CS-COLD/firstInteractiveMs` values
- **AND** their evidence class MUST be classified as measured by the aggregate report

#### Scenario: startup marker snapshot missing

- **WHEN** no valid startup marker snapshot is provided
- **THEN** `firstPaintMs` and `firstInteractiveMs` MUST remain `unsupported`
- **AND** the unsupported reason MUST state that Tauri/WebView startup marker evidence was not provided
