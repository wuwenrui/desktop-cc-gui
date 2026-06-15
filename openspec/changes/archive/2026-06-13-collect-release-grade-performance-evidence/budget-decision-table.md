# Budget Decision Table

Input: 21 current `budget-missing` metrics from `docs/perf/baseline.json`.

Rule: Do not invent thresholds. A metric can only move from `budget-missing` to `budgeted` when a source and owner are explicit.

## Decisions

| Record | Decision | Owner | Follow-up / Source |
|---|---|---|---|
| `S-LL-200/commitDurationP50` | residual | release-grade-evidence-collection | Need owner-approved long-list commit budget by row count. |
| `S-LL-200/commitDurationP95` | residual | release-grade-evidence-collection | Need owner-approved long-list commit budget by row count. |
| `S-LL-200/firstPaintAfterMount` | residual | release-grade-evidence-collection | Browser/runtime first-paint budget must be defined before hard gate. |
| `S-LL-500/commitDurationP50` | residual | release-grade-evidence-collection | Need owner-approved long-list commit budget by row count. |
| `S-LL-500/commitDurationP95` | residual | release-grade-evidence-collection | Need owner-approved long-list commit budget by row count. |
| `S-LL-500/firstPaintAfterMount` | residual | release-grade-evidence-collection | Browser/runtime first-paint budget must be defined before hard gate. |
| `S-LL-1000/commitDurationP50` | residual | release-grade-evidence-collection | Need owner-approved long-list commit budget by row count. |
| `S-LL-1000/commitDurationP95` | residual | release-grade-evidence-collection | Need owner-approved long-list commit budget by row count. |
| `S-LL-1000/firstPaintAfterMount` | residual | release-grade-evidence-collection | Browser/runtime first-paint budget must be defined before hard gate. |
| `S-CI-50/inputEventLossCount` | budgeted-next | input-latency-budget | Candidate hardFail should be `0`, but requires owner approval before encoding. |
| `S-CI-50/compositionToCommit` | residual | input-latency-budget | Need IME/runtime budget source. |
| `S-CI-100-IME/inputEventLossCount` | budgeted-next | input-latency-budget | Candidate hardFail should be `0`, but requires owner approval before encoding. |
| `S-CI-100-IME/compositionToCommit` | residual | input-latency-budget | Need IME/runtime budget source. |
| `S-RS-PE/dedupHitRatio` | residual | realtime-runtime-evidence | Ratio is diagnostic, not release hard budget yet. |
| `S-RS-PE/assemblerLatency` | residual | realtime-runtime-evidence | Need runtime assembler budget source. |
| `S-RS-VL/visibleTextLagP95` | budgeted-next | realtime-runtime-evidence | Existing runtime evidence gate names target 2000 / hardFail 5000; encode after measured source exists. |
| `S-RS-RA/reducerAmplificationMedian` | budgeted-next | realtime-runtime-evidence | Existing runtime evidence gate names target 2 / hardFail 4; encode after measured source exists. |
| `S-RS-FD/batchFlushDurationP95` | budgeted-next | realtime-runtime-evidence | Existing runtime evidence gate names target 8 / hardFail 16; encode after measured source exists. |
| `S-RS-TS/terminalSettlementP95` | budgeted-next | realtime-runtime-evidence | Existing runtime evidence gate names target 100 / hardFail 250; encode after measured source exists. |
| `S-CS-COLD/firstPaintMs` | residual | release-grade-evidence-collection | Need measured Tauri/webview baseline before owner sets hard budget. |
| `S-CS-COLD/firstInteractiveMs` | residual | release-grade-evidence-collection | Need measured Tauri/webview baseline before owner sets hard budget. |

## Immediate Encoding Policy

Do not encode the `budgeted-next` rows until the implementation has either:

1. owner confirmation in this change, or
2. a measured runtime artifact and a documented source line in `runtime-performance-evidence-gates`.

Current implementation encodes the four realtime runtime rows after measured runtime evidence exists:

- `S-RS-VL/visibleTextLagP95`
- `S-RS-RA/reducerAmplificationMedian`
- `S-RS-FD/batchFlushDurationP95`
- `S-RS-TS/terminalSettlementP95`

All other rows without owner-approved source remain visible as residual `budget-missing` records.
