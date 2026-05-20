import type { GovernanceEvidence } from "../../../governance/evidence";
import type {
  CheckpointPolicyEvidence,
  Policy,
  PolicyDecision,
  PolicyVerdictContribution,
} from "./policyTypes";

type BridgePolicyConfig = {
  id: string;
  source: GovernanceEvidence["source"];
  maxFailContribution?: Extract<PolicyVerdictContribution, "needs_review" | "running" | "ready">;
};

type AdvisoryBridgeContribution = Exclude<PolicyVerdictContribution, "blocked">;
const ADVISORY_CONTRIBUTION_SEVERITY: Record<AdvisoryBridgeContribution, number> = {
  no_contribution: 0,
  ready: 1,
  running: 2,
  needs_review: 3,
};

function contributionForEvidence(
  evidence: GovernanceEvidence,
  maxFailContribution: Extract<PolicyVerdictContribution, "needs_review" | "running" | "ready">,
): AdvisoryBridgeContribution {
  if (evidence.degraded || evidence.staleAt) {
    return maxFailContribution;
  }
  if (evidence.status === "pass" && !evidence.degraded && !evidence.staleAt) {
    return "ready";
  }
  if (evidence.status === "fail" || evidence.status === "warn" || evidence.status === "unknown") {
    return maxFailContribution;
  }
  return "no_contribution";
}

function enforcementForContribution(
  contribution: AdvisoryBridgeContribution,
): PolicyDecision["enforcement"] {
  if (contribution === "needs_review") {
    return "advisory";
  }
  return "informational";
}

function findEvidenceBySource(
  evidence: CheckpointPolicyEvidence,
  source: GovernanceEvidence["source"],
  maxFailContribution: Extract<PolicyVerdictContribution, "needs_review" | "running" | "ready">,
): GovernanceEvidence | null {
  const sourceEvidence = evidence.governanceSnapshot?.evidence.filter((entry) => entry.source === source) ?? [];
  let selected: GovernanceEvidence | null = null;
  let selectedSeverity = -1;
  for (const entry of sourceEvidence) {
    const contribution = contributionForEvidence(entry, maxFailContribution);
    const severity = ADVISORY_CONTRIBUTION_SEVERITY[contribution];
    if (!selected || severity > selectedSeverity) {
      selected = entry;
      selectedSeverity = severity;
    }
  }
  return selected;
}

function decisionFromEvidence(
  policyId: string,
  snapshotId: string,
  evidence: GovernanceEvidence,
  maxFailContribution: Extract<PolicyVerdictContribution, "needs_review" | "running" | "ready">,
): PolicyDecision {
  const verdictContribution = contributionForEvidence(evidence, maxFailContribution);
  return {
    policyId,
    verdictContribution,
    enforcement: enforcementForContribution(verdictContribution),
    reasonKey: `statusPanel.policy.${policyId}.${evidence.status}`,
    sourceId: evidence.source,
    evidenceSnapshotId: snapshotId,
    evidenceObservedAt: evidence.provenance?.observedAt ?? evidence.updatedAt,
    evidenceArtifactPath: evidence.provenance?.artifactPath ?? (
      evidence.payload && "sourcePath" in evidence.payload ? evidence.payload.sourcePath : undefined
    ),
    evidenceArtifactHash: evidence.provenance?.artifactHash,
    evidenceQualifier: evidence.provenance?.qualifier,
    degradationReason: evidence.degradationReason,
    staleAt: evidence.staleAt,
  };
}

function createBridgeGovernancePolicy(config: BridgePolicyConfig): Policy {
  const maxFailContribution = config.maxFailContribution ?? "needs_review";
  return {
    id: config.id,
    appliesTo(evidence) {
      return findEvidenceBySource(evidence, config.source, maxFailContribution) != null;
    },
    evaluate(evidence) {
      const snapshot = evidence.governanceSnapshot;
      const sourceEvidence = findEvidenceBySource(evidence, config.source, maxFailContribution);
      if (!snapshot || !sourceEvidence) {
        return {
          policyId: config.id,
          verdictContribution: "no_contribution",
          enforcement: "informational",
          reasonKey: null,
          sourceId: null,
        };
      }
      return decisionFromEvidence(config.id, snapshot.id, sourceEvidence, maxFailContribution);
    },
  };
}

export const openspecGovernancePolicy = createBridgeGovernancePolicy({
  id: "openspecGovernancePolicy",
  source: "openspec",
});

export const largeFileGovernancePolicy = createBridgeGovernancePolicy({
  id: "largeFileGovernancePolicy",
  source: "large-file",
});

export const heavyTestNoiseGovernancePolicy = createBridgeGovernancePolicy({
  id: "heavyTestNoiseGovernancePolicy",
  source: "heavy-test-noise",
});

export const realtimeHarnessGovernancePolicy = createBridgeGovernancePolicy({
  id: "realtimeHarnessGovernancePolicy",
  source: "realtime-harness",
});

export const capabilityMismatchGovernancePolicy = createBridgeGovernancePolicy({
  id: "capabilityMismatchGovernancePolicy",
  source: "engine-capability-matrix",
});

export const engineRuntimeGovernancePolicy = createBridgeGovernancePolicy({
  id: "engineRuntimeGovernancePolicy",
  source: "engine-runtime-contract",
});

export const costBudgetGovernancePolicy = createBridgeGovernancePolicy({
  id: "costBudgetGovernancePolicy",
  source: "cost-budget",
});

export const bridgeGovernancePolicies = [
  openspecGovernancePolicy,
  largeFileGovernancePolicy,
  heavyTestNoiseGovernancePolicy,
  realtimeHarnessGovernancePolicy,
  capabilityMismatchGovernancePolicy,
  engineRuntimeGovernancePolicy,
  costBudgetGovernancePolicy,
] as const;
