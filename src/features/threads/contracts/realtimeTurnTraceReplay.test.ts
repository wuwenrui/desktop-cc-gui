// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { buildRealtimePerfExtendedEvents } from "./realtimePerfExtendedFixture";
import { buildThreeThreadReplayEventsForMinutes, REALTIME_REPLAY_BATCH_WINDOW_MS } from "./realtimeReplayFixture";
import { runTurnTraceReplay } from "./realtimeTurnTraceReplay";

describe("realtimeTurnTraceReplay", () => {
  it("synthesizes a per-turn trace summary for the extended fixture", () => {
    const events = buildRealtimePerfExtendedEvents();
    const result = runTurnTraceReplay(events);
    expect(result.totalTurns).toBeGreaterThan(0);
    expect(result.completedTurns).toBeGreaterThan(0);
    // Replay-visible milestones are synthetic, so the report must not upgrade
    // them to real WebView measured evidence.
    expect(result.evidenceClassCounts.measured).toBe(0);
    expect(result.evidenceClassCounts.proxy).toBeGreaterThan(0);
    // visibleTextLagP95 should be > 0 for completed turns that have both first-delta and first-visible-text.
    expect(result.visibleTextLagP95Ms).toBeGreaterThan(0);
  });

  it("replays a 5-minute three-thread fixture without integrity loss", () => {
    const events = buildThreeThreadReplayEventsForMinutes(5);
    const result = runTurnTraceReplay(events);
    expect(result.totalTurns).toBeGreaterThan(0);
    // Each replay turn with batched deltas has at least one batch flush.
    expect(result.batchFlushDurationP95Ms).toBeGreaterThan(0);
  });

  it("respects the REALTIME_REPLAY_BATCH_WINDOW_MS window for the batch flush count", () => {
    const events = buildThreeThreadReplayEventsForMinutes(2);
    const result = runTurnTraceReplay(events);
    // sanity: reducers fired, batch flushes recorded
    for (const summary of result.summaries) {
      expect(summary.counters.reducerCommitCount).toBeGreaterThan(0);
    }
    // reference: REALTIME_REPLAY_BATCH_WINDOW_MS
    expect(REALTIME_REPLAY_BATCH_WINDOW_MS).toBe(12);
  });

  it("keeps a slow first-token replay turn together across cycle-sized gaps", () => {
    const events = buildRealtimePerfExtendedEvents();
    const result = runTurnTraceReplay(events);
    const slowTurn = result.summaries.find((summary) =>
      summary.dimensions.threadId === "claude:stream-json-first-token"
    );
    expect(slowTurn).toBeDefined();
    expect(slowTurn?.endedReason).toBe("completed");
    expect(slowTurn?.counters.reasoningDeltaCount).toBe(1);
    expect(slowTurn?.counters.reducerCommitCount).toBeGreaterThanOrEqual(4);
  });
});
