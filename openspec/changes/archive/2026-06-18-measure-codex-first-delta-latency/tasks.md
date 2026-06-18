## 1. Evidence Report Tests

- [x] 1.1 P1 Add script test coverage for `firstDeltaLatencyP95` derived from `realtime.turnTrace.summary.deltas.sendToFirstDeltaMs`. Input: measured summaries with `14602ms` and `1272ms`. Output: first-delta metric is measured and distinct from visible lag.
- [x] 1.2 P1 Add script test coverage for dominance notes when first-delta latency is high while visible lag is low and reducer amplification is healthy. Input: synthetic Codex/MiniMax summary. Output: note points to upstream/provider/startup phase investigation.

## 2. Report Implementation

- [x] 2.1 P1 Update `scripts/perf-realtime-runtime-report.mjs` to emit a distinct first-delta metric from `sendToFirstDeltaMs`.
- [x] 2.2 P1 Update report notes to identify first-delta-dominant turns without recommending row render, batch, or reducer optimization.

## 3. Validation

- [x] 3.1 P1 Run `npx openspec validate measure-codex-first-delta-latency --strict --no-interactive`.
- [x] 3.2 P1 Run `node --test scripts/perf-realtime-runtime-report.test.mjs`.
- [x] 3.3 P1 Run `npm run typecheck`, `npm run lint`, and `git diff --check`.
- [x] 3.4 P2 Generate `.artifacts/realtime-runtime-evidence.first-delta.json` from latest diagnostics and confirm it reports first-delta latency separately from visible lag.
