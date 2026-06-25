import {
  forwardRef,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useFastMarkdownRender } from "./useFastMarkdownRender";
import type {
  CodeAnnotationLineRange,
  CodeAnnotationSelection,
} from "../../code-annotations/types";
import type {
  FastMarkdownFeatureFlags,
  FastMarkdownRendererProfileId,
  MarkdownOutlineEntry,
} from "./types";

const fastMarkdownTableScrollCache = new Map<string, number>();
const EMPTY_ANNOTATIONS: CodeAnnotationSelection[] = [];

type FastAnnotationOverlayItem = {
  key: string;
  top: number;
  annotations: CodeAnnotationSelection[];
  draft: { lineRange: CodeAnnotationLineRange; body: string } | null;
};

type FastMarkdownHtmlSurfaceProps = {
  className: string;
  dataAttributes: Record<string, string>;
  html: string;
  marker: string;
  onClick: (event: ReactMouseEvent<HTMLDivElement>) => void;
};

const FastMarkdownHtmlSurface = memo(
  forwardRef<HTMLDivElement, FastMarkdownHtmlSurfaceProps>(function FastMarkdownHtmlSurface(
    { className, dataAttributes, html, marker, onClick },
    ref,
  ) {
    return (
      <div
        ref={ref}
        className={className}
        {...dataAttributes}
        data-testid="file-markdown-fast-preview"
        data-fast-renderer-marker={marker}
        onClick={onClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }),
  (previous, next) =>
    previous.className === next.className &&
    previous.html === next.html &&
    previous.marker === next.marker &&
    previous.onClick === next.onClick &&
    areStringRecordsEqual(previous.dataAttributes, next.dataAttributes),
);

export type FileMarkdownFastPreviewProps = {
  value: string;
  documentKey?: string;
  className?: string;
  /**
   * Override the renderer profile. When `undefined`, the hook
   * resolves a profile from `featureFlags` + document size. The
   * contract is that the consumer passes an explicit id only when
   * the rollout flag, feature flag, or experimental stage calls
   * for it; default call sites should leave this undefined.
   */
  rendererProfile?: FastMarkdownRendererProfileId;
  featureFlags?: FastMarkdownFeatureFlags;
  boundedLineLimit?: number;
  /**
   * Notifies the parent that the fast path cannot produce a usable
   * document surface (profile is `rich-react`/`low-cost-readable`,
   * compile failed, or sanitizer failed). The parent should fall
   * back to the existing rich ReactMarkdown path so the preview is
   * never blank for security or quality reasons.
   */
  onShouldFallback?: (reason: string) => void;
  /**
   * Called when the fast compile pipeline has produced a
   * parser-derived outline. The parent can use this to render
   * a table-of-contents sidebar alongside the document surface.
   * Outline is only present when `status === "ready"`.
   */
  onOutlineReady?: (outline: MarkdownOutlineEntry[]) => void;
  onAnnotationStart?: (lineRange: CodeAnnotationLineRange) => void;
  annotationDraft?: { lineRange: CodeAnnotationLineRange; body: string } | null;
  annotations?: CodeAnnotationSelection[];
  renderAnnotationDraft?: (draft: { lineRange: CodeAnnotationLineRange; body: string }) => ReactNode;
  renderAnnotationMarker?: (annotation: CodeAnnotationSelection) => ReactNode;
  annotationActionLabel?: string;
};

/**
 * File-preview surface that mounts a fast-compiled sanitized HTML
 * Markdown document. The compile pipeline (mdast → hast → HTML +
 * rehype-raw + rehype-sanitize + rehype-katex) is invoked via the
 * `useFastMarkdownRender` hook; this component is responsible only
 * for:
 *
 * - resolving the renderer profile (delegated to the hook);
 * - mounting the sanitized HTML via `dangerouslySetInnerHTML`;
 * - intercepting external link clicks so they open in the OS
 *   browser via the Tauri opener (matching the rich preview's
 *   `handleAnchorClick` behavior);
 * - exposing diagnostic data attributes for tests and tooling;
 * - failing closed to the rich path when the hook reports
 *   `shouldFallback` (compile failure, profile mismatch, etc.).
 */
export function FileMarkdownFastPreview({
  value,
  documentKey,
  className = "fvp-file-markdown",
  rendererProfile,
  featureFlags,
  boundedLineLimit,
  onShouldFallback,
  onOutlineReady,
  onAnnotationStart,
  annotationDraft = null,
  annotations = EMPTY_ANNOTATIONS,
  renderAnnotationDraft,
  renderAnnotationMarker,
  annotationActionLabel = "Annotate",
}: FileMarkdownFastPreviewProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const fallbackSignaledRef = useRef(false);
  const [annotationOverlayItems, setAnnotationOverlayItems] = useState<FastAnnotationOverlayItem[]>([]);
  const { result, status, resolvedProfile, error, shouldFallback } =
    useFastMarkdownRender({
      documentKey: documentKey ?? `inline:${value.length}:${resolvedKey(value)}`,
      rawMarkdown: value,
      featureFlags: featureFlags ?? {},
      rendererProfile,
      boundedLineLimit,
    });

  useEffect(() => {
    if (!shouldFallback) {
      fallbackSignaledRef.current = false;
      return;
    }
    if (fallbackSignaledRef.current) {
      return;
    }
    fallbackSignaledRef.current = true;
    if (!onShouldFallback) {
      return;
    }
    const reason = error?.message
      ? `fast-renderer-fallback:${error.message}`
      : `fast-renderer-fallback:${resolvedProfile}`;
    onShouldFallback(reason);
  }, [error, onShouldFallback, resolvedProfile, shouldFallback]);

  useEffect(() => {
    if (!onOutlineReady) {
      return;
    }
    if (status === "ready" && result) {
      onOutlineReady(result.outline);
    }
  }, [onOutlineReady, result, status]);

  const requiresRichInteractionIsland =
    status === "ready" &&
    result?.heavyBlocks.some((block) => block.kind === "mermaid") === true;

  useEffect(() => {
    if (!requiresRichInteractionIsland || fallbackSignaledRef.current) {
      return;
    }
    fallbackSignaledRef.current = true;
    onShouldFallback?.("fast-renderer-fallback:mermaid-island-rich-fallback");
  }, [onShouldFallback, requiresRichInteractionIsland]);

  useEffect(() => {
    if (status !== "ready" || !result || requiresRichInteractionIsland) {
      return;
    }
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    const cleanupCallbacks: Array<() => void> = [];
    const tables = Array.from(surface.querySelectorAll("table"));
    tables.forEach((table, index) => {
      const parent = table.parentElement;
      if (!parent || parent.classList.contains("fvp-file-markdown-table-wrap")) {
        return;
      }
      const wrapper = surface.ownerDocument.createElement("div");
      wrapper.className = "fvp-file-markdown-table-wrap";
      const cacheKey = `${result.cacheKey}:table-scroll:${index}`;
      parent.replaceChild(wrapper, table);
      wrapper.appendChild(table);
      wrapper.scrollLeft = fastMarkdownTableScrollCache.get(cacheKey) ?? 0;
      const handleScroll = () => {
        fastMarkdownTableScrollCache.set(cacheKey, Math.max(0, Math.round(wrapper.scrollLeft)));
      };
      wrapper.addEventListener("scroll", handleScroll);
      cleanupCallbacks.push(() => {
        wrapper.removeEventListener("scroll", handleScroll);
      });
    });

    if (onAnnotationStart) {
      const blocks = Array.from(
        surface.querySelectorAll<HTMLElement>("[data-source-line-start][data-source-line-end]"),
      ).filter((node) => node.parentElement === surface);
      blocks.forEach((block) => {
        const startLine = Number(block.dataset.sourceLineStart);
        const endLine = Number(block.dataset.sourceLineEnd);
        if (!Number.isFinite(startLine) || !Number.isFinite(endLine)) {
          return;
        }
        const button = surface.ownerDocument.createElement("button");
        button.type = "button";
        button.className = "fvp-markdown-annotation-button fvp-fast-markdown-annotation-button";
        button.textContent = annotationActionLabel;
        button.setAttribute("aria-label", `${annotationActionLabel} L${startLine}-${endLine}`);
        const handleClick = (event: MouseEvent) => {
          event.preventDefault();
          event.stopPropagation();
          onAnnotationStart({ startLine, endLine });
        };
        button.addEventListener("click", handleClick);
        block.insertAdjacentElement("afterend", button);
        cleanupCallbacks.push(() => {
          button.removeEventListener("click", handleClick);
          button.remove();
        });
      });
    }

    return () => {
      cleanupCallbacks.forEach((cleanup) => cleanup());
    };
  }, [
    annotationActionLabel,
    onAnnotationStart,
    requiresRichInteractionIsland,
    result,
    status,
  ]);

  useEffect(() => {
    if (status !== "ready" || !result || requiresRichInteractionIsland) {
      return;
    }
    if (!renderAnnotationDraft && !renderAnnotationMarker) {
      setAnnotationOverlayItems((current) => (current.length === 0 ? current : []));
      return;
    }
    const surface = surfaceRef.current;
    if (!surface) {
      return;
    }
    const nextOverlayItems: FastAnnotationOverlayItem[] = [];
    const blocksById = new Map<string, HTMLElement>();
    surface
      .querySelectorAll<HTMLElement>("[data-source-block-id][data-source-line-start][data-source-line-end]")
      .forEach((block) => {
        const blockId = block.dataset.sourceBlockId;
        if (blockId) {
          blocksById.set(blockId, block);
        }
      });
    const annotationBuckets = bucketFastAnnotationsByBlock(result.sourceLineAnchors, annotations);
    const draftAnchor = annotationDraft
      ? findBestFastAnnotationAnchor(result.sourceLineAnchors, annotationDraft.lineRange)
      : null;
    if (draftAnchor && annotationDraft) {
      const existing = annotationBuckets.get(draftAnchor.blockId) ?? [];
      annotationBuckets.set(draftAnchor.blockId, existing);
    }

    for (const [blockId, blockAnnotations] of annotationBuckets) {
      const block = blocksById.get(blockId);
      if (!block) {
        continue;
      }
      const shouldRenderDraft =
        annotationDraft !== null && draftAnchor?.blockId === blockId && renderAnnotationDraft;
      const shouldRenderMarkers = blockAnnotations.length > 0 && renderAnnotationMarker;
      if (!shouldRenderDraft && !shouldRenderMarkers) {
        continue;
      }
      nextOverlayItems.push({
        key: blockId,
        top: block.offsetTop + block.offsetHeight,
        annotations: blockAnnotations,
        draft: shouldRenderDraft && annotationDraft ? annotationDraft : null,
      });
    }
    setAnnotationOverlayItems((current) =>
      areFastAnnotationOverlayItemsEqual(current, nextOverlayItems)
        ? current
        : nextOverlayItems,
    );
  }, [
    annotationDraft,
    annotations,
    renderAnnotationDraft,
    renderAnnotationMarker,
    requiresRichInteractionIsland,
    result,
    status,
  ]);

  const handleSurfaceClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const anchor = target.closest("a");
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }
      const href = anchor.getAttribute("href");
      if (!href) {
        return;
      }
      const isExternal =
        href.startsWith("http://") ||
        href.startsWith("https://") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("ftp://");
      if (!isExternal) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      void openUrl(href);
    },
    [],
  );

  if (shouldFallback || requiresRichInteractionIsland) {
    return null;
  }

  const renderedAnnotationOverlayCount = annotationOverlayItems.reduce(
    (count, item) => count + item.annotations.length + (item.draft ? 1 : 0),
    0,
  );
  const dataAttributes: Record<string, string> = {
    "data-markdown-render-strategy": "fast-html",
    "data-markdown-render-profile": resolvedProfile,
    "data-markdown-render-status": status,
    "data-markdown-fallback-reason": error?.message ?? "none",
    "data-markdown-annotation-overlay-count": String(renderedAnnotationOverlayCount),
  };
  if (result) {
    dataAttributes["data-markdown-content-hash"] = result.contentHash;
    dataAttributes["data-markdown-cache-key"] = result.cacheKey;
    dataAttributes["data-markdown-total-headings"] = String(
      result.diagnostics.totalHeadings,
    );
    dataAttributes["data-markdown-total-heavy-blocks"] = String(
      result.diagnostics.totalHeavyBlocks,
    );
    dataAttributes["data-markdown-visible-line-count"] = String(
      result.diagnostics.totalSourceLines,
    );
    dataAttributes["data-markdown-visible-block-count"] = String(
      result.sourceLineAnchors.length,
    );
    dataAttributes["data-markdown-cache-state"] = result.diagnostics.cacheState;
    dataAttributes["data-markdown-truncated"] = result.diagnostics.truncated
      ? "true"
      : "false";
  }

  if (status === "ready" && result) {
    return (
      <>
        <div className="fvp-fast-markdown-surface-frame">
          <FastMarkdownHtmlSurface
            ref={surfaceRef}
            className={className}
            dataAttributes={dataAttributes}
            html={result.html}
            marker="ready"
            onClick={handleSurfaceClick}
          />
          <div className="fvp-fast-markdown-annotation-layer" aria-hidden={annotationOverlayItems.length === 0}>
            {annotationOverlayItems.map((item) => (
              <div
                key={item.key}
                className="fvp-markdown-annotation-inline fvp-fast-markdown-annotation-inline"
                style={{ top: item.top }}
              >
                {item.annotations.map((annotation) =>
                renderAnnotationMarker ? (
                  <div key={annotation.id} className="fvp-fast-markdown-annotation-marker">
                    {renderAnnotationMarker(annotation)}
                  </div>
                ) : null,
              )}
                {item.draft && renderAnnotationDraft ? (
                <div className="fvp-fast-markdown-annotation-draft">
                    {renderAnnotationDraft(item.draft)}
                </div>
              ) : null}
              </div>
            ))}
          </div>
        </div>
      </>
    );
  }

  return (
    <div
      ref={surfaceRef}
      className={className}
      {...dataAttributes}
      data-testid="file-markdown-fast-preview"
      data-fast-renderer-marker={status}
    />
  );
}

