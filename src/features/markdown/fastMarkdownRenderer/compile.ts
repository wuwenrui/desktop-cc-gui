import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype, { type Options as RemarkRehypeOptions } from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema, type Options as RehypeSanitizeOptions } from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { toHtml } from "hast-util-to-html";
import type { Root as MdastRoot } from "mdast";
import type { Root as HastRoot } from "hast";
import { hashStableString } from "../../files/utils/fileMarkdownDocument";
import { extractMarkdownOutline } from "./parserOutline";
import { extractHeavyBlocks } from "./heavyBlocks";
import { attachHeadingIds } from "./attachHeadingIds";
import { attachSourceLineAttrs } from "./sourceLineAttrs";
import { sanitizeFastMarkdownHtml } from "./sanitize";
import { getCachedFastMarkdownRender, setCachedFastMarkdownRender } from "./cache";
import type {
  CompileFastMarkdownArgs,
  FastMarkdownFallbackReason,
  FastMarkdownRenderDiagnostics,
  FastMarkdownRenderResult,
  FastMarkdownRendererProfileId,
  MarkdownOutlineEntry,
  MarkdownSourceLineAnchor,
  FastMarkdownHeavyBlock,
} from "./types";

type FastMarkdownProcessor = {
  parse: (input: string) => MdastRoot;
  run: (tree: MdastRoot) => Promise<HastRoot>;
};

const FILE_PREVIEW_SANITIZE_SCHEMA: RehypeSanitizeOptions = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames ?? []),
    "abbr",
    "details",
    "summary",
    "mark",
    "ins",
    "del",
    "sub",
    "sup",
    "kbd",
    "var",
    "samp",
    "figure",
    "figcaption",
    "section",
  ],
  attributes: {
    ...(defaultSchema.attributes ?? {}),
    "*": [
      ...(defaultSchema.attributes?.["*"] ?? []),
      "className",
      "class",
      "data-source-line-start",
      "data-source-line-end",
      "data-source-block-id",
      "data-heavy-block-kind",
      "data-heavy-block-id",
      "data-fast-renderer-marker",
    ],
  },
  protocols: {
    ...(defaultSchema.protocols ?? {}),
    href: ["http", "https", "mailto", "tel", "ftp"],
    src: ["http", "https", "data"],
  },
};

const REMARK_REHYPE_OPTIONS: RemarkRehypeOptions = {
  allowDangerousHtml: true,
};

function buildProcessor(): FastMarkdownProcessor {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkRehype, REMARK_REHYPE_OPTIONS)
    .use(rehypeRaw)
    .use(rehypeSanitize, FILE_PREVIEW_SANITIZE_SCHEMA)
    .use(rehypeKatex, { strict: "ignore", output: "html" });
  return processor as unknown as FastMarkdownProcessor;
}

function buildBoundedProcessor(): FastMarkdownProcessor {
  // Bounded profile reuses the same pipeline; the projection is
  // applied before the compile call so the same processor applies.
  return buildProcessor();
}

function createCacheKey(args: CompileFastMarkdownArgs): {
  cacheKey: string;
  contentHash: string;
  featureFlagFingerprint: string;
  boundedLineLimit: number;
} {
  const contentHash = hashStableString(args.rawMarkdown);
  const featureFlagFingerprint = createFeatureFlagFingerprint(args.featureFlags);
  const boundedLineLimit = args.options?.lineLimit ?? Number.POSITIVE_INFINITY;
  const cacheKey = [
    args.documentKey,
    args.rendererProfile,
    contentHash,
    boundedLineLimit === Number.POSITIVE_INFINITY ? "full" : String(boundedLineLimit),
    featureFlagFingerprint,
  ].join(":");
  return { cacheKey, contentHash, featureFlagFingerprint, boundedLineLimit };
}

function createFeatureFlagFingerprint(flags: CompileFastMarkdownArgs["featureFlags"]): string {
  if (!flags) {
    return "default";
  }
  return [
    flags.fastHtmlRendererEnabled ? "fast" : "no-fast",
    flags.boundedFastHtmlRendererEnabled ? "bounded" : "no-bounded",
  ].join("|");
}

function clampForBounded(rawMarkdown: string, lineLimit: number): string {
  if (!Number.isFinite(lineLimit) || lineLimit <= 0) {
    return rawMarkdown;
  }
  const lines = rawMarkdown.split(/\r?\n/);
  if (lines.length <= lineLimit) {
    return rawMarkdown;
  }
  return lines.slice(0, lineLimit).join("\n");
}

