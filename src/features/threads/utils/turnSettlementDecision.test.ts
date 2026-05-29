import { describe, expect, it } from "vitest";
import {
  DEFAULT_TURN_SETTLEMENT_POLICY,
  evaluateTurnSettlement,
  toDryRunSettlementDecisionLabel,
  type TurnSettlementEvidence,
} from "./turnSettlementDecision";

const NOW_MS = 1_000_000;

function evidence(
  overrides: Partial<TurnSettlementEvidence> = {},
): TurnSettlementEvidence {
  return {
    workspaceId: "ws-1",
    engine: "codex",
    threadId: "thread-1",
    turnId: "turn-1",
    runtimeSessionId: null,
    runtimeLeaseId: null,
    source: "event",
    scope: {
      foreground: true,
      currentWorkspaceId: "ws-1",
      currentEngine: "codex",
      currentThreadId: "thread-1",
      currentTurnId: "turn-1",
      currentRuntimeLeaseId: null,
    },
    terminal: {
      kind: "completed",
      sourceMethod: "turn/completed",
      receivedAtMs: NOW_MS,
      finalContentPresent: false,
    },
    state: {
      isProcessing: false,
      activeTurnId: null,
      aliasTurnId: null,
      blockers: [],
    },
    progress: {
      lastSource: null,
      lastAtMs: null,
      ageMs: null,
      sequence: 0,
      fresh: false,
    },
    ...overrides,
  };
}

describe("evaluateTurnSettlement", () => {
  it("settles matched terminal evidence when lifecycle state is already idle", () => {
    const decision = evaluateTurnSettlement(
      evidence(),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("settle");
    expect(decision.reason).toBe("matched-terminal");
    expect(decision.scopeMatch.matched).toBe(true);
    expect(toDryRunSettlementDecisionLabel(decision.action)).toBe("wouldSettle");
  });

  it("reports busy residue without mutating lifecycle state", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        state: {
          isProcessing: true,
          activeTurnId: "turn-1",
          aliasTurnId: null,
          blockers: [],
        },
      }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("cleanup-residue");
    expect(decision.reason).toBe("busy-residue");
    expect(decision.diagnostics.residue).toBe(true);
    expect(toDryRunSettlementDecisionLabel(decision.action)).toBe("wouldCleanupResidue");
  });

  it("rejects missing required scope", () => {
    const decision = evaluateTurnSettlement(
      evidence({ workspaceId: "" }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("reject");
    expect(decision.reason).toBe("missing-scope");
    expect(decision.diagnostics.missingScope).toContain("workspaceId");
  });

  it("rejects cross-thread evidence before terminal arbitration", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        scope: {
          foreground: true,
          currentWorkspaceId: "ws-1",
          currentEngine: "codex",
          currentThreadId: "thread-2",
          currentTurnId: "turn-1",
          currentRuntimeLeaseId: null,
        },
      }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("reject");
    expect(decision.reason).toBe("scope-mismatch");
    expect(decision.scopeMatch.thread).toBe(false);
  });

  it("defers stale turn evidence", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        turnId: "turn-old",
        scope: {
          foreground: true,
          currentWorkspaceId: "ws-1",
          currentEngine: "codex",
          currentThreadId: "thread-1",
          currentTurnId: "turn-new",
          currentRuntimeLeaseId: null,
        },
        state: {
          isProcessing: true,
          activeTurnId: "turn-new",
          aliasTurnId: null,
          blockers: [],
        },
      }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("defer");
    expect(decision.reason).toBe("stale-turn");
    expect(decision.diagnostics.staleEvidence).toBe(true);
  });

  it("defers stale runtime lease evidence", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        runtimeLeaseId: "lease-old",
        scope: {
          foreground: true,
          currentWorkspaceId: "ws-1",
          currentEngine: "codex",
          currentThreadId: "thread-1",
          currentTurnId: "turn-1",
          currentRuntimeLeaseId: "lease-new",
        },
      }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("defer");
    expect(decision.reason).toBe("stale-runtime-lease");
    expect(decision.scopeMatch.runtimeLease).toBe(false);
  });

  it("keeps running when terminal evidence is absent but progress is fresh", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        terminal: {
          kind: null,
          sourceMethod: null,
          receivedAtMs: null,
        },
        progress: {
          lastSource: "tool-updated",
          lastAtMs: NOW_MS - 1_000,
          ageMs: 1_000,
          sequence: 4,
          fresh: true,
        },
      }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("keep-running");
    expect(decision.reason).toBe("progress-protected");
  });

  it("requests reconciliation when terminal evidence is absent and progress is stale", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        terminal: {
          kind: null,
          sourceMethod: null,
          receivedAtMs: null,
        },
        progress: {
          lastSource: "delta",
          lastAtMs: NOW_MS - 60_000,
          ageMs: 60_000,
          sequence: 1,
          fresh: false,
        },
      }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("request-reconciliation");
    expect(decision.reason).toBe("needs-authoritative-status");
    expect(toDryRunSettlementDecisionLabel(decision.action)).toBe("wouldRequestReconciliation");
  });

  it("treats progress at the freshness window boundary as stale", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        terminal: {
          kind: null,
          sourceMethod: null,
          receivedAtMs: null,
        },
        progress: {
          lastSource: "delta",
          lastAtMs: NOW_MS - DEFAULT_TURN_SETTLEMENT_POLICY.progressFreshWindowMs,
          ageMs: DEFAULT_TURN_SETTLEMENT_POLICY.progressFreshWindowMs,
          sequence: 1,
          fresh: false,
        },
      }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("request-reconciliation");
    expect(decision.reason).toBe("needs-authoritative-status");
  });

  it("defers missing terminal when reconciliation is disabled", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        terminal: {
          kind: null,
          sourceMethod: null,
          receivedAtMs: null,
        },
      }),
      {
        ...DEFAULT_TURN_SETTLEMENT_POLICY,
        allowStatusQueryReconciliation: false,
      },
      NOW_MS,
    );

    expect(decision.action).toBe("defer");
    expect(decision.reason).toBe("missing-terminal");
  });

  it("keeps running when authoritative status reports running", () => {
    const decision = evaluateTurnSettlement(
      evidence({
        terminal: {
          kind: null,
          sourceMethod: null,
          receivedAtMs: null,
        },
        reconciliation: {
          attempted: true,
          status: "running",
          replayRequested: false,
        },
      }),
      DEFAULT_TURN_SETTLEMENT_POLICY,
      NOW_MS,
    );

    expect(decision.action).toBe("keep-running");
    expect(decision.reason).toBe("status-confirmed-running");
  });
});