function areStringRecordsEqual(
  previous: Record<string, string>,
  next: Record<string, string>,
) {
  const previousKeys = Object.keys(previous);
  const nextKeys = Object.keys(next);
  if (previousKeys.length !== nextKeys.length) {
    return false;
  }
  for (const key of previousKeys) {
    if (previous[key] !== next[key]) {
      return false;
    }
  }
  return true;
}

function areFastAnnotationOverlayItemsEqual(
  previous: FastAnnotationOverlayItem[],
  next: FastAnnotationOverlayItem[],
) {
  if (previous.length !== next.length) {
    return false;
  }
  for (let index = 0; index < previous.length; index += 1) {
    const previousItem = previous[index];
    const nextItem = next[index];
    if (!previousItem || !nextItem) {
      return false;
    }
    if (
      previousItem.key !== nextItem.key ||
      previousItem.top !== nextItem.top ||
      previousItem.draft?.body !== nextItem.draft?.body ||
      previousItem.draft?.lineRange.startLine !== nextItem.draft?.lineRange.startLine ||
      previousItem.draft?.lineRange.endLine !== nextItem.draft?.lineRange.endLine ||
      previousItem.annotations.length !== nextItem.annotations.length
    ) {
      return false;
    }
    for (let annotationIndex = 0; annotationIndex < previousItem.annotations.length; annotationIndex += 1) {
      if (
        previousItem.annotations[annotationIndex]?.id !==
        nextItem.annotations[annotationIndex]?.id
      ) {
        return false;
      }
    }
  }
  return true;
}

