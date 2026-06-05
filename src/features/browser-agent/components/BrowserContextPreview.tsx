import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";
import RefreshCw from "lucide-react/dist/esm/icons/refresh-cw";
import X from "lucide-react/dist/esm/icons/x";
import type { BrowserContextAttachment } from "../types";
import { buildBrowserEvidenceViewModel } from "../evidence";

export type BrowserContextPreviewProps = {
  attachment: BrowserContextAttachment;
  busy: boolean;
  onRefresh: () => void;
  onRemove: () => void;
};

function formatBrowserSource(url: string): string {
  try {
    const parsedUrl = new URL(url);
    return `${parsedUrl.hostname}${parsedUrl.pathname}`;
  } catch {
    return url;
  }
}

function compactDetailText(value: string, limit = 620): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized;
}

export function BrowserContextPreview({
  attachment,
  busy,
  onRefresh,
  onRemove,
}: BrowserContextPreviewProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const evidenceViewModel = useMemo(
    () => buildBrowserEvidenceViewModel(attachment),
    [attachment],
  );
  const stateLabel = evidenceViewModel.observationState === "available"
    ? t("browserAgent.composer.fresh")
    : evidenceViewModel.observationState === "stale"
    ? t("browserAgent.composer.stale")
    : evidenceViewModel.observationState;
  const diagnostics = attachment.diagnostics.slice(0, 3);
  const counts = attachment.elementCounts;
  const detailSnapshotText =
    (evidenceViewModel.primaryContent.items[0] ??
    attachment.visibleTextExcerpt) ||
    attachment.summary;
  useEffect(() => {
    setExpanded(false);
  }, [attachment.snapshotId, attachment.title, attachment.url]);

  return (
    <div className="composer-browser-context-card">
      <div className="composer-browser-context-main">
        <div className="composer-browser-context-title-row">
          <div className="composer-browser-context-kicker">
            {t("browserAgent.composer.visibleSnapshot")}
          </div>
          <span className={`composer-browser-context-state ${evidenceViewModel.observationState === "available" ? "is-fresh" : "is-stale"}`}>
            {stateLabel}
          </span>
        </div>
        <div className="composer-browser-context-title" title={attachment.url}>
          {attachment.title || attachment.url}
        </div>
        <div className="composer-browser-context-counts" aria-label={t("browserAgent.composer.countSummary")}>
          <span>{t("browserAgent.composer.headingCount", { count: counts.headings })}</span>
          <span>{t("browserAgent.composer.linkCount", { count: counts.links })}</span>
          <span>{t("browserAgent.composer.buttonCount", { count: counts.buttons })}</span>
          <span>{t("browserAgent.composer.formCount", { count: counts.forms })}</span>
          <span>{t("browserAgent.composer.readableBlockCount", { count: counts.readableBlocks ?? 0 })}</span>
          <span>{t("browserAgent.composer.visualEvidenceCount", { count: counts.visualEvidence ?? 0 })}</span>
        </div>
        <button
          type="button"
          className="composer-browser-context-detail-toggle"
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded
            ? t("browserAgent.composer.hideDetails")
            : t("browserAgent.composer.showDetails")}
        </button>
        {expanded ? (
          <div className="composer-browser-context-detail">
            <div className="composer-browser-context-detail-line">
              {formatBrowserSource(attachment.url)}
              {" · "}
              {t("browserAgent.composer.noRawApi")}
            </div>
            <section className="composer-browser-context-section">
              <div className="composer-browser-context-section-title">
                {evidenceViewModel.overview.title}
              </div>
              <p>{compactDetailText(evidenceViewModel.overview.copySafeText, 1_000)}</p>
            </section>
            {detailSnapshotText ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.visibleSnapshot")}
                </div>
                <p>{compactDetailText(detailSnapshotText, 1_200)}</p>
              </section>
            ) : null}
            <div className="composer-browser-context-detail-line">
              {t("browserAgent.composer.counts", {
                headings: counts.headings,
                links: counts.links,
                buttons: counts.buttons,
                forms: counts.forms,
                readableBlocks: counts.readableBlocks ?? 0,
                visualEvidence: counts.visualEvidence ?? 0,
                candidates: counts.codeCandidates,
              })}
            </div>
            {attachment.primaryContent ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.primaryContent")}
                </div>
                <p>{compactDetailText(attachment.primaryContent, 1_000)}</p>
              </section>
            ) : null}
            {evidenceViewModel.readableBlocks.items.length > 0 ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.readableBlocks", {
                    count: evidenceViewModel.readableBlocks.items.length,
                  })}
                </div>
                <ol className="composer-browser-context-evidence-list">
                  {evidenceViewModel.readableBlocks.items.slice(0, 8).map((item, index) => (
                    <li key={`readable-${index}`}>
                      <p>{compactDetailText(item)}</p>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}
            {evidenceViewModel.visualEvidence.items.length > 0 ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.visualEvidence", {
                    count: evidenceViewModel.visualEvidence.items.length,
                  })}
                </div>
                <ul className="composer-browser-context-evidence-list">
                  {evidenceViewModel.visualEvidence.items.slice(0, 12).map((item, index) => (
                    <li key={`visual-${index}`}>
                      <p>{compactDetailText(item, 520)}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            {evidenceViewModel.codeCandidates.items.length > 0 ? (
              <section className="composer-browser-context-section">
                <div className="composer-browser-context-section-title">
                  {t("browserAgent.composer.codeCandidates", {
                    count: evidenceViewModel.codeCandidates.items.length,
                  })}
                </div>
                <ul className="composer-browser-context-evidence-list">
                  {evidenceViewModel.codeCandidates.items.map((item, index) => (
                    <li key={`candidate-${index}`}>
                      <p>{item}</p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="composer-browser-context-detail-line">
              {t("browserAgent.composer.privacy", {
                redacted: attachment.privacy.redactedKinds.length,
                omitted: attachment.privacy.omittedKinds.length,
              })}
            </div>
            {diagnostics.length > 0 ? (
              <ul className="composer-browser-context-diagnostics">
                {diagnostics.map((diagnostic) => (
                  <li key={diagnostic.diagnosticId}>
                    <AlertCircle size={12} aria-hidden />
                    <span>{diagnostic.message}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="composer-browser-context-actions">
        <button
          type="button"
          className="composer-browser-context-refresh"
          onClick={onRefresh}
          disabled={busy}
          title={t("browserAgent.composer.refresh")}
        >
          <RefreshCw size={14} aria-hidden />
        </button>
        <button
          type="button"
          className="composer-browser-context-remove"
          onClick={onRemove}
          title={t("browserAgent.composer.remove")}
        >
          <X size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
