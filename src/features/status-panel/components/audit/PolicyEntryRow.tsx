import { useTranslation } from "react-i18next";
import type { PolicyDecision } from "../../utils/policies";
import { formatPolicyDecision } from "../../utils/audit/policyDecisionFormatter";

type PolicyEntryRowProps = {
  decision: PolicyDecision;
};

export function PolicyEntryRow({ decision }: PolicyEntryRowProps) {
  const { t } = useTranslation();
  const formatted = formatPolicyDecision(decision, t);

  return (
    <li
      className={`sp-checkpoint-risk-item sp-policy-audit-row is-${decision.enforcement}`}
    >
      <span
        className={`sp-checkpoint-risk-severity is-${decision.verdictContribution}`}
      >
        {formatted.verdictLabel}
      </span>
      <span className="sp-policy-audit-copy">
        <span className="sp-policy-audit-policy">{formatted.policyLabel}</span>
        <span
          className={`sp-policy-audit-enforcement is-${decision.enforcement}`}
        >
          {formatted.enforcementLabel}
        </span>
        <span>{formatted.reasonLabel}</span>
        <span
          className={`sp-policy-audit-source${formatted.hasSource ? "" : " is-missing"}`}
        >
          {formatted.sourceLabel}
        </span>
        {formatted.evidenceSnapshotLabel ? (
          <span
            className="sp-policy-audit-source"
            title={formatted.evidenceSnapshotTitle ?? undefined}
          >
            {formatted.evidenceSnapshotLabel}
          </span>
        ) : null}
        {formatted.degradationLabel ? (
          <span className="sp-policy-audit-source is-missing">
            {formatted.degradationLabel}
          </span>
        ) : null}
        {formatted.staleLabel ? (
          <span className="sp-policy-audit-source is-missing">
            {formatted.staleLabel}
          </span>
        ) : null}
      </span>
    </li>
  );
}
