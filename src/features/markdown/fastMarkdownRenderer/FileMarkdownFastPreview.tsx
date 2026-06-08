import {
  useCallback,
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useFastMarkdownRender } from "./useFastMarkdownRender";
import type {
  CodeAnnotationLineRange,
} from "../../code-annotations/types";
import type {
  FastMarkdownFeatureFlags,
  FastMarkdownRendererProfileId,
  MarkdownOutlineEntry,
} from "./types";

const fastMarkdownTableScrollCache = new Map<string, number>();

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
  onShouldFallback,
  onOutlineReady,
  onAnnotationStart,
  annotationActionLabel = "Annotate",
}: FileMarkdownFastPreviewProps) {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const fallbackSignaledRef = useRef(false);
  const { result, status, resolvedProfile, error, shouldFallback } =
    useFastMarkdownRender({
      documentKey: documentKey ?? `inline:${value.length}:${resolvedKey(value)}`,
      rawMarkdown: value,
      featureFlags: featureFlags ?? {},
      rendererProfile,
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

  const dataAttributes: Record<string, string> = {
    "data-markdown-render-strategy": "fast-html",
    "data-markdown-render-profile": resolvedProfile,
    "data-markdown-render-status": status,
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
    dataAttributes["data-markdown-truncated"] = result.diagnostics.truncated
      ? "true"
      : "false";
  }

  if (status === "ready" && result) {
    return (
      <div
        ref={surfaceRef}
        className={className}
        {...dataAttributes}
        data-testid="file-markdown-fast-preview"
        data-fast-renderer-marker="ready"
        onClick={handleSurfaceClick}
        dangerouslySetInnerHTML={{ __html: result.html }}
      />
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
