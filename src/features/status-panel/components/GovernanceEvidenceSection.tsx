import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { GovernanceEvidence } from "../../governance/evidence";
import { groupGovernanceEvidence } from "../utils/governanceEvidenceViewModel";
import type { GovernanceEvidenceGroupId } from "../utils/governanceEvidenceViewModel";

type GovernanceEvidenceSectionProps = {
  evidence: readonly GovernanceEvidence[];
  isLoading?: boolean;
};

const STATUS_CLASS = {
  pass: "is-pass",
  warn: "is-warn",
  fail: "is-fail",
  unknown: "is-unknown",
} as const;

function isPassedGroup(groupId: GovernanceEvidenceGroupId) {
  return groupId === "passed";
}

function EvidenceRow({ entry }: { readonly entry: GovernanceEvidence }) {
  const { t } = useTranslation();
  const shouldShowMeta = entry.status !== "pass" || entry.degraded;

  return (
    <li className="sp-governance-evidence-item">
      <span
        className={`sp-governance-evidence-status ${STATUS_CLASS[entry.status]}`}
      >
        {t(`statusPanel.governance.status.${entry.status}`)}
      </span>
      <span className="sp-governance-evidence-title">{entry.title}</span>
      <span className="sp-governance-evidence-summary">{entry.summary}</span>
      {shouldShowMeta ? (
        <span className="sp-governance-evidence-meta">
          <span>
            {t("statusPanel.governance.meta.source", { source: entry.source })}
          </span>
          {entry.provenance?.artifactPath ? (
            <span>
              {t("statusPanel.governance.meta.artifact", {
                path: entry.provenance.artifactPath,
              })}
            </span>
          ) : null}
          {entry.degradationReason ? (
            <span>
              {t("statusPanel.governance.meta.action", {
                reason: entry.degradationReason,
              })}
            </span>
          ) : null}
        </span>
      ) : null}
    </li>
  );
}

export const GovernanceEvidenceSection = memo(
  function GovernanceEvidenceSection({
    evidence,
    isLoading = false,
  }: GovernanceEvidenceSectionProps) {
    const { t } = useTranslation();
    const groups = groupGovernanceEvidence(evidence);
    const needsActionCount =
      groups.find((group) => group.id === "needs_action")?.evidence.length ?? 0;

    if (!isLoading && evidence.length === 0) {
      return (
        <section className="sp-checkpoint-section sp-governance-evidence">
          <div className="sp-checkpoint-inline-heading">
            <span className="sp-checkpoint-section-title">
              {t("statusPanel.governance.title")}
            </span>
            <span className="sp-checkpoint-action-hint">
              {t("statusPanel.governance.empty")}
            </span>
          </div>
        </section>
      );
    }

    return (
      <section className="sp-checkpoint-section sp-governance-evidence">
        <div className="sp-checkpoint-inline-heading">
          <span className="sp-checkpoint-section-title">
            {t("statusPanel.governance.title")}
          </span>
          <span className="sp-checkpoint-action-hint">
            {isLoading
              ? t("statusPanel.governance.loading")
              : t("statusPanel.governance.count", {
                  count: evidence.length,
                  needsAction: needsActionCount,
                })}
          </span>
        </div>
        {groups
          .filter((group) => group.evidence.length > 0)
          .map((group) => {
            const list = (
              <ul className="sp-governance-evidence-list">
                {group.evidence.map((entry) => (
                  <EvidenceRow key={entry.id} entry={entry} />
                ))}
              </ul>
            );
            if (isPassedGroup(group.id)) {
              return (
                <details
                  key={group.id}
                  className="sp-governance-evidence-group"
                >
                  <summary className="sp-governance-evidence-group-heading">
                    {t(`statusPanel.governance.group.${group.id}`, {
                      count: group.evidence.length,
                    })}
                  </summary>
                  {list}
                </details>
              );
            }
            return (
              <div key={group.id} className="sp-governance-evidence-group">
                <div className="sp-governance-evidence-group-heading">
                  {t(`statusPanel.governance.group.${group.id}`, {
                    count: group.evidence.length,
                  })}
                </div>
                {list}
              </div>
            );
          })}
      </section>
    );
  },
);
