## Context

Current branch fact on 2026-06-17:

- Git branch: `feature/v0.5.11`.
- Package version: `ccgui@0.5.11`.
- Active OpenSpec changes before creating this change: `fix-file-tree-virtual-scroll-height` and `fix-runtime-reconnect-card-state-loop`.
- Active OpenSpec changes after creating this change: `v0511-performance-evidence-and-runtime-jank-hardening`, `fix-runtime-reconnect-card-state-loop`, and `fix-file-tree-virtual-scroll-height`.
- Pre-change `npm run perf:archive-readiness -- --json` exited `2` with `ok: true`, `status: "warn"`, `hardFailures: []`, `activeChangeCount: 2`, and `budgetMissingCount: 15`.
- Unsupported records include cold-start WebView timing, long-running runtime liveness/module-switch timing, and five summary blocks: realtime input render budget, backend file I/O isolation, file-change debounce, app-server event batching, frontend prop-chain stability.

Code facts already present:

- `src/features/threads/hooks/useThreadsReducer.ts` exposes `__profile` with `prepareThreadItemsCallCount`, `reducerDispatchCount`, and component render counters.
- `src/features/threads/hooks/useThreadsReducer.append-agent-delta-fast-path.test.ts` asserts a 1000-delta Codex burst keeps `prepareThreadItemsCallCount: 0` and `reducerDispatchCount: 1000`.
- `src/features/app/hooks/useAppServerEvents.batch-consumer.test.tsx` covers batch subscription, status coalescing, non-coalescible deltas, chunking, serialization, and cleanup.
- `src-tauri/src/workspaces/external_changes.rs` contains a debounced external-change emitter and tests for same-path coalesce, cross-path preservation, repeated key after flush, and no empty batch emit.
- `scripts/perf-cold-start-baseline.mjs` supports `--startup-markers`; `scripts/perf-startup-marker-snapshot.mjs` extracts `first-paint` and `first-interactive` from real startup marker snapshots.
- `scripts/generate-runtime-evidence-report.mjs` already has aggregation slots for `S-IO-RR`, `S-IO-FS`, `S-IO-FC`, `S-IO-AS`, and `S-IO-FP`, but those summaries remain unsupported without producer artifacts.

## Goals / Non-Goals

**Goals:**

- Make v0.5.11 performance scope evidence-first.
- Convert existing code/test facts into repeatable producer artifacts before doing runtime jank fixes.
- Wire producer artifacts into `generate-runtime-evidence-report.mjs` and archive-readiness gates.
- Preserve explicit `unsupported` output when no trustworthy source exists.
- Keep runtime changes rollback-safe and bounded.

**Non-Goals:**

- No broad UI/backend rewrite before evidence identifies a failing path.
- No cross-platform proof beyond the local runner unless a real macOS/Windows/Linux runner is available.
- No fake Tauri/WebView cold-start timing.
- No new dependency for profiling, tracing, or report generation.
- No replacement of existing perf scripts; extend them conservatively.

## Decisions

### Decision 1: producer artifacts before performance fixes

Implementation order MUST be:

```text
existing code/test fixture
-> producer artifact
-> aggregate into runtime evidence gates
-> archive-readiness interpretation
-> only then minimal jank hardening if a metric fails
```

Alternative A was to directly optimize suspected paths. That repeats the historical risk of unmeasured performance work.

Alternative B was to only refresh `docs/perf/baseline.*`. That would keep the current unsupported summaries and would not answer which runtime path deserves work.

Chosen approach: producer-first. It makes the change slower but auditable.

### Decision 2: reuse current diagnostics and perf script contracts

The change SHOULD reuse:

- `docs/perf/*-baseline.json` fragments.
- `.artifacts/*.json` for transient local capture.
- `rendererDiagnostics` for content-safe runtime diagnostics.
- Existing Vitest/Rust fixtures for reducer, app-server batch, and file-change debounce.

