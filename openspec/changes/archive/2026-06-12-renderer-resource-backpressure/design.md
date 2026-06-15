# Design / 设计

## Context / 背景

Renderer resource pressure has three sources in this change: high-frequency terminal/runtime output, long-lived listeners/timers/polling, and deferred media memory. The repository already has centralized event helpers and renderer diagnostics, but lifecycle ownership is uneven across panels.

This design uses a pilot rollout. It does not claim full-app listener compliance until inventory and migration coverage prove it.

## Architecture / 架构

```text
terminal/runtime source events
  -> eventBackpressure
     -> critical bypass
     -> bounded queue/ring buffer
     -> frame flush
     -> coalescing by kind/hash
  -> React state consumers
  -> diagnostics aggregate

listener/timer registration
  -> lifecycle owner taxonomy
  -> pilot owner registry/checks
  -> cleanup tests

media object URL creation
  -> owner Set
  -> release hook
  -> diagnostics aggregate
```

## Decisions / 关键决策

### Decision 1: Critical events bypass backpressure

Terminal exit, fatal runtime status, session-ending errors, and final settlement markers must not be dropped or coalesced away. Backpressure only applies to non-critical display/output volume.

### Decision 2: Non-critical output is frame-budgeted

Terminal/runtime line bursts should flush at animation-frame or equivalent boundaries with both event count and byte budgets. When the queue fills, oldest non-critical display events may be evicted, while raw export/source path remains the source of complete output when supported.

### Decision 3: Status coalescing is kind-aware

Repeated status events may coalesce by `kind + stable payload hash` within a bounded window. Coalescing must not reorder terminal/final status semantics.

### Decision 4: Lifecycle owner enforcement starts with pilot surfaces

Owner taxonomy:

| Owner | Examples |
|---|---|
| `bootstrap` | startup-only listeners |
| `shell` | app-wide always-on services |
| `workspace` | active workspace scoped subscriptions |
| `panel` | visible panel subscriptions/polling |
| `modal` | temporary dialog/window listeners |

Pilot surfaces should include rendererDiagnostics, terminal/runtime consumers, workspace focus refresh, and a small set of high-risk panels. Non-migrated surfaces remain residual risk in evidence.

### Decision 5: Focus refresh is one wave for migrated sources

Migrated focus/visibility refresh sources should enqueue into one coalesced wave. This prevents focus storms while preserving visible freshness after returning to the app.

### Decision 6: Media release is object-URL focused first

The first memory layer tracks object URLs and obvious decoded buffer owners. It does not try to control every plain remote/local `<img>` render path.

## Backpressure Contract / 背压合同

`eventBackpressure` should expose:

- `push(event)`;
- `subscribe(listener)`;
- `flush(reason)`;
- `queueDepth`;
- `droppedCount`;
- `coalescedCount`;
- `lastFlushDurationMs`;
- critical event bypass stats.

Default budget values can start conservative and be tuned by evidence.

## Diagnostics Contract / 诊断合同

Backpressure evidence includes queue depth, dropped/coalesced counts, event kind summary, flush duration, and evidence class. It must not include terminal output body.

Listener evidence includes owner, active/inactive state, registered count for migrated surfaces, and uncovered inventory entries.

Media evidence includes active object URL count, revoked count, retained bytes when measurable, and unsupported reason when not.

## Rollout Plan / 实施顺序

1. Add backpressure core and tests independent of React consumers.
2. Route terminal/runtime non-critical output through the core.
3. Add diagnostics aggregate and evidence gate fields.
4. Introduce lifecycle owner registry/check for pilot surfaces.
5. Migrate focus/visibility refresh wave for selected sources.
6. Add media owner Set and object URL release hooks.
7. Publish residual uncovered listener inventory.

## Validation Matrix / 验证矩阵

| Area | Evidence |
|---|---|
| Backpressure caps | unit tests for event/byte limits |
| Critical path | critical bypass tests |
| Status coalescing | kind/hash coalescing tests |
| Raw output | ring buffer/export compatibility tests |
| Lifecycle owners | cleanup tests for pilot surfaces |
| Focus wave | coalesced focus tests |
| Media release | object URL revoke tests |
| Realtime perf | `npm run perf:realtime:boundary-guard`, `npm run perf:realtime:extended-baseline` |
| Evidence gate | `npm run check:runtime-evidence-gates` |
| Type/lint | `npm run typecheck`, `npm run lint` |
| OpenSpec | `openspec validate renderer-resource-backpressure --strict --no-interactive` |

## Rollback / 回滚

- Backpressure can be disabled by routing subscriptions back to immediate delivery while retaining critical bypass tests.
- Owner registry can remain advisory if static enforcement blocks delivery.
- Media tracking can be disabled per component if release timing causes visual blanking.

## Risks / 风险

- Incorrect critical classification can drop important runtime state.
- Listener inventory is broad; pilot wording and evidence qualifiers prevent overclaiming.
- Object URL revoke timing is platform-sensitive; prefer conservative release points.
