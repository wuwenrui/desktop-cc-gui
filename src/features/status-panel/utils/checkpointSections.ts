import type {
  CheckpointMessageToken,
  CheckpointValidationKind,
  CheckpointViewModel,
} from "../types";
import type { PolicyDecision } from "./policies";

type MissingValidationCommand = {
  kind: CheckpointValidationKind;
  command: string;
};

export type CheckpointAdvisorySignal = {
  id: string;
  policyId: string;
  verdictContribution: PolicyDecision["verdictContribution"];
  reasonKey: string | null;
  sourceId: string | null;
};

export type CheckpointEvidenceTrailItem = {
  id: string;
  policyId: string;
  sourceId: string | null;
  evidenceSnapshotId: string | null;
  observedAt: string | null;
  artifactPath: string | null;
  artifactHash: string | null;
  qualifier: string | null;
  degradationReason: string | null;
  staleAt: string | null;
};

export type CheckpointSuggestedActionProjection = {
  id: string;
  label: CheckpointMessageToken;
  command: string | null;
  sourceId: string | null;
};

export type CheckpointSectionProjection = {
  summary: {
    verdict: CheckpointViewModel["verdict"];
    headline: CheckpointMessageToken;
    summary: CheckpointMessageToken | null;
  };
  advisorySignals: CheckpointAdvisorySignal[];
  evidenceTrail: CheckpointEvidenceTrailItem[];
  policyAudit: PolicyDecision[];
  suggestedActions: CheckpointSuggestedActionProjection[];
};

const GOVERNANCE_SOURCE_COMMANDS: Partial<Record<string, string>> = {
  openspec: "openspec validate --all --strict --no-interactive",
  "large-file": "npm run check:large-files:gate",
  "heavy-test-noise": "npm run check:heavy-test-noise",
  "realtime-harness": "npm run perf:long-list:baseline",
  "engine-capability-matrix": "npm run check:engine-capability-matrix",
  "engine-runtime-contract": "npm run check:runtime-contracts",
  "cost-budget": "npm run check:context-ledger-cost-budget",
};

function decisionKey(decision: PolicyDecision) {
  return [
    decision.policyId,
    decision.verdictContribution,
    decision.sourceId ?? "none",
    decision.evidenceSnapshotId ?? "none",
    decision.evidenceObservedAt ?? "none",
    decision.evidenceArtifactPath ?? "none",
    decision.evidenceArtifactHash ?? "none",
    decision.evidenceQualifier ?? "none",
    decision.degradationReason ?? "none",
    decision.staleAt ?? "none",
  ].join(":");
}

function createSuggestedActionId(sourceId: string | null, command: string) {
  return `${sourceId ?? "validation"}:${command}`;
}

function buildValidationSuggestedActions(
  missingValidationCommands: readonly MissingValidationCommand[],
): CheckpointSuggestedActionProjection[] {
  return missingValidationCommands.map((entry) => ({
    id: createSuggestedActionId(entry.kind, entry.command),
    label: { key: "statusPanel.checkpoint.suggested.validation", params: { command: entry.command } },
    command: entry.command,
    sourceId: entry.kind,
  }));
}

function buildGovernanceSuggestedActions(
  advisorySignals: readonly CheckpointAdvisorySignal[],
): CheckpointSuggestedActionProjection[] {
  const seenCommands = new Set<string>();
  const actions: CheckpointSuggestedActionProjection[] = [];

  for (const signal of advisorySignals) {
    const sourceId = signal.sourceId;
    if (!sourceId) {
      continue;
    }
    const command = GOVERNANCE_SOURCE_COMMANDS[sourceId] ?? null;
    if (!command) {
      continue;
    }
    const actionId = createSuggestedActionId(sourceId, command);
    if (seenCommands.has(actionId)) {
      continue;
    }
    seenCommands.add(actionId);
    actions.push({
      id: actionId,
      label: {
        key: "statusPanel.checkpoint.suggested.governance",
        params: { source: sourceId, command },
      },
      command,
      sourceId,
    });
  }

  return actions;
}

export function buildCheckpointSectionProjection(input: {
  checkpoint: CheckpointViewModel;
  missingValidationCommands: readonly MissingValidationCommand[];
  includeValidationSuggestedActions: boolean;
}): CheckpointSectionProjection {
  const visiblePolicyAudit = input.checkpoint.policyAudit.filter(
    (entry) => entry.verdictContribution !== "no_contribution",
  );
  const advisorySignals = visiblePolicyAudit
    .filter((entry) => entry.enforcement === "advisory")
    .map((entry) => ({
      id: decisionKey(entry),
      policyId: entry.policyId,
      verdictContribution: entry.verdictContribution,
      reasonKey: entry.reasonKey,
      sourceId: entry.sourceId,
    }));
  const evidenceTrail = visiblePolicyAudit
    .filter(
      (entry) =>
        Boolean(entry.sourceId) ||
        Boolean(entry.evidenceSnapshotId) ||
        Boolean(entry.evidenceObservedAt) ||
        Boolean(entry.evidenceArtifactPath) ||
        Boolean(entry.evidenceArtifactHash) ||
        Boolean(entry.evidenceQualifier) ||
        Boolean(entry.degradationReason) ||
        Boolean(entry.staleAt),
    )
    .map((entry) => ({
      id: decisionKey(entry),
      policyId: entry.policyId,
      sourceId: entry.sourceId,
      evidenceSnapshotId: entry.evidenceSnapshotId ?? null,
      observedAt: entry.evidenceObservedAt ?? null,
      artifactPath: entry.evidenceArtifactPath ?? null,
      artifactHash: entry.evidenceArtifactHash ?? null,
      qualifier: entry.evidenceQualifier ?? null,
      degradationReason: entry.degradationReason ?? null,
      staleAt: entry.staleAt ?? null,
    }));
  const validationSuggestedActions = input.includeValidationSuggestedActions
    ? buildValidationSuggestedActions(input.missingValidationCommands)
    : [];

  return {
    summary: {
      verdict: input.checkpoint.verdict,
      headline: input.checkpoint.headline,
      summary: input.checkpoint.summary,
    },
    advisorySignals,
    evidenceTrail,
    policyAudit: visiblePolicyAudit,
    suggestedActions: [
      ...validationSuggestedActions,
      ...buildGovernanceSuggestedActions(advisorySignals),
    ],
  };
}