It MUST NOT add a new global event bus or separate perf storage.

### Decision 3: classify evidence honestly

Evidence classes remain:

- `measured`: runtime/browser/Tauri or concrete script measurement.
- `proxy`: deterministic fixture/replay evidence.
- `manual-only`: explicitly human-observed and not machine-reproducible.
- `unsupported`: no trustworthy source exists in current environment.

Cold-start `firstPaintMs` and `firstInteractiveMs` MAY become measured only through a real startup marker snapshot. Without that input, the existing unsupported result is correct and must remain visible.

### Decision 4: keep producer outputs content-safe

Producer artifacts may include ids, counts, booleans, durations, rates, source version, payload byte estimates, path hashes, and bounded labels. They MUST NOT include prompt text, assistant body, tool output, command output, raw file contents, raw absolute paths, diffs, secrets, or environment values.

### Decision 5: v0.5.11 scope uses current package version and git commit

`perf:baseline:all` and aggregate reports MUST anchor to current `package.json.version` and git commit. Historical roadmap filenames or stale OpenSpec injected context must not override repo facts.

## Data Flow

```text
Producer fixture / runtime snapshot
  -> JSON fragment under docs/perf or .artifacts
  -> scripts/perf-aggregate.mjs or scripts/generate-runtime-evidence-report.mjs
  -> docs/perf/baseline.{json,md}
  -> docs/perf/runtime-evidence-gates.{json,md}
  -> scripts/perf-archive-readiness.mjs
```

Expected scenario ownership:

| Scenario | Producer source | Aggregation target |
|---|---|---|
| `S-IO-RR` | reducer/profile fixture using `__profile` | realtime input render budget summary |
| `S-IO-AS` | app-server batch route / raw-vs-IPC fixture | app-server event batching summary |
| `S-IO-FC` | Rust or script-driven same-path file event burst fixture | file-change debounce summary |
| `S-IO-FS` | backend file I/O fixture | backend file I/O isolation summary |
| `S-IO-FP` | React Profiler / layout node profile fixture | frontend prop-chain stability summary |
| `S-CS-COLD` | startup marker snapshot + cold-start baseline | cold-start summary |

## Risks / Trade-offs

- [Risk] Producer fixtures can drift from real desktop behavior. → Mitigation: label fixture evidence as `proxy`, require real snapshot for `measured`, and keep next actions visible.
- [Risk] Running `perf:baseline:all` changes checked-in docs. → Mitigation: proposal separates design from implementation; implementation tasks will record generated artifacts and validation output.
- [Risk] Existing stale OpenSpec context reports old version/counts. → Mitigation: design explicitly uses current `package.json`, git branch, active change list, and script output as source of truth.
- [Risk] Multiple specs are touched. → Mitigation: use additive delta requirements for v0.5.11 evidence, not broad modified requirement rewrites.
- [Risk] Runtime jank fixes expand beyond evidence. → Mitigation: task gate requires a producer artifact and failed/unsupported metric before any behavior change.

## Migration Plan

1. Add producer scripts or script modes for missing `S-IO-*` evidence.
2. Wire `generate-runtime-evidence-report.mjs` to read producer outputs.
3. Refresh v0.5.11 baseline/history artifacts.
4. Run archive-readiness and inspect remaining warnings.
5. If a metric fails or remains unsupported due to missing code instrumentation, implement the smallest instrumentation/fix.
6. Keep rollback simple: remove producer wiring and generated artifacts; runtime behavior must remain baseline-compatible unless a later evidence-backed task explicitly changes it.

## Open Questions

- Which local environment will supply the real Tauri/WebView startup marker snapshot for `firstPaintMs` and `firstInteractiveMs`?
- Should v0.5.11 release mode require all `S-IO-*` summaries to be non-unsupported, or only require owner/next-action visibility for remaining unsupported fields?
- Should long-running OS child liveness and module-switch timing be handled in this change or split into a later platform-runner evidence change?
