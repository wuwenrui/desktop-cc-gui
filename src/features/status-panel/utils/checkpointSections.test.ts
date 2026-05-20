import { describe, expect, it } from "vitest";
import type { CheckpointViewModel } from "../types";
import { buildCheckpointSectionProjection } from "./checkpointSections";

function checkpoint(overrides: Partial<CheckpointViewModel> = {}): CheckpointViewModel {
  return {
    verdict: "needs_review",
    headline: { key: "headline" },
    summary: { key: "summary" },
    policyAudit: [],
    evidence: {
      changedFiles: 0,
      additions: 0,
      deletions: 0,
      validations: [],
      commands: [],
      todos: null,
      subagents: null,
    },
    keyChanges: [],
    risks: [],
    nextActions: [],
    sources: [],
    ...overrides,
  };
}

describe("buildCheckpointSectionProjection", () => {
  it("projects advisory signals, evidence trail, and optional governance commands", () => {
    const projection = buildCheckpointSectionProjection({
      checkpoint: checkpoint({
        policyAudit: [
          {
            policyId: "openspecGovernancePolicy",
            verdictContribution: "needs_review",
            enforcement: "advisory",
            reasonKey: "statusPanel.policy.openspecGovernancePolicy.warn",
            sourceId: "openspec",
            evidenceSnapshotId: "snapshot-1",
            evidenceObservedAt: "2026-05-20T00:00:00.000Z",
            evidenceArtifactPath: ".artifacts/openspec.json",
            evidenceArtifactHash: "sha256:abc",
            evidenceQualifier: "external-ci-qualifier",
            degradationReason: "spec-title-warning",
          },
          {
            policyId: "corePolicy",
            verdictContribution: "ready",
            enforcement: "informational",
            reasonKey: "statusPanel.policy.corePolicy.ready",
            sourceId: null,
          },
        ],
      }),
      missingValidationCommands: [],
      includeValidationSuggestedActions: false,
    });

    expect(projection.advisorySignals).toEqual([
      expect.objectContaining({
        policyId: "openspecGovernancePolicy",
        sourceId: "openspec",
      }),
    ]);
    expect(projection.evidenceTrail).toEqual([
      expect.objectContaining({
        sourceId: "openspec",
        evidenceSnapshotId: "snapshot-1",
        observedAt: "2026-05-20T00:00:00.000Z",
        artifactPath: ".artifacts/openspec.json",
        artifactHash: "sha256:abc",
        qualifier: "external-ci-qualifier",
        degradationReason: "spec-title-warning",
      }),
    ]);
    expect(projection.suggestedActions).toEqual([
      expect.objectContaining({
        command: "openspec validate --all --strict --no-interactive",
        sourceId: "openspec",
      }),
    ]);
  });

  it("keeps validation commands optional and removable from compact needs-review flows", () => {
    const withValidationAction = buildCheckpointSectionProjection({
      checkpoint: checkpoint(),
      missingValidationCommands: [{ kind: "typecheck", command: "npm run typecheck" }],
      includeValidationSuggestedActions: true,
    });
    const withoutValidationAction = buildCheckpointSectionProjection({
      checkpoint: checkpoint(),
      missingValidationCommands: [{ kind: "typecheck", command: "npm run typecheck" }],
      includeValidationSuggestedActions: false,
    });

    expect(withValidationAction.suggestedActions).toEqual([
      expect.objectContaining({
        command: "npm run typecheck",
        sourceId: "typecheck",
      }),
    ]);
    expect(withoutValidationAction.suggestedActions).toEqual([]);
  });
});
