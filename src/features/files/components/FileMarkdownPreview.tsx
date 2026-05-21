import {
  createElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { useTranslation } from "react-i18next";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Element } from "hast";
import {
  areKatexAssetsReady,
  detectMathContent,
  getCachedRehypeKatex,
  loadKatexAssets,
  renderLatexFormula,
} from "../../markdown/markdownMath";
import {
  compileFileMarkdownDocument,
  hashStableString,
} from "../utils/fileMarkdownDocument";
import { highlightLine } from "../../../utils/syntax";
import {
  isThemeMutationAttribute,
  mapAppearanceToMermaidTheme,
  readDocumentThemeAppearance,
} from "../../theme/utils/themeAppearance";
import type {
  CodeAnnotationLineRange,
  CodeAnnotationSelection,
} from "../../code-annotations/types";
import { formatCodeAnnotationLineRange } from "../../code-annotations/utils/codeAnnotations";

type FileMarkdownPreviewProps = {
  value: string;
  documentKey?: string;
  className?: string;
  onAnnotationStart?: (lineRange: CodeAnnotationLineRange) => void;
  annotationDraft?: { lineRange: CodeAnnotationLineRange; body: string } | null;
  annotations?: CodeAnnotationSelection[];
  renderAnnotationDraft?: (draft: { lineRange: CodeAnnotationLineRange; body: string }) => ReactNode;
  renderAnnotationMarker?: (annotation: CodeAnnotationSelection) => ReactNode;
  annotationActionLabel?: string;
};

type PreviewPreNode = {
  children?: Array<{
    tagName?: string;
    properties?: { className?: string[] | string };
    children?: Array<{ value?: string }>;
  }>;
};

type MermaidRenderState =
  | { status: "idle" }
  | { status: "rendering" }
  | { status: "success"; svg: string }
  | { status: "error"; message: string };

type MermaidBlockTab = "source" | "render";
type MarkdownRenderProjection = {
  kind: "rich" | "progressive" | "bounded";
  initialLineLimit: number;
  maxLineLimit: number;
  chunkLineCount: number;
};

type MarkdownPositionTreeNode = Pick<Element, "children" | "position" | "tagName"> | undefined;

type AnnotatableBlockTag =
  | "blockquote"
  | "div"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "ol"
  | "p"
  | "ul";

const ANNOTATABLE_MARKDOWN_NODE_TAGS = new Set<string>([
  "blockquote",
  "div",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ol",
  "p",
  "pre",
  "table",
  "ul",
]);

const MAX_CACHED_MERMAID_DOCUMENTS = 50;
const MAX_CACHED_MERMAID_RENDERS = 80;
const MAX_CACHED_KATEX_RENDERS = 120;
const MAX_REVEALED_HEAVY_BLOCKS = 800;
const PROGRESSIVE_INITIAL_LINES = 360;
const PROGRESSIVE_CHUNK_LINES = 720;
const BOUNDED_RENDER_LINE_LIMIT = 1_800;
const LARGE_MARKDOWN_LINE_THRESHOLD = 6_000;
const LARGE_MARKDOWN_BYTE_THRESHOLD = 240_000;
const LARGE_MARKDOWN_BLOCK_THRESHOLD = 1_800;
const LARGE_MARKDOWN_HEAVY_BLOCK_THRESHOLD = 60;
const HEAVY_CODE_BLOCK_LINE_THRESHOLD = 80;
const HEAVY_CODE_BLOCK_BYTE_THRESHOLD = 12_000;
const mermaidTabSessionCache = new Map<string, Record<string, MermaidBlockTab>>();
const mermaidRenderCache = new Map<string, string>();
const katexRenderCache = new Map<string, string | null>();
const revealedHeavyBlockCache = new Set<string>();

function markHeavyBlockRevealed(revealKey: string | null) {
  if (!revealKey) {
    return;
  }
  revealedHeavyBlockCache.delete(revealKey);
  revealedHeavyBlockCache.add(revealKey);
  while (revealedHeavyBlockCache.size > MAX_REVEALED_HEAVY_BLOCKS) {
    const oldestKey = revealedHeavyBlockCache.values().next().value;
    if (!oldestKey) {
      break;
    }
    revealedHeavyBlockCache.delete(oldestKey);
  }
}

function isHeavyBlockRevealed(revealKey: string | null) {
  return Boolean(revealKey && revealedHeavyBlockCache.has(revealKey));
}

function readCachedMermaidTabs(documentKey: string): Record<string, MermaidBlockTab> {
  return { ...(mermaidTabSessionCache.get(documentKey) ?? {}) };
}

