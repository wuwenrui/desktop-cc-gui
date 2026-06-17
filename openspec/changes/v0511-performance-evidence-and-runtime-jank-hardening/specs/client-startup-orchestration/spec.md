## ADDED Requirements

### Requirement: V0511 Startup Marker Evidence MUST Flow Into Cold Start Baseline

Startup marker snapshots MUST be consumable by cold-start baseline generation.

#### Scenario: marker extraction writes normalized snapshot

- **WHEN** `scripts/perf-startup-marker-snapshot.mjs` receives diagnostics containing `perf.startup.markers`
- **THEN** it MUST write a normalized snapshot containing only `first-paint` and `first-interactive` marker timings
- **AND** the snapshot MUST exclude unrelated runtime diagnostics content

#### Scenario: cold start baseline consumes normalized snapshot

- **WHEN** `scripts/perf-cold-start-baseline.mjs` receives the normalized startup marker snapshot
- **THEN** it MUST use the marker timings for `S-CS-COLD/firstPaintMs` and `S-CS-COLD/firstInteractiveMs`
- **AND** it MUST preserve bundle gzip metrics in the same output
