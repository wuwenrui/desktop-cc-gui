// Edge case coverage for the replay harness. These tests pin down behavior
// that protects against regressions in non-finite / missing / empty inputs.

import { describe, expect, it } from "vitest";
import { runTurnTraceReplay } from "./realtimeTurnTraceReplay";
import type { RealtimeReplayEvent } from "./realtimeReplayTypes";

describe("realtimeTurnTraceReplay edge cases", () => {
  it("does not throw on empty event list", () => {
    expect(() => runTurnTraceReplay([])).not.toThrow();
    const result = runTurnTraceReplay([]);
    expect(result.totalTurns).toBe(0);
    expect(result.completedTurns).toBe(0);
    expect(result.evidenceClassCounts.measured).toBe(0);
    expect(result.evidenceClassCounts.unsupported).toBe(0);
  });

  it("pins non-finite atMs to cycle 0 instead of producing cycle-NaN", () => {
    const events: RealtimeReplayEvent[] = [
      {
        id: "bad-1",
        kind: "agentDelta",
        workspaceId: "ws-x",
        threadId: "claude:bad",
        itemId: "claude:bad:assistant:bad",
        delta: "x",
        atMs: Number.POSITIVE_INFINITY,
      },
      {
        id: "bad-2",
        kind: "agentDelta",
        workspaceId: "ws-x",
        threadId: "claude:bad",
        itemId: "claude:bad:assistant:bad",
        delta: "y",
        atMs: Number.NaN,
      },
      {
        id: "bad-3",
        kind: "agentCompleted",
        workspaceId: "ws-x",
        threadId: "claude:bad",
        itemId: "claude:bad:assistant:bad",
        text: "xy",
        atMs: Number.NaN,
      },
    ];
    const result = runTurnTraceReplay(events);
    // Exactly one synthesized turn because non-finite atMs all collapse to cycle 0.
    expect(result.totalTurns).toBe(1);
    expect(result.completedTurns).toBe(1);
    // No NaN should leak into the visible lag computation.
    expect(Number.isFinite(result.visibleTextLagP95Ms)).toBe(true);
  });

  it("treats empty threadId as codex (safe default), no crash", () => {
    const events: RealtimeReplayEvent[] = [
      {
        id: "empty-tid-1",
        kind: "agentDelta",
        workspaceId: "ws-empty",
        threadId: "",
        itemId: "x:assistant:y",
        delta: "hi",
        atMs: 0,
      },
      {
        id: "empty-tid-2",
        kind: "agentCompleted",
        workspaceId: "ws-empty",
        threadId: "",
        itemId: "x:assistant:y",
        text: "hi",
        atMs: 10,
      },
    ];
    const result = runTurnTraceReplay(events);
    expect(result.totalTurns).toBe(1);
    expect(result.completedTurns).toBe(1);
    const summary = result.summaries[0]!;
    expect(summary.dimensions.engine).toBe("codex");
  });

  it("classifies evidence correctly when no milestones recorded", () => {
    // Construct an event that won't trigger any milestone recording:
    // unknown event kind. Actually all kinds in the union trigger at least
    // one milestone, so we use an empty array instead.
    const result = runTurnTraceReplay([]);
    expect(result.evidenceClassCounts.measured).toBe(0);
    expect(result.evidenceClassCounts.proxy).toBe(0);
    expect(result.evidenceClassCounts["manual-only"]).toBe(0);
    expect(result.evidenceClassCounts.unsupported).toBe(0);
  });

  it("percentile is 0 on an empty input slice", () => {
    const events: RealtimeReplayEvent[] = [];
    const result = runTurnTraceReplay(events);
    expect(result.visibleTextLagP95Ms).toBe(0);
    expect(result.batchFlushDurationP95Ms).toBe(0);
    expect(result.terminalSettlementP95Ms).toBe(0);
    expect(result.reducerAmplificationMedian).toBe(0);
  });
});
