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
  featureFlags: FastMarkdownFeatureFlags;
  boundedLineLimit?: number;
  fastHtmlOnly?: boolean;
};

const DEFAULT_BOUNDED_LINE_LIMIT = 600;

const FAST_HTML_SIZE_BUDGET = 256 * 1024;

function isFastHtmlEnabled(flags: FastMarkdownFeatureFlags): boolean {
  return flags.fastHtmlRendererEnabled === true;
}

function isBoundedFastHtmlEnabled(flags: FastMarkdownFeatureFlags): boolean {
  return flags.boundedFastHtmlRendererEnabled === true;
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

export function resolveFastMarkdownProfileInputs(args: {
  rawMarkdown: string;
  featureFlags: FastMarkdownFeatureFlags;
  boundedLineLimit?: number;
  fastHtmlOnly?: boolean;
}): ResolveFastMarkdownProfileInputs {
  return {
    rawMarkdownLength: args.rawMarkdown.length,
    totalSourceLines: countMarkdownSourceLines(args.rawMarkdown),
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
  if (!isFastHtmlEnabled(inputs.featureFlags)) {
    return "rich-react";
  }
  const exceedsSizeBudget = inputs.rawMarkdownLength > FAST_HTML_SIZE_BUDGET;
  if (exceedsSizeBudget && isBoundedFastHtmlEnabled(inputs.featureFlags)) {
    return "bounded-fast-html";
  }
  return "fast-html";
}

export const FAST_MARKDOWN_RENDERER_LIMITS = {
  FAST_HTML_SIZE_BUDGET_BYTES: FAST_HTML_SIZE_BUDGET,
  DEFAULT_BOUNDED_LINE_LIMIT,
};
