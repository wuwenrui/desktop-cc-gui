import type { GovernanceEvidence } from "../types";

type ExpectedReplayDecision = {
  readonly policyId: string;
  readonly verdictContribution: "ready" | "needs_review";
  readonly sourceId: GovernanceEvidence["source"];
  readonly degradationReason?: string;
};

export type GovernanceEvidenceReplayFixture = {
  readonly id: string;
  readonly createdAt: string;
  readonly evidence: readonly GovernanceEvidence[];
  readonly expectedPolicyDecisions: readonly ExpectedReplayDecision[];
};

export const governanceEvidenceReplayFixture: GovernanceEvidenceReplayFixture = {
  id: "governance-replay:s6-release-grade",
  createdAt: "2026-05-20T00:00:00.000Z",
  evidence: [
    {
      id: "cost-budget:fixture-session",
      source: "cost-budget",
      status: "pass",
      degraded: false,
      updatedAt: "2026-05-20T00:00:00.000Z",
      title: "Cost budget",
      summary: "Fixture cost budget evidence remained under the warning threshold.",
      payload: {
        kind: "cost-budget",
        tier: "info",
        severity: "info",
        amountUsd: 1,
        thresholdUsd: 10,
        currency: "USD",
        pricingSource: "fixture",
        shouldInterruptRuntime: false,
      },
      provenance: {
        sourceType: "fixture",
        sourceId: "cost-budget:fixture-session",
        observedAt: "2026-05-20T00:00:00.000Z",
        adapterId: "governance-replay-fixture@1",
        qualifier: "replay-pass",
      },
    },
    {
      id: "heavy-test-noise:.artifacts/replay/heavy-test-noise-warn.json",
      source: "heavy-test-noise",
      status: "warn",
      degraded: false,
      updatedAt: "2026-05-20T00:00:00.000Z",
      title: "Heavy test noise sentry",
      summary: "Fixture captured 2 advisory heavy-test-noise breach(es).",
      payload: {
        kind: "heavy-test-noise",
        breachCount: 2,
        sourcePath: ".artifacts/replay/heavy-test-noise-warn.json",
      },
      provenance: {
        sourceType: "artifact",
        sourceId: "heavy-test-noise:.artifacts/replay/heavy-test-noise-warn.json",
        observedAt: "2026-05-20T00:00:00.000Z",
        parserId: "heavy-test-noise-json-report@1",
        adapterId: "gate-artifact-evidence-reader@1",
        artifactPath: ".artifacts/replay/heavy-test-noise-warn.json",
        artifactHash: "fixture-heavy-test-noise-warn-sha256",
      },
    },
    {
      id: "large-file:.artifacts/replay/large-files-fail.json",
      source: "large-file",
      status: "fail",
      degraded: false,
      updatedAt: "2026-05-20T00:00:00.000Z",
      title: "Large-file hard gate",
      summary: "Fixture captured 1 blocking large-file finding.",
      payload: {
        kind: "large-file",
        scope: "fail",
        sourcePath: ".artifacts/replay/large-files-fail.json",
      },
      provenance: {
        sourceType: "artifact",
        sourceId: "large-file:.artifacts/replay/large-files-fail.json",
        observedAt: "2026-05-20T00:00:00.000Z",
        parserId: "large-file-json-report@1",
        adapterId: "gate-artifact-evidence-reader@1",
        artifactPath: ".artifacts/replay/large-files-fail.json",
        artifactHash: "fixture-large-files-fail-sha256",
      },
    },
    {
      id: "openspec:tasks",
      source: "openspec",
      status: "unknown",
      degraded: true,
      degradationReason: "governance-evidence-unavailable",
      updatedAt: "2026-05-20T00:00:00.000Z",
      title: "OpenSpec tasks",
      summary: "Fixture captured missing OpenSpec task evidence.",
      payload: {
        kind: "legacy-workspace-evidence",
      },
      provenance: {
        sourceType: "fixture",
        sourceId: "openspec:tasks",
        observedAt: "2026-05-20T00:00:00.000Z",
        adapterId: "governance-replay-fixture@1",
        qualifier: "replay-unknown",
      },
    },
  ],
  expectedPolicyDecisions: [
    {
      policyId: "openspecGovernancePolicy",
      verdictContribution: "needs_review",
      sourceId: "openspec",
      degradationReason: "governance-evidence-unavailable",
    },
    {
      policyId: "largeFileGovernancePolicy",
      verdictContribution: "needs_review",
      sourceId: "large-file",
    },
    {
      policyId: "heavyTestNoiseGovernancePolicy",
      verdictContribution: "needs_review",
      sourceId: "heavy-test-noise",
    },
    {
      policyId: "costBudgetGovernancePolicy",
      verdictContribution: "ready",
      sourceId: "cost-budget",
    },
  ],
};