function writeCachedMermaidTab(
  documentKey: string,
  blockKey: string,
  activeTab: MermaidBlockTab,
) {
  const nextTabs = {
    ...(mermaidTabSessionCache.get(documentKey) ?? {}),
    [blockKey]: activeTab,
  };
  mermaidTabSessionCache.delete(documentKey);
  mermaidTabSessionCache.set(documentKey, nextTabs);
  while (mermaidTabSessionCache.size > MAX_CACHED_MERMAID_DOCUMENTS) {
    const oldestDocumentKey = mermaidTabSessionCache.keys().next().value;
    if (!oldestDocumentKey) {
      break;
    }
    mermaidTabSessionCache.delete(oldestDocumentKey);
  }
}

function createMermaidBlockKey(
  node: MarkdownPositionTreeNode,
  value: string,
  blockStartLine: number,
): string {
  const startLine = (node?.position?.start.line ?? 1) + blockStartLine - 1;
  const endLine = (node?.position?.end.line ?? 1) + blockStartLine - 1;
  return `${startLine}:${endLine}:${hashStableString(value)}`;
}

function createHeavyBlockRevealKey({
  blockKey,
  blockStartLine,
  documentKey,
  kind,
  node,
  value = "",
}: {
  blockKey: string;
  blockStartLine: number;
  documentKey: string;
  kind: string;
  node: MarkdownPositionTreeNode;
  value?: string;
}) {
  const startLine = (node?.position?.start.line ?? 1) + blockStartLine - 1;
  const endLine = (node?.position?.end.line ?? startLine) + blockStartLine - 1;
  return `${documentKey}:${blockKey}:${kind}:${startLine}:${endLine}:${hashStableString(value)}`;
}

function createMermaidRenderCacheKey({
  blockKey,
  documentKey,
  theme,
  value,
}: {
  blockKey: string;
  documentKey: string;
  theme: "dark" | "default";
  value: string;
}) {
  return `${documentKey}:${blockKey}:${theme}:${hashStableString(value)}`;
}

