import { describe, expect, it } from "vitest";
import {
  createFrozenGovernanceEvidenceSnapshot,
  createHarnessGovernanceEvidence,
} from "../../../governance/evidence";
import {
  bridgeGovernancePolicies,
  costBudgetGovernancePolicy,
  engineRuntimeGovernancePolicy,
} from "./bridgeGovernancePolicies";
import type { CheckpointPolicyEvidence } from "./policyTypes";

function baseEvidence(
  overrides: Partial<CheckpointPolicyEvidence> = {},
): CheckpointPolicyEvidence {
  return {
    failedCommand: null,
    failedCommandKind: null,
    failedSubagent: null,
    failedValidation: null,
    fileChanges: [],
    governanceSnapshot: null,
    hasCompletedSubagentSet: false,
    hasCompletedTodoSet: false,
    hasEvidence: true,
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

describe("bridge governance policies", () => {
  it("consume injected frozen snapshots without blocked contribution", () => {
    const snapshot = createFrozenGovernanceEvidenceSnapshot({
      id: "snapshot-1",
      evidence: [
        createHarnessGovernanceEvidence({
          id: "cost-budget:session-1",
          source: "cost-budget",
          status: "fail",
          title: "Cost budget",
          summary: "Block tier crossed",
          payload: {
            kind: "cost-budget",
            tier: "block",
            severity: "critical",
            amountUsd: 12,
            thresholdUsd: 10,
            currency: "USD",
            pricingSource: "fixture",
            shouldInterruptRuntime: false,
          },
        }),
      ],
    });

    const decision = costBudgetGovernancePolicy.evaluate(
      baseEvidence({ governanceSnapshot: snapshot }),
    );

    expect(decision).toMatchObject({
      policyId: "costBudgetGovernancePolicy",
      verdictContribution: "needs_review",
      enforcement: "advisory",
      reasonKey: "statusPanel.policy.costBudgetGovernancePolicy.fail",
      sourceId: "cost-budget",
      evidenceSnapshotId: "snapshot-1",
    });
    expect(decision.verdictContribution).not.toBe("blocked");
  });

  it("registers the expected second-batch bridge-fed policies", () => {
    expect(bridgeGovernancePolicies.map((policy) => policy.id)).toEqual([
      "openspecGovernancePolicy",
      "largeFileGovernancePolicy",
      "heavyTestNoiseGovernancePolicy",
      "realtimeHarnessGovernancePolicy",
      "capabilityMismatchGovernancePolicy",
      "engineRuntimeGovernancePolicy",
      "costBudgetGovernancePolicy",
    ]);
  });

  it("does not invent warnings for non-applicable missing governance capabilities", () => {
    const snapshot = createFrozenGovernanceEvidenceSnapshot({
      id: "python-profile-snapshot",
      evidence: [
        createHarnessGovernanceEvidence({
          id: "ecosystem:python:verification",
          source: "script",
          status: "pass",
          title: "Python verification surface",
          summary: "Detected Python project metadata.",
        }),
      ],
    });

    const decision = bridgeGovernancePolicies
      .find((policy) => policy.id === "largeFileGovernancePolicy")
      ?.evaluate(baseEvidence({ governanceSnapshot: snapshot }));

    expect(decision).toMatchObject({
      policyId: "largeFileGovernancePolicy",
      verdictContribution: "no_contribution",
      enforcement: "informational",
      sourceId: null,
    });
  });

  it("preserves provenance fields for evidence trail rendering", () => {
    const snapshot = createFrozenGovernanceEvidenceSnapshot({
      id: "snapshot-provenance",
      evidence: [
        createHarnessGovernanceEvidence({
          id: "engine-runtime-contract:runtime",
          source: "engine-runtime-contract",
          status: "warn",
          title: "Runtime contract",
          summary: "Runtime contract is externally qualified.",
          payload: {
            kind: "engine-runtime-contract",
            contractId: "runtime",
            sourcePath: ".artifacts/runtime-contract.json",
          },
          provenance: {
            sourceType: "artifact",
            sourceId: "engine-runtime-contract:runtime",
            observedAt: "2026-05-20T00:00:00.000Z",
            artifactPath: ".artifacts/runtime-contract.json",
            artifactHash: "sha256:runtime",
            qualifier: "external-ci-qualifier",
          },
        }),
      ],
    });

    const decision = engineRuntimeGovernancePolicy.evaluate(
      baseEvidence({ governanceSnapshot: snapshot }),
    );

    expect(decision).toMatchObject({
      policyId: "engineRuntimeGovernancePolicy",
      verdictContribution: "needs_review",
      enforcement: "advisory",
      sourceId: "engine-runtime-contract",
      evidenceSnapshotId: "snapshot-provenance",
      evidenceObservedAt: "2026-05-20T00:00:00.000Z",
      evidenceArtifactPath: ".artifacts/runtime-contract.json",
      evidenceArtifactHash: "sha256:runtime",
      evidenceQualifier: "external-ci-qualifier",
    });
    expect(decision.verdictContribution).not.toBe("blocked");
  });

  it("keeps degraded pass evidence in needs_review instead of treating it as fresh ready", () => {
    const snapshot = createFrozenGovernanceEvidenceSnapshot({
      id: "snapshot-stale",
      evidence: [
        createHarnessGovernanceEvidence({
          id: "large-file:.artifacts/large-files-gate.json",
          source: "large-file",
          status: "pass",
          title: "Large-file hard gate",
          summary: "0 blocking findings, but artifact is stale.",
          staleAt: "2026-05-19T00:00:00.000Z",
          degraded: true,
          degradationReason: "governance-artifact-stale",
          payload: {
            kind: "large-file",
            scope: "fail",
            sourcePath: ".artifacts/large-files-gate.json",
          },
        }),
      ],
    });

    const decision = bridgeGovernancePolicies
      .find((policy) => policy.id === "largeFileGovernancePolicy")
      ?.evaluate(baseEvidence({ governanceSnapshot: snapshot }));

    expect(decision).toMatchObject({
      policyId: "largeFileGovernancePolicy",
      verdictContribution: "needs_review",
      enforcement: "advisory",
      degradationReason: "governance-artifact-stale",
      staleAt: "2026-05-19T00:00:00.000Z",
    });
  });

  it("uses the most severe same-source evidence instead of the first sorted item", () => {
    const snapshot = createFrozenGovernanceEvidenceSnapshot({
      id: "snapshot-same-source",
      evidence: [
        createHarnessGovernanceEvidence({
          id: "large-file:001-pass",
          source: "large-file",
          status: "pass",
          title: "Large-file pass",
          summary: "No blocking findings.",
        }),
        createHarnessGovernanceEvidence({
          id: "large-file:999-warn",
          source: "large-file",
          status: "warn",
          title: "Large-file warning",
          summary: "Near threshold.",
          payload: {
            kind: "large-file",
            scope: "warn",
            sourcePath: ".artifacts/large-files-near-threshold.json",
          },
        }),
      ],
    });

    const decision = bridgeGovernancePolicies
      .find((policy) => policy.id === "largeFileGovernancePolicy")
      ?.evaluate(baseEvidence({ governanceSnapshot: snapshot }));

    expect(decision).toMatchObject({
      verdictContribution: "needs_review",
      enforcement: "advisory",
      reasonKey: "statusPanel.policy.largeFileGovernancePolicy.warn",
      evidenceArtifactPath: ".artifacts/large-files-near-threshold.json",
    });
  });

  it("keeps warn, fail, unknown, malformed, and platform-qualified evidence advisory-only", () => {
    const snapshot = createFrozenGovernanceEvidenceSnapshot({
      id: "snapshot-advisory-only",
      evidence: [
        {
          id: "openspec:warning",
          source: "openspec",
          status: "warn",
          degraded: false,
          updatedAt: "1970-01-01T00:00:00.000Z",
          title: "OpenSpec warning",
          summary: "Historical title warning.",
        },
        createHarnessGovernanceEvidence({
          id: "large-file:fail",
          source: "large-file",
          status: "fail",
          title: "Large-file gate",
          summary: "Large file detected.",
          payload: {
            kind: "large-file",
            scope: "fail",
            sourcePath: ".artifacts/large-files-gate.json",
          },
        }),
        createHarnessGovernanceEvidence({
          id: "heavy-test-noise:malformed",
          source: "heavy-test-noise",
          status: "unknown",
          degraded: true,
          degradationReason: "governance-artifact-malformed",
          title: "Heavy test noise",
          summary: "Malformed report.",
        }),
        createHarnessGovernanceEvidence({
          id: "engine-capability-matrix:platform",
          source: "engine-capability-matrix",
          status: "unknown",
          degraded: true,
          degradationReason: "external-ci-qualifier",
          title: "Engine capability matrix",
          summary: "Windows evidence is externally qualified.",
        }),
        createHarnessGovernanceEvidence({
          id: "engine-runtime-contract:platform",
          source: "engine-runtime-contract",
          status: "unknown",
          degraded: true,
          degradationReason: "external-ci-qualifier",
          title: "Engine runtime contract",
          summary: "Linux evidence is externally qualified.",
        }),
      ],
    });

    const decisions = bridgeGovernancePolicies
      .map((policy) =>
        policy.evaluate(baseEvidence({ governanceSnapshot: snapshot })),
      )
      .filter((decision) => decision.verdictContribution !== "no_contribution");

    expect(decisions.map((decision) => decision.verdictContribution)).toEqual([
      "needs_review",
      "needs_review",
      "needs_review",
      "needs_review",
      "needs_review",
    ]);
    expect(
      decisions.every((decision) => decision.enforcement === "advisory"),
    ).toBe(true);
    expect(
      decisions.every((decision) => decision.verdictContribution !== "blocked"),
    ).toBe(true);
  });
});
