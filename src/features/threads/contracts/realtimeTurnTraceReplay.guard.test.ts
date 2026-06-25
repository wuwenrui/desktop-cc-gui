// Guard test: the turn-trace replay path must be a pure observer.
// It must not alter the reducer's semantic hash, must not introduce extra
// redux/render side effects, and must not leak prompt/assistant/tool/terminal text.

import { describe, expect, it } from "vitest";
import { buildThreeThreadReplayEventsForMinutes, REALTIME_REPLAY_BATCH_WINDOW_MS } from "./realtimeReplayFixture";
import { runReplayProfile } from "./realtimeReplayHarness";
import { runTurnTraceReplay } from "./realtimeTurnTraceReplay";
import {
  listTurnTraceSummaries,
  resetTurnTraceCorrelationForTests,
} from "../utils/turnTraceCorrelation";

describe("realtime turn trace correlation guard", () => {
  it("does not perturb the reducer semantic hash between runs", async () => {
    const events = buildThreeThreadReplayEventsForMinutes(2);
    const first = await runReplayProfile({
      events,
      profile: "optimized",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });
    // Run the turn-trace replay in between - it must be a pure observer.
    runTurnTraceReplay(events);
    const second = await runReplayProfile({
      events,
      profile: "optimized",
      batchWindowMs: REALTIME_REPLAY_BATCH_WINDOW_MS,
    });
    expect(second.semanticsHash).toBe(first.semanticsHash);
  });

  it("replays a long-form text + reasoning + tool blocks fixture without integrity loss", () => {
    // Build a custom fixture: one turn with assistant text, multiple reasoning
    // content deltas, a tool start, multiple tool output deltas, and an
    // agentCompleted finalization.
    const events = [
      {
        id: "long-1:agent-delta-1",
        kind: "agentDelta" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:assistant:turn-1",
        delta: "Long body chunk 1. ",
        atMs: 0,
      },
      {
        id: "long-1:reasoning-summary",
        kind: "reasoningSummaryDelta" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:reasoning:turn-1",
        delta: "Plan: stream 5 long text chunks, reason between chunks, run 1 tool.",
        atMs: 4,
      },
      {
        id: "long-1:agent-delta-2",
        kind: "agentDelta" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:assistant:turn-1",
        delta: "Long body chunk 2 with reasoning. ",
        atMs: 8,
      },
      {
        id: "long-1:reasoning-content",
        kind: "reasoningContentDelta" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:reasoning:turn-1",
        delta: "Inspecting runtime path. ",
        atMs: 12,
      },
      {
        id: "long-1:tool-start",
        kind: "toolStarted" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:tool:turn-1",
        command: "pnpm vitest --run",
        atMs: 16,
      },
      {
        id: "long-1:tool-output-1",
        kind: "toolOutputDelta" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:tool:turn-1",
        delta: "running tests\n",
        atMs: 24,
      },
      {
        id: "long-1:tool-output-2",
        kind: "toolOutputDelta" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:tool:turn-1",
        delta: "all green\n",
        atMs: 32,
      },
      {
        id: "long-1:agent-delta-3",
        kind: "agentDelta" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:assistant:turn-1",
        delta: "After the tool run, final chunk.",
        atMs: 40,
      },
      {
        id: "long-1:agent-complete",
        kind: "agentCompleted" as const,
        workspaceId: "ws-long",
        threadId: "codex:long-stream-thread",
        itemId: "codex:long-stream-thread:assistant:turn-1",
        text: "Long body chunk 1. Long body chunk 2 with reasoning. After the tool run, final chunk.",
        atMs: 60,
      },
    ];

    const result = runTurnTraceReplay(events);
    expect(result.totalTurns).toBe(1);
    expect(result.completedTurns).toBe(1);
    const summary = result.summaries[0]!;
    expect(summary.counters.reasoningDeltaCount).toBeGreaterThan(0);
    expect(summary.counters.toolDeltaCount).toBe(2);
    expect(summary.counters.deltaCount).toBe(7);
    expect(summary.counters.reducerCommitCount).toBeGreaterThan(0);
    expect(summary.deltas.firstDeltaToFirstVisibleTextMs).toBeGreaterThan(0);
    expect(summary.deltas.firstDeltaToFirstVisibleTextMs).toBeLessThan(100);
  });

  it("never includes prompt/assistant/tool/terminal text in any per-turn summary", () => {
    resetTurnTraceCorrelationForTests();
    const events = buildThreeThreadReplayEventsForMinutes(1);
    runTurnTraceReplay(events);
    for (const summary of listTurnTraceSummaries()) {
      const json = JSON.stringify(summary);
      // Forbidden substrings (any of the fixture text bodies).
      for (const forbidden of [
        "drafting response",
        "Plan",
        "Inspect",
        "Close",
        "running",
        "ok:",
        "with evidence",
      ]) {
        expect(json.includes(forbidden)).toBe(false);
      }
    }
  });
});
