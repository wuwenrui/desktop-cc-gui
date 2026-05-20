import type { PolicyDecision } from "../policies";

type TranslationFn = (key: string, options?: Record<string, unknown>) => string;

export type FormattedPolicyDecision = {
  policyLabel: string;
  verdictLabel: string;
  enforcementLabel: string;
  reasonLabel: string;
  sourceLabel: string;
  evidenceSnapshotLabel: string | null;
  evidenceSnapshotTitle: string | null;
  degradationLabel: string | null;
  staleLabel: string | null;
  hasSource: boolean;
};

const MAX_AUDIT_TOKEN_LENGTH = 72;

function normalizeToken(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : null;
}

function compactAuditToken(value: string | null) {
  if (!value || value.length <= MAX_AUDIT_TOKEN_LENGTH) {
    return value;
  }
  const headLength = 42;
  const tailLength = MAX_AUDIT_TOKEN_LENGTH - headLength - 1;
  return `${value.slice(0, headLength)}…${value.slice(-tailLength)}`;
}

function resolveReasonLabel(t: TranslationFn, decision: PolicyDecision) {
  const reasonKey = normalizeToken(decision.reasonKey);
  if (reasonKey) {
    return t(reasonKey);
  }
  return t("statusPanel.audit.reasonUnavailable", {
    policy: decision.policyId,
  });
}

export function formatPolicyDecision(
  decision: PolicyDecision,
  t: TranslationFn,
): FormattedPolicyDecision {
  const sourceId = normalizeToken(decision.sourceId);
  const evidenceSnapshotId = normalizeToken(decision.evidenceSnapshotId);

  return {
    policyLabel: decision.policyId,
    verdictLabel: t(
      `statusPanel.policy.verdict.${decision.verdictContribution}`,
    ),
    enforcementLabel: t(
      `statusPanel.audit.enforcement.${decision.enforcement}`,
    ),
    reasonLabel: resolveReasonLabel(t, decision),
    sourceLabel: sourceId ?? t("statusPanel.audit.sourceUnavailable"),
    evidenceSnapshotLabel: compactAuditToken(evidenceSnapshotId),
    evidenceSnapshotTitle: evidenceSnapshotId,
    degradationLabel: normalizeToken(decision.degradationReason),
    staleLabel: normalizeToken(decision.staleAt),
    hasSource: sourceId !== null,
  };
}