export async function compileFastMarkdown(
  args: CompileFastMarkdownArgs,
): Promise<FastMarkdownRenderResult> {
  const { cacheKey, contentHash, featureFlagFingerprint, boundedLineLimit } = createCacheKey(args);
  const cached = getCachedFastMarkdownRender(cacheKey);
  if (cached) {
    return {
      ...cached,
      diagnostics: {
        ...cached.diagnostics,
        cacheState: "hit",
      },
    };
  }

  const compileStart = performance.now();
  const fallbackReason: FastMarkdownFallbackReason = "none";
  const truncated = Number.isFinite(boundedLineLimit) && boundedLineLimit > 0;
  const projectedMarkdown = truncated
    ? clampForBounded(args.rawMarkdown, boundedLineLimit)
    : args.rawMarkdown;

  let outline: MarkdownOutlineEntry[] = [];
  let heavyBlocks: FastMarkdownHeavyBlock[] = [];
  let sourceLineAnchors: MarkdownSourceLineAnchor[] = [];
  let html = "";
  let sanitizedSuccessfully = true;
  let sanitizeDurationMs = 0;

  try {
    const processor = truncated ? buildBoundedProcessor() : buildProcessor();
    const mdast = processor.parse(projectedMarkdown) as MdastRoot;
    const outlineMdast = truncated
      ? (processor.parse(args.rawMarkdown) as MdastRoot)
      : mdast;

    outline = extractMarkdownOutline(outlineMdast, args.bodyStartLine ?? 1);
    heavyBlocks = extractHeavyBlocks(mdast, args.bodyStartLine ?? 1);

    const hast = (await processor.run(mdast)) as HastRoot;
    // Attach stable heading IDs so outline anchor links resolve in the DOM.
    attachHeadingIds(
      hast,
      outline.map((e) => ({ anchorId: e.id, title: e.title })),
    );
    sourceLineAnchors = attachSourceLineAttrs(hast, args.bodyStartLine ?? 1, args.documentKey);
    html = toHtml(hast, { allowDangerousHtml: false });
  } catch (compileError) {
    return createFailureResult({
      args,
      cacheKey,
      contentHash,
      featureFlagFingerprint,
      boundedLineLimit,
      truncated,
      fallbackReason: "compile-failed",
      compileStart,
      outline,
      heavyBlocks,
      sourceLineAnchors,
      error: compileError,
    });
  }

  try {
    const sanitizeStart = performance.now();
    const sanitized = sanitizeFastMarkdownHtml(html);
    sanitizeDurationMs = performance.now() - sanitizeStart;
    html = sanitized.html;
    sanitizedSuccessfully = sanitized.sanitizedSuccessfully;
  } catch (sanitizeError) {
    return createFailureResult({
      args,
      cacheKey,
      contentHash,
      featureFlagFingerprint,
      boundedLineLimit,
      truncated,
      fallbackReason: "sanitizer-failed",
      compileStart,
      outline,
      heavyBlocks,
      sourceLineAnchors,
      error: sanitizeError,
    });
  }

  const compileDurationMs = performance.now() - compileStart;
  const totalSourceLines = projectedMarkdown.length === 0
    ? 0
    : projectedMarkdown.split(/\r?\n/).length;
  const diagnostics: FastMarkdownRenderDiagnostics = {
    profile: args.rendererProfile,
    contentHash,
    cacheKey,
    cacheState: "miss",
    compileDurationMs,
    sanitizeDurationMs,
    totalSourceLines,
    totalHeadings: outline.length,
    totalHeavyBlocks: heavyBlocks.length,
    fallbackReason: sanitizedSuccessfully ? fallbackReason : "sanitizer-failed",
    truncated,
    featureFlagApplied: featureFlagFingerprint !== "default",
  };

  const result: FastMarkdownRenderResult = {
    cacheKey,
    contentHash,
    html,
    outline,
    sourceLineAnchors,
    heavyBlocks,
    diagnostics,
    rendererProfile: args.rendererProfile,
  };
  setCachedFastMarkdownRender(cacheKey, result);
  return result;
}

type FailureArgs = {
  args: CompileFastMarkdownArgs;
  cacheKey: string;
  contentHash: string;
  featureFlagFingerprint: string;
  boundedLineLimit: number;
  truncated: boolean;
  fallbackReason: FastMarkdownFallbackReason;
  compileStart: number;
  outline: MarkdownOutlineEntry[];
  heavyBlocks: FastMarkdownHeavyBlock[];
  sourceLineAnchors: MarkdownSourceLineAnchor[];
  error: unknown;
};

function createFailureResult(failure: FailureArgs): FastMarkdownRenderResult {
  const diagnostics: FastMarkdownRenderDiagnostics = {
    profile: failure.args.rendererProfile,
    contentHash: failure.contentHash,
    cacheKey: failure.cacheKey,
    cacheState: "miss",
    compileDurationMs: performance.now() - failure.compileStart,
    sanitizeDurationMs: 0,
    totalSourceLines: 0,
    totalHeadings: failure.outline.length,
    totalHeavyBlocks: failure.heavyBlocks.length,
    fallbackReason: failure.fallbackReason,
    truncated: failure.truncated,
    featureFlagApplied: failure.featureFlagFingerprint !== "default",
  };
  return {
    cacheKey: failure.cacheKey,
    contentHash: failure.contentHash,
    html: "",
    outline: failure.outline,
    sourceLineAnchors: failure.sourceLineAnchors,
    heavyBlocks: failure.heavyBlocks,
    diagnostics,
    rendererProfile: failure.args.rendererProfile,
  };
}

export function isFastMarkdownProfile(id: string): id is FastMarkdownRendererProfileId {
  return (
    id === "rich-react" ||
    id === "fast-html" ||
    id === "bounded-fast-html" ||
    id === "low-cost-readable"
  );
}
