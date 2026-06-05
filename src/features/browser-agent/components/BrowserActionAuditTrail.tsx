import { useTranslation } from "react-i18next";
import type { BrowserActionAuditEntry } from "../types";

export type BrowserActionAuditTrailProps = {
  entries: BrowserActionAuditEntry[];
};

export function BrowserActionAuditTrail({ entries }: BrowserActionAuditTrailProps) {
  const { t } = useTranslation();
  const title = t("browserAgent.actionAudit.title", "Browser action audit");
  if (entries.length === 0) {
    return null;
  }
  return (
    <section className="browser-action-audit-trail">
      <h3>{title === "browserAgent.actionAudit.title" ? "Browser action audit" : title}</h3>
      <ul>
        {entries.map((entry) => (
          <li key={entry.actionId} data-outcome={entry.outcome}>
            <strong>{entry.action}</strong>
            <span>{entry.outcome}</span>
            {entry.targetDescription ? <span>{entry.targetDescription}</span> : null}
            {entry.diagnosticMessage ? <p>{entry.diagnosticMessage}</p> : null}
            {entry.comparison ? (
              <p>
                before={entry.comparison.beforeSnapshotId ?? "none"}; after={entry.comparison.afterSnapshotId ?? "none"}; state={entry.comparison.state}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