function createStableRuntimeId(prefix: string) {
  const randomId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${randomId}`;
}

function readCachedMermaidRender(cacheKey: string) {
  const svg = mermaidRenderCache.get(cacheKey);
  if (!svg) {
    return null;
  }
  mermaidRenderCache.delete(cacheKey);
  mermaidRenderCache.set(cacheKey, svg);
  return svg;
}

function writeCachedMermaidRender(cacheKey: string, svg: string) {
  mermaidRenderCache.delete(cacheKey);
  mermaidRenderCache.set(cacheKey, svg);
  while (mermaidRenderCache.size > MAX_CACHED_MERMAID_RENDERS) {
    const oldestKey = mermaidRenderCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    mermaidRenderCache.delete(oldestKey);
  }
}

function readCachedKatexRender(cacheKey: string) {
  if (!katexRenderCache.has(cacheKey)) {
    return undefined;
  }
  const renderedHtml = katexRenderCache.get(cacheKey) ?? null;
  katexRenderCache.delete(cacheKey);
  katexRenderCache.set(cacheKey, renderedHtml);
  return renderedHtml;
}

function writeCachedKatexRender(cacheKey: string, renderedHtml: string | null) {
  katexRenderCache.delete(cacheKey);
  katexRenderCache.set(cacheKey, renderedHtml);
  while (katexRenderCache.size > MAX_CACHED_KATEX_RENDERS) {
    const oldestKey = katexRenderCache.keys().next().value;
    if (!oldestKey) {
      break;
    }
    katexRenderCache.delete(oldestKey);
  }
}

function extractLanguageTag(className?: string) {
  if (!className) {
    return null;
  }
  const match = className.match(/language-([\w-]+)/i);
  return match?.[1] ?? null;
}

function extractCodeFromPre(node?: PreviewPreNode) {
  const codeNode = node?.children?.find((child) => child.tagName === "code");
  const className = codeNode?.properties?.className;
  const normalizedClassName = Array.isArray(className)
    ? className.join(" ")
    : className;
  const value =
    codeNode?.children?.map((child) => child.value ?? "").join("") ?? "";
  return {
    className: normalizedClassName,
    value: value.replace(/\n$/, ""),
  };
}

function detectMermaidTheme(): "dark" | "default" {
  return mapAppearanceToMermaidTheme(readDocumentThemeAppearance());
}

function resolveMarkdownRenderProjection(
  metrics: ReturnType<typeof compileFileMarkdownDocument>["metrics"],
): MarkdownRenderProjection {
  if (
    metrics.lineCount > LARGE_MARKDOWN_LINE_THRESHOLD ||
    metrics.byteLength > LARGE_MARKDOWN_BYTE_THRESHOLD ||
    metrics.blockCount > LARGE_MARKDOWN_BLOCK_THRESHOLD ||
    metrics.heavyBlockCount > LARGE_MARKDOWN_HEAVY_BLOCK_THRESHOLD
  ) {
    return {
      kind: "bounded",
      initialLineLimit: Math.min(BOUNDED_RENDER_LINE_LIMIT, metrics.lineCount),
      maxLineLimit: Math.min(BOUNDED_RENDER_LINE_LIMIT, metrics.lineCount),
      chunkLineCount: BOUNDED_RENDER_LINE_LIMIT,
    };
  }

  if (metrics.lineCount > PROGRESSIVE_INITIAL_LINES) {
    return {
      kind: "progressive",
      initialLineLimit: Math.min(PROGRESSIVE_INITIAL_LINES, metrics.lineCount),
      maxLineLimit: metrics.lineCount,
      chunkLineCount: PROGRESSIVE_CHUNK_LINES,
    };
  }

  return {
    kind: "rich",
    initialLineLimit: metrics.lineCount,
    maxLineLimit: metrics.lineCount,
    chunkLineCount: metrics.lineCount,
  };
}

function isHeavyCodeBlock(value: string) {
  return (
    value.length > HEAVY_CODE_BLOCK_BYTE_THRESHOLD ||
    value.split(/\r?\n/).length > HEAVY_CODE_BLOCK_LINE_THRESHOLD
  );
}

function resolveMarkdownNodeLineRange(
  node: MarkdownPositionTreeNode,
  bodyStartLine: number,
): CodeAnnotationLineRange | null {
  const startLine = node?.position?.start.line;
  const endLine = node?.position?.end.line;
  if (
    typeof startLine !== "number" ||
    typeof endLine !== "number" ||
    startLine < 1 ||
    endLine < 1
  ) {
    return null;
  }
  const offset = Math.max(bodyStartLine - 1, 0);
  return {
    startLine: Math.min(startLine, endLine) + offset,
    endLine: Math.max(startLine, endLine) + offset,
  };
}

function annotationEndsInBlock(
  annotationLineRange: CodeAnnotationLineRange,
  blockLineRange: CodeAnnotationLineRange,
) {
  return (
    annotationLineRange.endLine >= blockLineRange.startLine &&
    annotationLineRange.endLine <= blockLineRange.endLine
  );
}

function lineRangeContains(
  outerRange: CodeAnnotationLineRange,
  innerRange: CodeAnnotationLineRange,
) {
  return (
    innerRange.startLine >= outerRange.startLine &&
    innerRange.endLine <= outerRange.endLine
  );
}

function lineRangeSpan(lineRange: CodeAnnotationLineRange) {
  return lineRange.endLine - lineRange.startLine;
}

function collectNestedNodeLineRanges(
  node: MarkdownPositionTreeNode,
  bodyStartLine: number,
): CodeAnnotationLineRange[] {
  const ranges: CodeAnnotationLineRange[] = [];
  const children = node?.children ?? [];
  for (const child of children) {
    if (typeof child !== "object" || child === null || !("position" in child)) {
      continue;
    }
    const childNode = child as MarkdownPositionTreeNode;
    const lineRange = ANNOTATABLE_MARKDOWN_NODE_TAGS.has(childNode?.tagName ?? "")
      ? resolveMarkdownNodeLineRange(childNode, bodyStartLine)
      : null;
    if (lineRange) {
      ranges.push(lineRange);
    }
    ranges.push(...collectNestedNodeLineRanges(childNode, bodyStartLine));
  }
  return ranges;
}

function hasMoreSpecificAnnotationBlock(
  currentLineRange: CodeAnnotationLineRange,
  targetLineRange: CodeAnnotationLineRange,
  nestedRanges: CodeAnnotationLineRange[],
) {
  return nestedRanges.some(
    (nestedRange) =>
      lineRangeContains(nestedRange, targetLineRange) &&
      lineRangeSpan(nestedRange) < lineRangeSpan(currentLineRange),
  );
}

function collectAnnotationsEndingInRange(
  annotationBucketsByEndLine: Map<number, CodeAnnotationSelection[]>,
  lineRange: CodeAnnotationLineRange,
) {
  const annotationsById = new Map<string, CodeAnnotationSelection>();
  for (let lineNumber = lineRange.startLine; lineNumber <= lineRange.endLine; lineNumber += 1) {
    const annotations = annotationBucketsByEndLine.get(lineNumber);
    if (!annotations) {
      continue;
    }
    for (const annotation of annotations) {
      annotationsById.set(annotation.id, annotation);
    }
  }
  return Array.from(annotationsById.values());
}

function MarkdownAnnotatableBlock({
  lineRange,
  onAnnotationStart,
  annotationDraft,
  annotations,
  renderAnnotationDraft,
  renderAnnotationMarker,
  annotationActionLabel,
  children,
}: {
  lineRange: CodeAnnotationLineRange;
  onAnnotationStart?: (lineRange: CodeAnnotationLineRange) => void;
  annotationDraft?: { lineRange: CodeAnnotationLineRange; body: string } | null;
  annotations: CodeAnnotationSelection[];
  renderAnnotationDraft?: (draft: { lineRange: CodeAnnotationLineRange; body: string }) => ReactNode;
  renderAnnotationMarker?: (annotation: CodeAnnotationSelection) => ReactNode;
  annotationActionLabel: string;
  children: ReactNode;
}) {
  return (
    <div
      className="fvp-markdown-annotatable-block"
      data-source-line-start={lineRange.startLine}
      data-source-line-end={lineRange.endLine}
    >
      {onAnnotationStart ? (
        <button
          type="button"
          className="fvp-markdown-annotation-button"
          onClick={() => onAnnotationStart(lineRange)}
          aria-label={`${annotationActionLabel} ${formatCodeAnnotationLineRange(lineRange)}`}
          title={`${annotationActionLabel} ${formatCodeAnnotationLineRange(lineRange)}`}
        >
          {annotationActionLabel}
        </button>
      ) : null}
      {children}
      {annotations.map((annotation) =>
        renderAnnotationMarker ? (
          <div key={annotation.id} className="fvp-markdown-annotation-inline">
            {renderAnnotationMarker(annotation)}
          </div>
        ) : null,
      )}
      {annotationDraft && renderAnnotationDraft ? (
        <div className="fvp-markdown-annotation-inline">
          {renderAnnotationDraft(annotationDraft)}
        </div>
      ) : null}
    </div>
  );
}

function FileMarkdownCodeBlock({
  className,
  value,
}: {
  className?: string;
  value: string;
}) {
  const languageTag = extractLanguageTag(className);
  const highlightedHtml = useMemo(
    () => highlightLine(value, languageTag),
    [languageTag, value],
  );

  return (
    <div className="fvp-file-markdown-codeblock">
      {languageTag ? (
        <div className="fvp-file-markdown-codeblock-label">{languageTag}</div>
      ) : null}
      <pre>
        <code
          className={className}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </pre>
    </div>
  );
}

function LazyMarkdownHeavyBlock({
  children,
  defer,
  label,
  revealKey = null,
}: {
  children: ReactNode;
  defer: boolean;
  label: string;
  revealKey?: string | null;
}) {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(() => !defer || isHeavyBlockRevealed(revealKey));
  const rootRef = useRef<HTMLDivElement | null>(null);
  const revealBlock = useCallback(() => {
    markHeavyBlockRevealed(revealKey);
    setIsVisible(true);
  }, [revealKey]);

  useEffect(() => {
    if (isVisible) {
      markHeavyBlockRevealed(revealKey);
    }
  }, [isVisible, revealKey]);

  useEffect(() => {
    if (defer && isHeavyBlockRevealed(revealKey)) {
      setIsVisible(true);
    }
  }, [defer, revealKey]);

  useEffect(() => {
    if (!defer || isVisible) {
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      const timeoutId = window.setTimeout(revealBlock, 0);
      return () => window.clearTimeout(timeoutId);
    }
    const root = rootRef.current;
    if (!root) {
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        revealBlock();
        observer.disconnect();
      }
    }, {
      rootMargin: "600px 0px",
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [defer, isVisible, revealBlock]);

  if (isVisible) {
    return <>{children}</>;
  }

  return (
    <div
      ref={rootRef}
      className="fvp-file-markdown-heavy-placeholder"
      data-testid="file-markdown-heavy-placeholder"
      aria-label={label}
    >
      {t("files.markdownHeavyBlockDeferred")}
    </div>
  );
}

function isMathCodeLanguage(languageTag: string | null) {
  return languageTag === "math" || languageTag === "latex" || languageTag === "tex";
}

function FileMarkdownMathBlock({
  className,
  value,
}: {
  className?: string;
  value: string;
}) {
  const languageTag = extractLanguageTag(className);
  const renderCacheKey = `${languageTag ?? "math"}:${hashStableString(value)}`;
  const renderedHtml = useMemo(() => {
    const cachedRender = readCachedKatexRender(renderCacheKey);
    if (cachedRender !== undefined) {
      return cachedRender;
    }
    const nextRender = renderLatexFormula(value);
    writeCachedKatexRender(renderCacheKey, nextRender);
    return nextRender;
  }, [renderCacheKey, value]);

  if (!renderedHtml) {
    return <FileMarkdownCodeBlock className={className} value={value} />;
  }

  return (
    <div
      className="fvp-file-markdown-math-block"
      data-language={languageTag ?? "math"}
      dangerouslySetInnerHTML={{ __html: renderedHtml }}
    />
  );
}

function FileMarkdownMermaidBlock({
  blockKey,
  className,
  documentKey,
  value,
}: {
  blockKey: string;
  className?: string;
  documentKey: string;
  value: string;
}) {
  const { t } = useTranslation();
  const [, setThemeVersion] = useState(0);
  const [activeTab, setActiveTab] = useState<MermaidBlockTab>(
    () => readCachedMermaidTabs(documentKey)[blockKey] ?? "source",
  );
  const mermaidTheme = detectMermaidTheme();
  const renderCacheKey = useMemo(
    () => createMermaidRenderCacheKey({
      blockKey,
      documentKey,
      theme: mermaidTheme,
      value,
    }),
    [blockKey, documentKey, mermaidTheme, value],
  );
  const [renderState, setRenderState] = useState<MermaidRenderState>({
    status: "idle",
  });
  const lastSuccessfulSvgRef = useRef<string | null>(null);
  const idRef = useRef(createStableRuntimeId("file-mermaid"));
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [stableBodyMinHeight, setStableBodyMinHeight] = useState(0);
  const highlightedHtml = useMemo(() => highlightLine(value, "mermaid"), [value]);
  const cachedSvgForActiveRender =
    activeTab === "render" ? readCachedMermaidRender(renderCacheKey) : null;
  const visibleSvg =
    renderState.status === "success"
      ? renderState.svg
      : cachedSvgForActiveRender ?? lastSuccessfulSvgRef.current;

  useEffect(() => {
    setActiveTab(readCachedMermaidTabs(documentKey)[blockKey] ?? "source");
    setStableBodyMinHeight(0);
  }, [blockKey, documentKey, value]);

  const handleActiveTabChange = useCallback((nextActiveTab: MermaidBlockTab) => {
    writeCachedMermaidTab(documentKey, blockKey, nextActiveTab);
    setActiveTab((currentTab) =>
      currentTab === nextActiveTab ? currentTab : nextActiveTab,
    );
  }, [blockKey, documentKey]);

  useEffect(() => {
    if (activeTab !== "render") {
      return;
    }

    const cachedSvg = readCachedMermaidRender(renderCacheKey);
    if (cachedSvg) {
      lastSuccessfulSvgRef.current = cachedSvg;
      setRenderState((current) =>
        current.status === "success" && current.svg === cachedSvg
          ? current
          : { status: "success", svg: cachedSvg },
      );
      return;
    }

    let cancelled = false;
    const previousSvg = lastSuccessfulSvgRef.current;
    if (!previousSvg) {
      setRenderState({ status: "rendering" });
    }

    void (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: mermaidTheme,
          securityLevel: "strict",
          fontFamily:
            "ui-sans-serif, -apple-system, BlinkMacSystemFont, sans-serif",
        });

        const id = `${idRef.current}-${hashStableString(renderCacheKey)}`;
        const { svg } = await mermaid.render(id, value);
        if (!cancelled) {
          writeCachedMermaidRender(renderCacheKey, svg);
          lastSuccessfulSvgRef.current = svg;
          setRenderState({ status: "success", svg });
        }
      } catch (error) {
        if (!cancelled) {
          setRenderState({
            status: "error",
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeTab, mermaidTheme, renderCacheKey, value]);

  useEffect(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (isThemeMutationAttribute(mutation.attributeName)) {
          setThemeVersion((prev) => prev + 1);
        }
      }
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const body = bodyRef.current;
    if (!body) {
      return;
    }

    const recordBodyHeight = () => {
      const nextHeight = Math.ceil(body.getBoundingClientRect().height);
      if (nextHeight <= 0) {
        return;
      }
      setStableBodyMinHeight((currentHeight) =>
        nextHeight > currentHeight ? nextHeight : currentHeight,
      );
    };

    recordBodyHeight();
    if (typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(recordBodyHeight);
    observer.observe(body);
    return () => observer.disconnect();
  }, [activeTab, highlightedHtml, renderState, visibleSvg]);

  return (
    <div className="fvp-file-markdown-codeblock fvp-file-markdown-mermaid">
      <div className="fvp-file-markdown-codeblock-label">
        <span>Mermaid</span>
        <div
          className="fvp-file-markdown-mermaid-tabs"
          role="tablist"
          aria-label={t("files.markdownMermaidTabList")}
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "source"}
            className={`fvp-file-markdown-mermaid-tab${activeTab === "source" ? " is-active" : ""}`}
            onClick={() => handleActiveTabChange("source")}
          >
            {t("files.markdownMermaidSource")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "render"}
            className={`fvp-file-markdown-mermaid-tab${activeTab === "render" ? " is-active" : ""}`}
            onClick={() => handleActiveTabChange("render")}
          >
            {t("files.markdownMermaidRender")}
          </button>
        </div>
      </div>

      <div
        ref={bodyRef}
        className="fvp-file-markdown-mermaid-body"
        data-active-tab={activeTab}
        data-testid="file-markdown-mermaid-body"
        style={stableBodyMinHeight > 0 ? { minHeight: stableBodyMinHeight } : undefined}
      >
        {activeTab === "source" ? (
          <pre>
            <code
              className={className}
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </pre>
        ) : visibleSvg ? (
          <div
            className="fvp-file-markdown-mermaid-diagram"
            data-testid="file-markdown-mermaid-preview"
            dangerouslySetInnerHTML={{ __html: visibleSvg }}
          />
        ) : renderState.status === "error" ? (
          <div className="fvp-file-markdown-mermaid-status fvp-file-markdown-mermaid-error">
            {t("files.markdownMermaidRenderFailed", { message: renderState.message })}
          </div>
        ) : (
          <div className="fvp-file-markdown-mermaid-status">
            {t("files.markdownMermaidRendering")}
          </div>
        )}
      </div>
    </div>
  );
}

export function FileMarkdownPreview({
  value,
  documentKey,
  className = "fvp-file-markdown",
  onAnnotationStart,
  annotationDraft = null,
  annotations = [],
  renderAnnotationDraft,
  renderAnnotationMarker,
  annotationActionLabel = "Annotate",
}: FileMarkdownPreviewProps) {
  const { t } = useTranslation();
  const mermaidDocumentKey = useMemo(
    () => documentKey ?? `inline:${hashStableString(value)}`,
    [documentKey, value],
  );
  const compiledDocument = useMemo(
    () => compileFileMarkdownDocument({
      documentKey: mermaidDocumentKey,
      rawMarkdown: value,
      rendererProfile: "file-markdown-github",
    }),
    [mermaidDocumentKey, value],
  );
  const renderProjection = useMemo(
    () => resolveMarkdownRenderProjection(compiledDocument.metrics),
    [compiledDocument.metrics],
  );
  const markdownBodyLineCount = useMemo(
    () => compiledDocument.body.length === 0 ? 0 : compiledDocument.body.split(/\r?\n/).length,
    [compiledDocument.body],
  );
  const effectiveInitialLineLimit =
    renderProjection.kind === "rich"
      ? markdownBodyLineCount
      : Math.min(renderProjection.initialLineLimit, markdownBodyLineCount);
  const effectiveMaxLineLimit =
    renderProjection.kind === "bounded"
      ? Math.min(renderProjection.maxLineLimit, markdownBodyLineCount)
      : markdownBodyLineCount;
  const [visibleLineLimit, setVisibleLineLimit] = useState(
    effectiveInitialLineLimit,
  );
  useEffect(() => {
    setVisibleLineLimit(effectiveInitialLineLimit);
  }, [compiledDocument.cacheKey, effectiveInitialLineLimit]);
  useEffect(() => {
    if (
      renderProjection.kind !== "progressive" ||
      visibleLineLimit >= effectiveMaxLineLimit
    ) {
      return;
    }
    const timeoutId = window.setTimeout(() => {
      setVisibleLineLimit((currentLineLimit) =>
        Math.min(
          currentLineLimit + renderProjection.chunkLineCount,
          effectiveMaxLineLimit,
        ),
      );
    }, 16);
    return () => window.clearTimeout(timeoutId);
  }, [
    effectiveMaxLineLimit,
    renderProjection.chunkLineCount,
    renderProjection.kind,
    visibleLineLimit,
  ]);
    const projectedLineLimit =
      renderProjection.kind === "rich"
        ? markdownBodyLineCount
        : visibleLineLimit;
    const visibleMarkdownBlocks = useMemo(
      () =>
        compiledDocument.blocks.filter((block) => block.startLine <= projectedLineLimit),
      [compiledDocument.blocks, projectedLineLimit],
    );
    const markdownLineMap = compiledDocument.lineMap;
    const hasMathContent = useMemo(
      () => detectMathContent(value),
      [value],
    );
  const annotationBucketsByEndLine = useMemo(() => {
    const buckets = new Map<number, CodeAnnotationSelection[]>();
    for (const annotation of annotations) {
      const existingBucket = buckets.get(annotation.lineRange.endLine);
      if (existingBucket) {
        existingBucket.push(annotation);
      } else {
        buckets.set(annotation.lineRange.endLine, [annotation]);
      }
    }
    return buckets;
  }, [annotations]);
  const [katexReady, setKatexReady] = useState(() => areKatexAssetsReady());
  useEffect(() => {
    if (!hasMathContent || katexReady) {
      return;
    }
    let cancelled = false;
    loadKatexAssets().then(() => {
      if (cancelled) {
        return;
      }
      setKatexReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [hasMathContent, katexReady]);
  const rehypePlugins = useMemo(
    () => {
      const plugins: unknown[] = [
        rehypeRaw,
        [rehypeSanitize, {
          ...defaultSchema,
          tagNames: [
            ...(defaultSchema.tagNames ?? []),
            "details",
            "summary",
            "abbr",
            "mark",
            "ins",
            "del",
            "sub",
            "sup",
            "kbd",
            "var",
            "samp",
          ],
          attributes: {
            ...defaultSchema.attributes,
            "*": [...(defaultSchema.attributes?.["*"] ?? []), "className", "class"],
          },
        }],
      ];
      const cachedRehypeKatex = getCachedRehypeKatex();
      if (katexReady && cachedRehypeKatex) {
        plugins.push(cachedRehypeKatex);
      }
      return plugins as Parameters<typeof ReactMarkdown>[0]["rehypePlugins"];
    },
    [katexReady],
  );

  const handleAnchorClick = useCallback((event: MouseEvent, href?: string) => {
    if (!href) {
      return;
    }
    const isExternal =
      href.startsWith("http://") ||
      href.startsWith("https://") ||
      href.startsWith("mailto:");
    if (!isExternal) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    void openUrl(href);
  }, []);

    const renderAnnotatableBlock = useCallback((
      tagName: AnnotatableBlockTag,
      node: MarkdownPositionTreeNode,
      children: ReactNode,
      blockStartLine: number,
      props?: Record<string, unknown>,
    ) => {
      const normalizedLineRange = resolveMarkdownNodeLineRange(node, 1);
      const lineRange = normalizedLineRange
        ? {
            startLine: (markdownLineMap[blockStartLine + normalizedLineRange.startLine - 2] ?? blockStartLine + normalizedLineRange.startLine - 1) + compiledDocument.bodyStartLine - 1,
            endLine: (markdownLineMap[blockStartLine + normalizedLineRange.endLine - 2] ?? blockStartLine + normalizedLineRange.endLine - 1) + compiledDocument.bodyStartLine - 1,
          }
        : null;
    const content = createElement(tagName, props, children);
    if (!lineRange) {
      return content;
    }
      const nestedRanges = collectNestedNodeLineRanges(node, 1).map((nestedRange) => {
        const normalizedStartLine = blockStartLine + nestedRange.startLine - 1;
        const normalizedEndLine = blockStartLine + nestedRange.endLine - 1;
        return {
          startLine: (markdownLineMap[normalizedStartLine - 1] ?? normalizedStartLine) + compiledDocument.bodyStartLine - 1,
          endLine: (markdownLineMap[normalizedEndLine - 1] ?? normalizedEndLine) + compiledDocument.bodyStartLine - 1,
        };
      });
    const blockAnnotations = collectAnnotationsEndingInRange(
      annotationBucketsByEndLine,
      lineRange,
    ).filter(
      (annotation) =>
        annotationEndsInBlock(annotation.lineRange, lineRange) &&
        !hasMoreSpecificAnnotationBlock(lineRange, annotation.lineRange, nestedRanges),
    );
    const shouldRenderDraft = Boolean(
      annotationDraft &&
        annotationEndsInBlock(annotationDraft.lineRange, lineRange) &&
        !hasMoreSpecificAnnotationBlock(lineRange, annotationDraft.lineRange, nestedRanges),
    );
    return (
      <MarkdownAnnotatableBlock
        lineRange={lineRange}
        onAnnotationStart={onAnnotationStart}
        annotationDraft={shouldRenderDraft ? annotationDraft : null}
        annotations={blockAnnotations}
        renderAnnotationDraft={renderAnnotationDraft}
        renderAnnotationMarker={renderAnnotationMarker}
        annotationActionLabel={annotationActionLabel}
      >
        {content}
      </MarkdownAnnotatableBlock>
    );
    }, [
    annotationBucketsByEndLine,
    annotationActionLabel,
    annotationDraft,
    compiledDocument.bodyStartLine,
    markdownLineMap,
    onAnnotationStart,
    renderAnnotationDraft,
      renderAnnotationMarker,
    ]);

    const createMarkdownComponents = useCallback((blockStartLine: number, blockKey: string): Components => ({
      a: ({ href, children }) => (
        <a href={href} onClick={(event) => handleAnchorClick(event, href)}>
          {children}
        </a>
      ),
      blockquote: ({ node, children }) => renderAnnotatableBlock("blockquote", node, children, blockStartLine),
      h1: ({ node, children }) => renderAnnotatableBlock("h1", node, children, blockStartLine),
      h2: ({ node, children }) => renderAnnotatableBlock("h2", node, children, blockStartLine),
      h3: ({ node, children }) => renderAnnotatableBlock("h3", node, children, blockStartLine),
      h4: ({ node, children }) => renderAnnotatableBlock("h4", node, children, blockStartLine),
      h5: ({ node, children }) => renderAnnotatableBlock("h5", node, children, blockStartLine),
      h6: ({ node, children }) => renderAnnotatableBlock("h6", node, children, blockStartLine),
      ol: ({ node, children }) => renderAnnotatableBlock("ol", node, children, blockStartLine),
      p: ({ node, children }) => renderAnnotatableBlock("p", node, children, blockStartLine),
      ul: ({ node, children }) => renderAnnotatableBlock("ul", node, children, blockStartLine),
      table: ({ node, children }) => renderAnnotatableBlock(
        "div",
        node,
      <LazyMarkdownHeavyBlock
        defer={renderProjection.kind !== "rich"}
        label={t("files.markdownHeavyBlockDeferred")}
        revealKey={createHeavyBlockRevealKey({
          blockKey,
          blockStartLine,
          documentKey: mermaidDocumentKey,
          kind: "table",
          node,
        })}
      >
        <table>{children}</table>
        </LazyMarkdownHeavyBlock>,
        blockStartLine,
        { className: "fvp-file-markdown-table-wrap" },
    ),
    pre: ({ node, children }) => {
      const { className: codeClassName, value: codeValue } = extractCodeFromPre(
        node as PreviewPreNode,
      );
      if (!codeClassName && !codeValue) {
        return renderAnnotatableBlock("div", node, <pre>{children}</pre>, blockStartLine);
      }
      const languageTag = extractLanguageTag(codeClassName);
      if (languageTag === "mermaid") {
        const mermaidBlockKey = createMermaidBlockKey(node, codeValue, blockStartLine);
        return renderAnnotatableBlock(
          "div",
          node,
          <LazyMarkdownHeavyBlock
            defer={renderProjection.kind !== "rich"}
            label="Mermaid"
            revealKey={`${mermaidDocumentKey}:${mermaidBlockKey}:mermaid`}
          >
            <FileMarkdownMermaidBlock
              blockKey={mermaidBlockKey}
              className={codeClassName}
              documentKey={mermaidDocumentKey}
              value={codeValue}
            />
          </LazyMarkdownHeavyBlock>,
          blockStartLine,
        );
      }
      if (isMathCodeLanguage(languageTag)) {
        return renderAnnotatableBlock(
          "div",
          node,
          <LazyMarkdownHeavyBlock
            defer={renderProjection.kind !== "rich"}
            label={languageTag ?? "math"}
            revealKey={createHeavyBlockRevealKey({
              blockKey,
              blockStartLine,
              documentKey: mermaidDocumentKey,
              kind: languageTag ?? "math",
              node,
              value: codeValue,
            })}
          >
            <FileMarkdownMathBlock
              className={codeClassName}
              value={codeValue}
            />
          </LazyMarkdownHeavyBlock>,
          blockStartLine,
        );
      }
      const shouldDeferCodeBlock =
        renderProjection.kind !== "rich" && isHeavyCodeBlock(codeValue);
      return renderAnnotatableBlock(
        "div",
        node,
        <LazyMarkdownHeavyBlock
          defer={shouldDeferCodeBlock}
          label={languageTag ?? "code"}
          revealKey={createHeavyBlockRevealKey({
            blockKey,
            blockStartLine,
            documentKey: mermaidDocumentKey,
            kind: languageTag ?? "code",
            node,
            value: codeValue,
          })}
        >
          <FileMarkdownCodeBlock
            className={codeClassName}
            value={codeValue}
          />
        </LazyMarkdownHeavyBlock>,
        blockStartLine,
      );
    },
  }), [
    handleAnchorClick,
    mermaidDocumentKey,
    renderAnnotatableBlock,
    renderProjection.kind,
    t,
  ]);

  return (
    <div
      className={className}
      data-markdown-render-strategy={compiledDocument.renderStrategy}
      data-markdown-render-projection={renderProjection.kind}
      data-markdown-visible-lines={projectedLineLimit}
      data-markdown-total-lines={compiledDocument.metrics.lineCount}
      data-testid="file-markdown-preview"
    >
      {compiledDocument.frontmatterFields.length > 0 ? (
        <section className="fvp-file-markdown-frontmatter" data-testid="file-markdown-frontmatter">
          <div className="fvp-file-markdown-frontmatter-label">
            {t("files.markdownFrontmatterLabel")}
          </div>
          <dl className="fvp-file-markdown-frontmatter-grid">
            {compiledDocument.frontmatterFields.map((field) => (
              <div key={field.key} className="fvp-file-markdown-frontmatter-row">
                <dt>{field.key}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {renderProjection.kind === "bounded" ? (
        <div className="fvp-file-markdown-render-budget" data-testid="file-markdown-render-budget">
          {t("files.markdownRenderBudgetBounded", {
            visibleCount: String(projectedLineLimit),
            totalCount: String(compiledDocument.metrics.lineCount),
          })}
        </div>
      ) : null}
        {visibleMarkdownBlocks.map((block) => (
          <ReactMarkdown
            key={block.key}
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={rehypePlugins}
            components={createMarkdownComponents(block.startLine, block.key)}
          >
            {block.markdown}
          </ReactMarkdown>
        ))}
      </div>
    );
  }

export function clearFileMarkdownPreviewRuntimeCachesForTests() {
  mermaidTabSessionCache.clear();
  mermaidRenderCache.clear();
  katexRenderCache.clear();
  revealedHeavyBlockCache.clear();
}
