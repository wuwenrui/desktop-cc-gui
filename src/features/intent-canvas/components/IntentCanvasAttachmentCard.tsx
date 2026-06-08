import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import X from "lucide-react/dist/esm/icons/x";

import type { IntentCanvasDocument, IntentCanvasElementDigest } from "../types";
import { buildIntentCanvasTransmissionContext } from "../utils/context";

type IntentCanvasAttachmentCardProps = {
  document: IntentCanvasDocument;
  onRemove?: (documentId: string) => void;
};

type PreviewElement = IntentCanvasElementDigest & {
  previewX: number;
  previewY: number;
  previewWidth: number;
  previewHeight: number;
};

const PREVIEW_WIDTH = 240;
const PREVIEW_HEIGHT = 118;
const PREVIEW_PADDING = 16;

function finiteNumber(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function buildSyntheticElement(
  element: IntentCanvasElementDigest,
  index: number,
): IntentCanvasElementDigest {
  return {
    ...element,
    x: 80 + index * 112,
    y: index % 2 === 0 ? 72 : 140,
    width: element.type === "text" ? 96 : 120,
    height: element.type === "text" ? 34 : 64,
  };
}

function projectElements(elements: IntentCanvasElementDigest[]): PreviewElement[] {
  const drawableElements = elements
    .slice(0, 14)
    .map((element, index) => {
      const x = finiteNumber(element.x);
      const y = finiteNumber(element.y);
      const width = finiteNumber(element.width);
      const height = finiteNumber(element.height);
      return x !== null && y !== null && width !== null && height !== null
        ? element
        : buildSyntheticElement(element, index);
    });

  if (drawableElements.length === 0) {
    return [];
  }

  const bounds = drawableElements.reduce(
    (current, element) => {
      const x = element.x ?? 0;
      const y = element.y ?? 0;
      const width = Math.max(element.width ?? 1, 1);
      const height = Math.max(element.height ?? 1, 1);
      return {
        minX: Math.min(current.minX, x),
        minY: Math.min(current.minY, y),
        maxX: Math.max(current.maxX, x + width),
        maxY: Math.max(current.maxY, y + height),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );

  const boundsWidth = Math.max(bounds.maxX - bounds.minX, 1);
  const boundsHeight = Math.max(bounds.maxY - bounds.minY, 1);
  const scale = Math.min(
    (PREVIEW_WIDTH - PREVIEW_PADDING * 2) / boundsWidth,
    (PREVIEW_HEIGHT - PREVIEW_PADDING * 2) / boundsHeight,
  );

  return drawableElements.map((element) => {
    const x = element.x ?? 0;
    const y = element.y ?? 0;
    const width = Math.max(element.width ?? 1, 1);
    const height = Math.max(element.height ?? 1, 1);
    return {
      ...element,
      previewX: PREVIEW_PADDING + (x - bounds.minX) * scale,
      previewY: PREVIEW_PADDING + (y - bounds.minY) * scale,
      previewWidth: Math.max(width * scale, 8),
      previewHeight: Math.max(height * scale, 8),
    };
  });
}

function renderPreviewShape(element: PreviewElement) {
  if (element.type === "arrow" || element.type === "line") {
    return (
      <line
        key={element.id}
        x1={element.previewX}
        y1={element.previewY}
        x2={element.previewX + element.previewWidth}
        y2={element.previewY + element.previewHeight}
      />
    );
  }

  if (element.type === "ellipse") {
    return (
      <ellipse
        key={element.id}
        cx={element.previewX + element.previewWidth / 2}
        cy={element.previewY + element.previewHeight / 2}
        rx={element.previewWidth / 2}
        ry={element.previewHeight / 2}
      />
    );
  }

  if (element.type === "text") {
    return (
      <text key={element.id} x={element.previewX} y={element.previewY + 12}>
        {element.label ?? "Text"}
      </text>
    );
  }

  return (
    <rect
      key={element.id}
      x={element.previewX}
      y={element.previewY}
      width={element.previewWidth}
      height={element.previewHeight}
      rx="8"
    />
  );
}

export function IntentCanvasAttachmentCard({
  document,
  onRemove,
}: IntentCanvasAttachmentCardProps) {
  const { t } = useTranslation();
  const previewElements = useMemo(
    () => projectElements(document.aiContext.elementDigest),
    [document.aiContext.elementDigest],
  );
  const transmissionContext = useMemo(
    () => buildIntentCanvasTransmissionContext(document),
    [document],
  );
  const completeness = transmissionContext.completeness;
  const digestElementCount = document.aiContext.elementDigest.length;
  const totalElementCount = completeness.elements.total;
  const omittedDigestElementCount = Math.max(0, totalElementCount - digestElementCount);
  const isContextCompressed = completeness.truncated || omittedDigestElementCount > 0;
  const contextStatusLabel = isContextCompressed
    ? t("intentCanvas.attachment.contextCompressed")
    : t("intentCanvas.attachment.contextComplete");

  return (
    <article className="intent-canvas-attachment-card">
      <div className="intent-canvas-attachment-preview" aria-hidden>
        <svg viewBox={`0 0 ${PREVIEW_WIDTH} ${PREVIEW_HEIGHT}`}>
          <rect className="intent-canvas-attachment-preview-bg" x="1" y="1" width="238" height="116" rx="16" />
          {previewElements.map(renderPreviewShape)}
        </svg>
      </div>
      <div className="intent-canvas-attachment-body">
        <div className="intent-canvas-attachment-kicker">
          {t("intentCanvas.attachment.attached")}
        </div>
        <h4>{document.title}</h4>
        <p>{document.summary.trim() || t("intentCanvas.manager.noSummary")}</p>
        <dl>
          <div>
            <dt>{t("intentCanvas.editor.elements")}</dt>
            <dd>{totalElementCount}</dd>
          </div>
          <div>
            <dt>{t("intentCanvas.editor.files")}</dt>
            <dd>{document.links.filePaths.length}</dd>
          </div>
          <div>
            <dt>{t("intentCanvas.editor.nodes")}</dt>
            <dd>{document.links.projectMapNodeIds.length}</dd>
          </div>
        </dl>
        <div
          className="intent-canvas-attachment-context-status"
          aria-label={t("intentCanvas.attachment.contextStatusAriaLabel")}
        >
          <span className={`intent-canvas-attachment-context-chip ${isContextCompressed ? "is-compressed" : "is-complete"}`}>
            {contextStatusLabel}
          </span>
          <span className="intent-canvas-attachment-context-chip">
            {t("intentCanvas.attachment.elementDigest", {
              sent: digestElementCount,
              total: totalElementCount,
            })}
          </span>
          {omittedDigestElementCount > 0 ? (
            <span className="intent-canvas-attachment-context-chip is-compressed">
              {t("intentCanvas.attachment.omittedElements", {
                count: omittedDigestElementCount,
              })}
            </span>
          ) : null}
          <span className="intent-canvas-attachment-context-chip">
            {t("intentCanvas.attachment.semanticNodes", {
              sent: completeness.semanticNodes.sent,
              total: completeness.semanticNodes.total,
            })}
          </span>
          <span className="intent-canvas-attachment-context-chip">
            {t("intentCanvas.attachment.semanticEdges", {
              sent: completeness.semanticEdges.sent,
              total: completeness.semanticEdges.total,
            })}
          </span>
          <span className="intent-canvas-attachment-context-chip">
            {t("intentCanvas.attachment.visualTextBlocks", {
              sent: completeness.visualTextBlocks.sent,
              total: completeness.visualTextBlocks.total,
            })}
          </span>
        </div>
      </div>
      {onRemove ? (
        <button
          type="button"
          className="intent-canvas-attachment-remove"
          onClick={() => onRemove(document.id)}
          aria-label={t("intentCanvas.attachment.remove", { title: document.title })}
          title={t("intentCanvas.attachment.remove", { title: document.title })}
        >
          <X aria-hidden />
          <span>{t("intentCanvas.attachment.remove", { title: document.title })}</span>
        </button>
      ) : null}
    </article>
  );
}