function bucketFastAnnotationsByBlock(
  anchors: Array<{ blockId: string; startLine: number; endLine: number }>,
  annotations: CodeAnnotationSelection[],
) {
  const buckets = new Map<string, CodeAnnotationSelection[]>();
  for (const annotation of annotations) {
    const anchor = findBestFastAnnotationAnchor(anchors, annotation.lineRange);
    if (!anchor) {
      continue;
    }
    const bucket = buckets.get(anchor.blockId);
    if (bucket) {
      bucket.push(annotation);
    } else {
      buckets.set(anchor.blockId, [annotation]);
    }
  }
  return buckets;
}

function findBestFastAnnotationAnchor(
  anchors: Array<{ blockId: string; startLine: number; endLine: number }>,
  lineRange: CodeAnnotationLineRange,
) {
  let bestAnchor: { blockId: string; startLine: number; endLine: number } | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;
  for (const anchor of anchors) {
    if (lineRange.endLine < anchor.startLine || lineRange.endLine > anchor.endLine) {
      continue;
    }
    const span = anchor.endLine - anchor.startLine;
    if (span < bestSpan) {
      bestAnchor = anchor;
      bestSpan = span;
    }
  }
  return bestAnchor;
}

function resolvedKey(value: string): string {
  // Use a stable, low-entropy key derived from the raw content for
  // the inline-document case. A full content hash is not required
  // here: the cache key inside the fast renderer is content-aware.
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }
  return hash.toString(36);
}
