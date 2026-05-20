import { describe, expect, it } from "vitest";
import { buildCheckpointViewModel } from "../../status-panel/utils/checkpoint";
import { createFrozenGovernanceEvidenceSnapshot } from "./governanceEvidenceBridge";
import { governanceEvidenceReplayFixture } from "./fixtures/governanceEvidenceReplayFixtures";

describe("governance evidence replay", () => {
  it("replays frozen fixture evidence into deterministic checkpoint policy decisions", () => {
    const snapshot = createFrozenGovernanceEvidenceSnapshot({
      id: governanceEvidenceReplayFixture.id,
      createdAt: governanceEvidenceReplayFixture.createdAt,
      evidence: governanceEvidenceReplayFixture.evidence,
    });

    const checkpoint = buildCheckpointViewModel({
      todos: [],
      subagents: [],
      fileChanges: [],
      commands: [],
      isProcessing: false,
      governanceSnapshot: snapshot,
    });

    expect(snapshot.evidence.every((entry) => entry.provenance?.sourceId)).toBe(true);
    expect(snapshot.evidence.every((entry) => entry.provenance?.observedAt)).toBe(true);
    expect(
      snapshot.evidence
        .filter((entry) => entry.provenance?.sourceType === "artifact")
        .every(
          (entry) =>
            entry.provenance?.artifactPath &&
            entry.provenance.artifactHash &&
            (entry.provenance.parserId || entry.provenance.adapterId),
        ),
    ).toBe(true);
    expect(
      snapshot.evidence
        .filter((entry) => entry.status === "unknown" || entry.degraded)
        .every((entry) => Boolean(entry.degradationReason ?? entry.provenance?.qualifier)),
    ).toBe(true);
    expect(
      checkpoint.policyAudit
        .filter((decision) =>
          governanceEvidenceReplayFixture.expectedPolicyDecisions.some(
            (expected) => expected.policyId === decision.policyId,
          ),
        )
        .map((decision) => {
          const replayDecision = {
            policyId: decision.policyId,
            verdictContribution: decision.verdictContribution,
            sourceId: decision.sourceId,
            degradationReason: decision.degradationReason,
          };
          return replayDecision;
        }),
    ).toEqual(governanceEvidenceReplayFixture.expectedPolicyDecisions);
  });

  it("keeps replay fixtures workspace-relative", () => {
    const serializedFixture = JSON.stringify(governanceEvidenceReplayFixture);

    expect(serializedFixture).not.toMatch(/\/Users\//);
    expect(serializedFixture).not.toMatch(/[A-Za-z]:\\/);
  });
});
