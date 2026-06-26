## ADDED Requirements

### Requirement: Streaming Schedule Tier MUST Be Selectable And Persisted

The webview MUST expose a `streamingScheduleTier` runtime flag with three allowed values: `baseline`, `guarded` (default), and `aggressive`. The flag MUST be persisted via `localStorage["ccgui.perf.streamingScheduleTier"]` and read through `resolveRenderScheduleTier()` (defined in `src/features/threads/utils/renderSchedulingPolicy.ts`). Invalid string values MUST fall back to `guarded` without throwing.

#### Scenario: default tier is guarded
- **WHEN** `localStorage["ccgui.perf.streamingScheduleTier"]` is unset
- **THEN** `resolveRenderScheduleTier()` MUST return `"guarded"`.

#### Scenario: invalid value falls back to guarded
- **WHEN** `localStorage["ccgui.perf.streamingScheduleTier"]` is `"invalid-tier"`
- **THEN** `resolveRenderScheduleTier()` MUST return `"guarded"`
- **AND** MUST NOT throw.

#### Scenario: aggressive tier applies tightened budgets
- **WHEN** the tier is `"aggressive"`
- **THEN** `MAX_DISPATCH_BUDGET_MS` MUST be 4 (not 8)
- **AND** the tool-output tail gate throttle MUST be 16ms (not 32ms)
- **AND** the `requestIdleCallback` timeout MUST be 25ms (not 50ms).

### Requirement: Tier Change MUST Apply Without Page Reload

Changing the tier via `localStorage` MUST take effect for new dispatch decisions within the current session. The webview MUST re-read the tier at each `dispatchWithSchedule` call. The change MUST NOT require restarting the conversation or refreshing the renderer.

#### Scenario: tier change observable in next dispatch
- **WHEN** the user changes `streamingScheduleTier` from `"guarded"` to `"baseline"`
- **THEN** the next `dispatchWithSchedule` call MUST observe `"baseline"`
- **AND** MUST route through the urgent dispatch path.

### Requirement: Baseline Tier MUST Preserve v0.5.13 Behavior

When `streamingScheduleTier === "baseline"`, the system MUST bypass idle-yield, tool-output tail gating, and background items 3-frame accumulation. All event dispatch MUST behave as it did in v0.5.13 main.

#### Scenario: baseline tier skips idle yield
- **WHEN** the tier is `"baseline"`
- **AND** a 200-event queue is processed
- **THEN** `useAppServerEvents` MUST NOT call `requestIdleCallback`
- **AND** the chunk loop MUST use `setTimeout(0)` as it did in v0.5.13.

#### Scenario: baseline tier skips tail gate
- **WHEN** the tier is `"baseline"`
- **THEN** `useToolOutputTailGate` MUST submit every delta directly to the reducer
- **AND** MUST NOT enter BACKPRESSURE.

### Requirement: Tier Rollback MUST Be Independently Testable

Each tier MUST be verifiable via focused Vitest by stubbing `localStorage`. Rollback from `aggressive` to `guarded` to `baseline` MUST be reversible without restarting the app or reloading the renderer.

#### Scenario: aggressive to baseline rollback
- **WHEN** the tier changes from `"aggressive"` to `"baseline"`
- **THEN** `MAX_DISPATCH_BUDGET_MS` MUST revert to v0.5.13 behavior (no budget cap)
- **AND** the tool-output tail gate MUST bypass throttling.

#### Scenario: aggressive budget timeout diagnostic
- **WHEN** the tier is `"aggressive"`
- **AND** a chunk exceeds 4ms
- **THEN** `aggressiveTierTimeoutMissed` diagnostics MUST fire
- **AND** the next chunk MUST still be scheduled.

### Requirement: Tier Flag And Existing 8 Perf Flags MUST Be Orthogonal

The `streamingScheduleTier` flag is additive. The 8 existing perf flags (`realtimeBatching`, `appServerEventBatch`, `reducerNoopGuard`, `incrementalDerivation`, `backgroundRenderGating`, `backgroundBufferedFlush`, `stagedHydration`, `debugLightPath`) MUST continue to operate independently and MUST NOT be overridden by tier changes. The new `toolOutputTailGate` flag is also orthogonal: it bypasses only the webview tool-output tail gate, regardless of tier.

#### Scenario: existing flag independent of tier
- **WHEN** `localStorage["ccgui.perf.realtimeBatching"]` is `"off"`
- **AND** `localStorage["ccgui.perf.streamingScheduleTier"]` is `"aggressive"`
- **THEN** `isRealtimeBatchingEnabled()` MUST return `false`
- **AND** `resolveRenderScheduleTier()` MUST return `"aggressive"`.

#### Scenario: appServerEventBatch off overrides tier-based idle yield
- **WHEN** `localStorage["ccgui.perf.appServerEventBatch"]` is `"off"`
- **THEN** the `app-server-event-batch` channel MUST NOT be subscribed
- **AND** the per-event dispatch loop MUST NOT call `useRenderScheduler.scheduleChunk`
- **AND** the tier-based idle yield protections MUST NOT apply (frontend falls back to single-channel mode)
- **AND** the backend `SnapshotThrottle` (Rust-side) protections MUST remain in effect.

#### Scenario: toolOutputTailGate off bypasses only the webview gate
- **WHEN** `localStorage["ccgui.perf.toolOutputTailGate"]` is `"off"`
- **THEN** the webview `useToolOutputTailGate.submit` MUST return `true` directly without BACKPRESSURE
- **AND** the per-event backpressure MUST still protect raw `itemOutputDelta` from overflow drops
- **AND** generic `coalesceKey` MUST still NOT apply to raw `itemOutputDelta`
- **AND** the backend `SnapshotThrottle` for `item/updated` text snapshots MUST still apply.
