import { describe, expect, it } from "vitest";
import type { CheckpointPolicyEvidence, Policy } from "./policyTypes";
import {
  createPolicyAuditBuffer,
  createPolicyRegistry,
  evaluatePolicyChain,
} from "./policyRegistry";

function baseEvidence(overrides: Partial<CheckpointPolicyEvidence> = {}): CheckpointPolicyEvidence {
  return {
    failedCommand: null,
    failedCommandKind: null,
    failedSubagent: null,
    failedValidation: null,
    fileChanges: [],
    governanceSnapshot: null,
    hasCompletedSubagentSet: false,
    hasCompletedTodoSet: false,
    hasEvidence: false,
    hasReadyValidations: false,
    hasRunningCommand: false,
    hasRunningSubagent: false,
    hasSuccessfulCommand: false,
    hasInProgressTodo: false,
    isProcessing: false,
    requiredKinds: ["lint", "typecheck", "tests"],
    validations: [],
    ...overrides,
  };
}

function constantPolicy(
  id: string,
  verdictContribution: "ready" | "running" | "needs_review" | "blocked" | "no_contribution",
): Policy {
  return {
    id,
    appliesTo() {
      return true;
    },
    evaluate() {
      return {
        policyId: id,
        verdictContribution,
        enforcement: verdictContribution === "blocked" ? "blocking" : verdictContribution === "needs_review" ? "advisory" : "informational",
        reasonKey: `statusPanel.policy.${id}`,
        sourceId: null,
      };
    },
  };
}

describe("policy registry", () => {
  it("keeps corePolicy in the chain even if callers omit it", () => {
    const result = evaluatePolicyChain(baseEvidence(), [constantPolicy("custom", "ready")]);

    expect(result.decisions.map((entry) => entry.policyId)).toEqual(["corePolicy", "custom"]);
  });

  it("uses most-severe-wins while preserving decision order", () => {
    const result = evaluatePolicyChain(baseEvidence(), [
      constantPolicy("readyPolicy", "ready"),
      constantPolicy("reviewPolicy", "needs_review"),
      constantPolicy("runningPolicy", "running"),
    ]);

    expect(result.verdict).toBe("needs_review");
    expect(result.decisions.map((entry) => entry.policyId)).toEqual([
      "corePolicy",
      "readyPolicy",
      "reviewPolicy",
      "runningPolicy",
    ]);
  });

  it("ignores no_contribution for final verdict", () => {
    const result = evaluatePolicyChain(baseEvidence({ hasEvidence: true }), [
      constantPolicy("quietPolicy", "no_contribution"),
    ]);

    expect(result.verdict).toBe("needs_review");
    expect(result.decisions.at(-1)?.verdictContribution).toBe("no_contribution");
  });

  it("deduplicates repeated policy decisions without dropping distinct sources", () => {
    const duplicatePolicy = constantPolicy("duplicate", "needs_review");
    const distinctPolicy: Policy = {
      id: "duplicate",
      appliesTo() {
        return true;
      },
      evaluate() {
        return {
          policyId: "duplicate",
          verdictContribution: "needs_review",
          enforcement: "advisory",
          reasonKey: "statusPanel.policy.duplicate",
          sourceId: "large-file",
          evidenceSnapshotId: "snapshot-1",
        };
      },
    };

    const result = evaluatePolicyChain(baseEvidence({ hasEvidence: true }), [
      duplicatePolicy,
      duplicatePolicy,
      distinctPolicy,
    ]);

    expect(result.decisions.filter((entry) => entry.policyId === "duplicate")).toEqual([
      expect.objectContaining({
        sourceId: null,
      }),
      expect.objectContaining({
        sourceId: "large-file",
      }),
    ]);
  });

  it("registers and unregisters optional policies without removing corePolicy", () => {
    const registry = createPolicyRegistry();
    registry.register(constantPolicy("temporary", "ready"));
    expect(registry.list().map((entry) => entry.id)).toContain("temporary");

    registry.unregister("temporary");
    registry.unregister("corePolicy");

    expect(registry.list().map((entry) => entry.id)).toEqual(["corePolicy"]);
  });

  it("bounds audit entries in memory with FIFO eviction", () => {
    const buffer = createPolicyAuditBuffer(2);
    buffer.push({ id: "1", createdAt: 1, verdict: "ready", decisions: [] });
    buffer.push({ id: "2", createdAt: 2, verdict: "running", decisions: [] });
    buffer.push({ id: "3", createdAt: 3, verdict: "blocked", decisions: [] });

    expect(buffer.list().map((entry) => entry.id)).toEqual(["2", "3"]);
  });

  it("normalizes invalid audit limits without hanging", () => {
    const disabledBuffer = createPolicyAuditBuffer(-1);
    disabledBuffer.push({ id: "negative", createdAt: 1, verdict: "ready", decisions: [] });
    expect(disabledBuffer.list()).toEqual([]);

    const zeroBuffer = createPolicyAuditBuffer(0);
    zeroBuffer.push({ id: "zero", createdAt: 1, verdict: "ready", decisions: [] });
    expect(zeroBuffer.list()).toEqual([]);

    const fractionalBuffer = createPolicyAuditBuffer(1.9);
    fractionalBuffer.push({ id: "1", createdAt: 1, verdict: "ready", decisions: [] });
    fractionalBuffer.push({ id: "2", createdAt: 2, verdict: "blocked", decisions: [] });
    expect(fractionalBuffer.list().map((entry) => entry.id)).toEqual(["2"]);

    const fallbackBuffer = createPolicyAuditBuffer(Number.POSITIVE_INFINITY);
    fallbackBuffer.push({ id: "finite-fallback", createdAt: 1, verdict: "ready", decisions: [] });
    expect(fallbackBuffer.list().map((entry) => entry.id)).toEqual(["finite-fallback"]);
  });
});
