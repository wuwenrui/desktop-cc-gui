import type { TokenUsageBreakdown } from "../../../types";

export type TokenBreakdownSegmentKind =
  | "input"
  | "cached_input"
  | "output"
  | "reasoning";

export type TokenBreakdownSegment = {
  readonly kind: TokenBreakdownSegmentKind;
  readonly tokens: number;
  readonly percent: number;
};

export type TokenBreakdownViewModel = {
  readonly totalTokens: number;
  readonly segments: readonly TokenBreakdownSegment[];
};

function clampTokenCount(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function buildTokenBreakdownViewModel(
  usage: TokenUsageBreakdown | null | undefined,
): TokenBreakdownViewModel | null {
  if (!usage) {
    return null;
  }

  const cachedInputTokens = clampTokenCount(usage.cachedInputTokens);
  const inputTokens = Math.max(
    clampTokenCount(usage.inputTokens) - cachedInputTokens,
    0,
  );
  const reasoningTokens = clampTokenCount(usage.reasoningOutputTokens);
  const outputTokens = Math.max(
    clampTokenCount(usage.outputTokens) - reasoningTokens,
    0,
  );
  const totalTokens =
    clampTokenCount(usage.totalTokens) ||
    inputTokens + cachedInputTokens + outputTokens + reasoningTokens;

  if (totalTokens <= 0) {
    return {
      totalTokens: 0,
      segments: [],
    };
  }

  const rawSegments: readonly Omit<TokenBreakdownSegment, "percent">[] = [
    { kind: "input", tokens: inputTokens },
    { kind: "cached_input", tokens: cachedInputTokens },
    { kind: "output", tokens: outputTokens },
    { kind: "reasoning", tokens: reasoningTokens },
  ];

  return {
    totalTokens,
    segments: rawSegments
      .filter((segment) => segment.tokens > 0)
      .map((segment) => ({
        ...segment,
        percent: (segment.tokens / totalTokens) * 100,
      })),
  };
}
