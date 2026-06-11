import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import type {
  IntentCanvasContextCount,
  IntentCanvasContextSummary,
} from "../../intent-canvas/utils/messageContext";

function IntentCanvasContextMetric({
  label,
  value,
}: {
  label: string;
  value: IntentCanvasContextCount;
}) {
  const isComplete = value.total === value.sent && value.omitted === 0;
  return (
    <span className={`intent-canvas-context-summary-metric${isComplete ? " is-complete" : " is-compressed"}`}>
      <strong>{label}</strong>
      <code>{value.sent}/{value.total}</code>
      {value.omitted > 0 ? <em>-{value.omitted}</em> : null}
    </span>
  );
}

export function IntentCanvasContextSummaryCard({
  summary,
}: {
  summary: IntentCanvasContextSummary;
}) {
  const { t } = useTranslation();
  const [payloadDialogOpen, setPayloadDialogOpen] = useState(false);
  useEffect(() => {
    if (!payloadDialogOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPayloadDialogOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [payloadDialogOpen]);
  const payloadTitleId = `${summary.attachmentId}-intent-canvas-payload-title`;
  const payloadDialogNode =
    payloadDialogOpen && typeof document !== "undefined"
      ? createPortal(
        <div
          className="memory-context-payload-dialog-overlay intent-canvas-context-payload-dialog-overlay"
          role="presentation"
          onClick={() => setPayloadDialogOpen(false)}
        >
          <div
            className="memory-context-payload-dialog intent-canvas-context-payload-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={payloadTitleId}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="memory-context-payload-dialog-header">
              <div>
                <h3 id={payloadTitleId}>
                  {t("messages.intentCanvasContextJsonDetailsTitle")}
                </h3>
                <p>{t("messages.intentCanvasContextJsonDetailsHint")}</p>
              </div>
              <button
                type="button"
                className="memory-context-payload-dialog-close"
                aria-label={t("messages.intentCanvasContextCloseJson")}
                onClick={() => setPayloadDialogOpen(false)}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
            <div className="memory-context-payload-dialog-body">
              <div className="intent-canvas-context-payload-dialog-meta">
                <span>{t("messages.intentCanvasContextJsonComplete")}</span>
                <span>{t("messages.intentCanvasContextRawCanvasNotSent")}</span>
                <span>{t("messages.intentCanvasContextPayloadChars", { count: summary.payloadCharacters })}</span>
                <span>{t("messages.intentCanvasContextCompressionMode", { mode: summary.compressionMode })}</span>
              </div>
              <pre className="memory-context-payload-dialog-code intent-canvas-context-payload-dialog-code">
                <code>{summary.rawPayload}</code>
              </pre>
            </div>
          </div>
        </div>,
        document.body,
      )
      : null;
  return (
    <>
      <section className="intent-canvas-context-summary-card">
        <div className="intent-canvas-context-summary-head">
          <div>
            <span className="intent-canvas-context-summary-kicker">
              {t("messages.intentCanvasContextKicker")}
            </span>
            <h3>{summary.title}</h3>
          </div>
          <span className={`intent-canvas-context-summary-state${summary.truncated ? " is-compressed" : " is-complete"}`}>
            {summary.truncated
              ? t("messages.intentCanvasContextCompressed")
              : t("messages.intentCanvasContextComplete")}
          </span>
        </div>
        <div className="intent-canvas-context-summary-audit">
          <span>{t("messages.intentCanvasContextJsonComplete")}</span>
          <span>{t("messages.intentCanvasContextRawCanvasNotSent")}</span>
          <span>{t("messages.intentCanvasContextPayloadChars", { count: summary.payloadCharacters })}</span>
          <span>{t("messages.intentCanvasContextCompressionMode", { mode: summary.compressionMode })}</span>
        </div>
        <div className="intent-canvas-context-summary-metrics">
          <IntentCanvasContextMetric
            label={t("messages.intentCanvasContextSemanticNodes")}
            value={summary.semanticNodes}
          />
          <IntentCanvasContextMetric
            label={t("messages.intentCanvasContextSemanticEdges")}
            value={summary.semanticEdges}
          />
          <IntentCanvasContextMetric
            label={t("messages.intentCanvasContextEvidence")}
            value={summary.evidence}
          />
          <IntentCanvasContextMetric
            label={t("messages.intentCanvasContextVisualText")}
            value={summary.visualTextBlocks}
          />
        </div>
        <button
          type="button"
          className="intent-canvas-context-summary-detail-button"
          onClick={() => setPayloadDialogOpen(true)}
        >
          {t("messages.intentCanvasContextViewJson")}
        </button>
      </section>
      {payloadDialogNode}
    </>
  );
}
