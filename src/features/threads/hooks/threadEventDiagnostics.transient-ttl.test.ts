import { describe, expect, it } from "vitest";
import {
  TRANSIENT_TURN_STATE_TTL_MS,
  cleanupThreadTransientState,
  resolveTransientSettledAt,
  sweepThreadTransientState,
} from "./threadEventDiagnostics";
import type { TurnDiagnosticState } from "./threadEventDiagnostics";

const baseDiagnostic: TurnDiagnosticState = {
  workspaceId: "ws-1",
  threadId: "thread-1",
  turnId: "turn-1",
  startedAt: 0,
  lastProgressAt: 0,
  lastProgressSource: "",
  firstDeltaAt: null,
  firstItemEventAt: null,
  firstItemEventKind: null,
  firstItemType: null,
  firstExecutionAt: null,
  firstExecutionEventKind: null,
  firstExecutionItemType: null,
  firstExecutionItemId: null,
  activeExecutionItems: new Map(),
  completedAt: null,
  errorAt: null,
  deferredCompletion: null,
  assistantCompletedAt: null,
  assistantCompletedItemId: null,
  deltaCount: 0,
  itemEventCount: 0,
  progressSequence: 0,
  stallReported: false,
  noProgressSuspectedAt: null,
  noProgressSuspectedSource: null,
};

describe("sweepThreadTransientState (chat-stream-render-isolation-2026-06 task 8.4)", () => {
  it("keeps entries with no settled timestamp", () => {
    const now = 1_000_000;
    const result = sweepThreadTransientState(
      [{ threadId: "active", settledAt: null }],
      now,
    );
    expect(result.expiredThreadIds).toEqual([]);
    expect(result.remainingCount).toBe(1);
  });

  it("keeps entries whose settled timestamp is younger than TTL", () => {
    const now = 1_000_000;
    const settledAt = now - (TRANSIENT_TURN_STATE_TTL_MS - 1);
    const result = sweepThreadTransientState(
      [{ threadId: "recent", settledAt }],
      now,
    );
    expect(result.expiredThreadIds).toEqual([]);
    expect(result.remainingCount).toBe(1);
  });

  it("expires entries whose settled timestamp is older than TTL", () => {
    const now = 1_000_000;
    const settledAt = now - TRANSIENT_TURN_STATE_TTL_MS - 5;
    const result = sweepThreadTransientState(
      [{ threadId: "stale", settledAt }],
      now,
    );
    expect(result.expiredThreadIds).toEqual(["stale"]);
    expect(result.remainingCount).toBe(0);
  });

  it("handles mixed batches and respects per-entry settled timestamps", () => {
    const now = 1_000_000;
    const entries = [
      { threadId: "active", settledAt: null },
      { threadId: "recent", settledAt: now - 60_000 },
      { threadId: "stale-completed", settledAt: now - TRANSIENT_TURN_STATE_TTL_MS - 1 },
      { threadId: "stale-error", settledAt: now - TRANSIENT_TURN_STATE_TTL_MS - 60_000 },
    ];
    const result = sweepThreadTransientState(entries, now);
    expect(result.expiredThreadIds).toEqual([
      "stale-completed",
      "stale-error",
    ]);
    expect(result.remainingCount).toBe(2);
  });

  it("uses a custom ttl when provided", () => {
    const now = 10_000;
    const result = sweepThreadTransientState(
      [{ threadId: "a", settledAt: 1_000 }],
      now,
      5_000,
    );
    expect(result.expiredThreadIds).toEqual(["a"]);
  });
});

describe("resolveTransientSettledAt", () => {
  it("prefers completedAt over errorAt and assistantCompletedAt", () => {
    const state: TurnDiagnosticState = {
      ...baseDiagnostic,
      completedAt: 100,
      errorAt: 200,
      assistantCompletedAt: 300,
    };
    expect(resolveTransientSettledAt(state)).toBe(100);
  });

  it("falls back to errorAt when completedAt is null", () => {
    const state: TurnDiagnosticState = {
      ...baseDiagnostic,
      completedAt: null,
      errorAt: 200,
      assistantCompletedAt: 300,
    };
    expect(resolveTransientSettledAt(state)).toBe(200);
  });

  it("falls back to assistantCompletedAt when earlier timestamps are null", () => {
    const state: TurnDiagnosticState = {
      ...baseDiagnostic,
      completedAt: null,
      errorAt: null,
      assistantCompletedAt: 300,
    };
    expect(resolveTransientSettledAt(state)).toBe(300);
  });

  it("returns null for active turns with no settled timestamp", () => {
    expect(resolveTransientSettledAt(baseDiagnostic)).toBeNull();
  });
});

describe("cleanupThreadTransientState", () => {
  it("cleans diagnostic, quarantine, and assistant snapshot ingress for a thread", () => {
    const refs = {
      turnDiagnosticsRef: {
        current: new Map([
          ["thread-1", baseDiagnostic],
          ["thread-2", { ...baseDiagnostic, threadId: "thread-2" }],
        ]),
      },
      quarantinedCodexTurnsRef: {
        current: new Map([
          [
            "thread-1\u0000turn-1",
            {
              workspaceId: "ws-1",
              threadId: "thread-1",
              turnId: "turn-1",
              settledAt: 123,
              reason: "test",
              source: "test",
            },
          ],
        ]),
      },
      assistantSnapshotIngressLengthRef: {
        current: new Map([
          ["thread-1\u0000assistant-1", 10],
          ["thread-2\u0000assistant-2", 20],
        ]),
      },
    };

    const cleaned = cleanupThreadTransientState(refs, "ws-1", "thread-1");

    expect(cleaned).toBe(3);
    expect(refs.turnDiagnosticsRef.current.has("thread-1")).toBe(false);
    expect(refs.turnDiagnosticsRef.current.has("thread-2")).toBe(true);
    expect(refs.quarantinedCodexTurnsRef.current.has("thread-1\u0000turn-1")).toBe(false);
    expect(refs.assistantSnapshotIngressLengthRef.current.has("thread-1\u0000assistant-1")).toBe(false);
    expect(refs.assistantSnapshotIngressLengthRef.current.has("thread-2\u0000assistant-2")).toBe(true);
  });
});
