## Context

`MessagesTimeline` already follows the live streaming contract: parent-level heavy derivations consume stable presentation snapshots, while `liveAssistantItem` / `liveReasoningItem` override the active tail row so text remains current. That protects CPU pressure, but it does not fully protect browser layout/paint stability when the live row itself grows quickly.

The observed failure is a visual renderer symptom:

- shell and surrounding UI remain mounted;
- content can overlap or briefly disappear;
- Windows WebView2 is more sensitive than macOS;
- the issue happens during realtime output, not after a history restore.

This points to a measurement and paint race around the active tail row rather than a data loss bug.

## Design Goals

- Preserve the current stable snapshot + live row override architecture.
- Keep virtualization for long histories.
- Stabilize only the live streaming tail and suspicious virtualizer states.
- Reuse existing diagnostics instead of adding a new logging subsystem.
- Keep all evidence privacy-safe and bounded.

## Proposed Architecture

```text
MessagesTimeline
  -> timelineProjectionRows
  -> shouldVirtualizeTimelineRows(...)
  -> live canvas stability guard
     -> identify active live row keys
     -> if virtualizer visible items collapse while rows exist:
          request bounded remeasure
          append privacy-safe diagnostic once per window
     -> if active tail is streaming:
          ensure the live row is rendered in a stable layer/layout context
          avoid depending on stale measurement for visibility
  -> render virtualized rows or non-virtual fallback
```

## Live Tail Stability

The active live row should be treated as a layout-sensitive row while streaming. The implementation should avoid a path where a stale measured height or temporary empty virtualizer window makes the live row disappear from the DOM while text deltas continue arriving.

Preferred strategy:

- derive a small set of active live row keys from existing timeline projection rows and live item ids;
- keep render logic deterministic and pure;
- for active live rows, add stable layout containment only where it reduces compositor overlap risk;
- do not wrap the whole message canvas in heavyweight transforms or force new layers for every row.

## Suspicious Virtualizer State Guard

The system should detect a narrow suspicious state:

- virtualization is enabled;
- timeline row count is greater than zero;
- the virtualizer returns no visible items, or the active live row is absent during an active streaming turn while the scroll element exists.

When this happens, the system may call `timelineVirtualizer.measure()` or equivalent once within a bounded cooldown. This is a recovery nudge, not a replacement render path.

Diagnostics should include counts and flags only, for example:

- row count;
- virtual item count;
- whether streaming/thinking is active;
- whether an active live row key was expected;
- platform and renderer snapshot already available through the diagnostics service.

It must not include message content.

## Rejected Alternatives

### Disable virtualization during streaming

Rejected. This can hide the flicker but reintroduces long-output performance regressions, especially in large histories.

### Force history replay or final-only rendering

Rejected. The existing contract requires realtime visible growth. History replay is for final consistency, not live render recovery.

### Add Windows-only GPU flags as the main fix

Rejected as the primary fix. The project already has Windows WebView2 GPU fallback. The canvas should still defend itself against transient measurement collapse across platforms.

## Validation

- Unit test pure helpers for identifying active live row keys and suspicious virtualizer states.
- Component-level or focused timeline test for streaming text growth without row disappearance.
- Regression test that a virtualizer empty visible set triggers bounded recovery diagnostics/remeasure.
- `npm run typecheck`.
- Focused Vitest suites for messages timeline behavior.
