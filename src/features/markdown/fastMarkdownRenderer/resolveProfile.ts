import type {
  FastMarkdownFeatureFlags,
  FastMarkdownRendererProfileId,
} from "./types";

/**
 * Resolver inputs are derived from upstream signals (file size, line
 * count, current feature flag snapshot) and stay deterministic. They
 * are intentionally a pure value object so the selector can run on a
 * Worker without DOM access and produce a stable profile id.
 */
export type ResolveFastMarkdownProfileInputs = {
  rawMarkdownLength: number;
  totalSourceLines: number;
  markdownBlockCount: number;
  heavyBlockCount: number;
  featureFlags: FastMarkdownFeatureFlags;
  boundedLineLimit?: number;
  fastHtmlOnly?: boolean;
};

const DEFAULT_BOUNDED_LINE_LIMIT = 600;

const FAST_HTML_SIZE_BUDGET = 256 * 1024;
const LARGE_MARKDOWN_SIZE_BUDGET = 96 * 1024;
const LARGE_MARKDOWN_LINE_BUDGET = 2_500;
const LARGE_MARKDOWN_BLOCK_BUDGET = 900;
const LARGE_MARKDOWN_HEAVY_BLOCK_BUDGET = 20;
const BOUNDED_MARKDOWN_LINE_BUDGET = 6_000;

function isFastHtmlEnabled(flags: FastMarkdownFeatureFlags): boolean {
  return flags.fastHtmlRendererEnabled === true;
}

function isBoundedFastHtmlEnabled(flags: FastMarkdownFeatureFlags): boolean {
  return flags.boundedFastHtmlRendererEnabled === true;
}

function isLargeDocumentFastRendererDisabled(flags: FastMarkdownFeatureFlags): boolean {
  return flags.largeDocumentFastRendererDisabled === true;
}

/**
 * Returns the line count of `markdown` (CR/LF tolerant). When
 * `markdown` is empty, returns 0. This is a pure function with no
 * dependency on the host environment.
 */
export function countMarkdownSourceLines(markdown: string): number {
  if (!markdown) {
    return 0;
  }
  return markdown.split(/\r?\n/).length;
}

export function countFastMarkdownProfileBlocks(markdown: string): {
  markdownBlockCount: number;
  heavyBlockCount: number;
} {
  if (!markdown) {
    return { markdownBlockCount: 0, heavyBlockCount: 0 };
  }
  const lines = markdown.split(/\r?\n/);
  let markdownBlockCount = 0;
  let heavyBlockCount = 0;
  let insideFence = false;
  let fenceLanguage = "";
  let previousWasBlank = true;

  for (const line of lines) {
    const trimmed = line.trim();
    const fenceMatch = trimmed.match(/^```+\s*([\w-]+)?/);
    if (fenceMatch) {
      if (!insideFence) {
        markdownBlockCount += 1;
        fenceLanguage = (fenceMatch[1] ?? "").toLowerCase();
        if (["mermaid", "math", "latex", "tex"].includes(fenceLanguage)) {
          heavyBlockCount += 1;
        }
      }
      insideFence = !insideFence;
      previousWasBlank = false;
      continue;
    }
    if (insideFence) {
      continue;
    }
    if (!trimmed) {
      previousWasBlank = true;
      continue;
    }
    if (/^#{1,6}\s/.test(trimmed) || /^>\s?/.test(trimmed) || /^[-*+]\s/.test(trimmed) || /^\d+\.\s/.test(trimmed) || /^\|/.test(trimmed)) {
      markdownBlockCount += 1;
      if (/^\|/.test(trimmed)) {
        heavyBlockCount += 1;
      }
      previousWasBlank = false;
      continue;
    }
    if (previousWasBlank) {
      markdownBlockCount += 1;
    }
    previousWasBlank = false;
  }

  return { markdownBlockCount, heavyBlockCount };
}

export function resolveFastMarkdownProfileInputs(args: {
  rawMarkdown: string;
  featureFlags: FastMarkdownFeatureFlags;
  boundedLineLimit?: number;
  fastHtmlOnly?: boolean;
}): ResolveFastMarkdownProfileInputs {
  const blockMetrics = countFastMarkdownProfileBlocks(args.rawMarkdown);
  return {
    rawMarkdownLength: args.rawMarkdown.length,
    totalSourceLines: countMarkdownSourceLines(args.rawMarkdown),
    markdownBlockCount: blockMetrics.markdownBlockCount,
    heavyBlockCount: blockMetrics.heavyBlockCount,
    featureFlags: args.featureFlags,
    boundedLineLimit: args.boundedLineLimit ?? DEFAULT_BOUNDED_LINE_LIMIT,
    fastHtmlOnly: args.fastHtmlOnly === true,
  };
}

/**
 * Deterministic selector for the renderer profile. The decision tree:
 *
 *   1. `fastHtmlOnly` forces "fast-html".
 *   2. If the fast flag is off, return "rich-react" (the legacy
 *      ReactMarkdown path) so behavior matches the current build.
 *   3. If the document exceeds the size budget AND bounded flag is
 *      on, return "bounded-fast-html" so the renderer can pre-clamp
 *      to `boundedLineLimit` and short-circuit on the cheap profile.
 *   4. Otherwise return "fast-html".
 */
export function resolveFastMarkdownRendererProfile(
  inputs: ResolveFastMarkdownProfileInputs,
): FastMarkdownRendererProfileId {
  if (inputs.fastHtmlOnly) {
    return "fast-html";
  }
  const isLargeDocument =
    inputs.rawMarkdownLength > LARGE_MARKDOWN_SIZE_BUDGET ||
    inputs.totalSourceLines > LARGE_MARKDOWN_LINE_BUDGET ||
    inputs.markdownBlockCount > LARGE_MARKDOWN_BLOCK_BUDGET ||
    inputs.heavyBlockCount > LARGE_MARKDOWN_HEAVY_BLOCK_BUDGET;
  const shouldDefaultLargeDocumentToFast =
    isLargeDocument && !isLargeDocumentFastRendererDisabled(inputs.featureFlags);

  if (!isFastHtmlEnabled(inputs.featureFlags) && !shouldDefaultLargeDocumentToFast) {
    return "rich-react";
  }
  const exceedsSizeBudget = inputs.rawMarkdownLength > FAST_HTML_SIZE_BUDGET;
  const exceedsBoundedBudget =
    exceedsSizeBudget || inputs.totalSourceLines > BOUNDED_MARKDOWN_LINE_BUDGET;
  if (
    exceedsBoundedBudget &&
    (isBoundedFastHtmlEnabled(inputs.featureFlags) || shouldDefaultLargeDocumentToFast)
  ) {
    return "bounded-fast-html";
  }
  return "fast-html";
}

export const FAST_MARKDOWN_RENDERER_LIMITS = {
  FAST_HTML_SIZE_BUDGET_BYTES: FAST_HTML_SIZE_BUDGET,
  LARGE_MARKDOWN_SIZE_BUDGET_BYTES: LARGE_MARKDOWN_SIZE_BUDGET,
  LARGE_MARKDOWN_LINE_BUDGET,
  LARGE_MARKDOWN_BLOCK_BUDGET,
  LARGE_MARKDOWN_HEAVY_BLOCK_BUDGET,
  BOUNDED_MARKDOWN_LINE_BUDGET,
  DEFAULT_BOUNDED_LINE_LIMIT,
};
