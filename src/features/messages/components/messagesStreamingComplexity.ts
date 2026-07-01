import type { ConversationItem } from "../../../types";
import type { StreamMitigationProfile } from "../../threads/utils/streamLatencyDiagnostics";
import type { PresentationProfile } from "../presentation/presentationProfile";
import type { MessagesEngine } from "./messagesRenderUtils";

export const LIVE_ASSISTANT_MARKDOWN_THROTTLE_MS = 48;

const CODEX_MEDIUM_STREAMING_THROTTLE_MS = 80;
const CODEX_LARGE_STREAMING_THROTTLE_MS = 120;
const CODEX_STRUCTURED_STREAMING_THROTTLE_MS = 160;
const CODEX_HUGE_STREAMING_THROTTLE_MS = 220;
const CODEX_MEDIUM_STREAMING_MIN_LENGTH = 260;
const CODEX_MEDIUM_STREAMING_MIN_LINES = 6;
const CODEX_LARGE_STREAMING_MIN_LENGTH = 700;
const CODEX_LARGE_STREAMING_MIN_LINES = 12;
const CODEX_STRUCTURED_STREAMING_MIN_HEADINGS = 3;
const CODEX_STRUCTURED_STREAMING_MIN_LIST_ITEMS = 6;
const CODEX_STRUCTURED_STREAMING_MIN_CODE_LINES = 8;
const CODEX_HUGE_STREAMING_MIN_LENGTH = 1_600;
const CODEX_HUGE_STREAMING_MIN_LINES = 36;

export type StreamingMarkdownComplexity = {
  trimmedText: string;
  lineCount: number;
  headingCount: number;
  listItemCount: number;
  fencedCodeBlockCount: number;
  fencedCodeLineCount: number;
  structuredBlockCount: number;
  isMedium: boolean;
  isLarge: boolean;
  isHuge: boolean;
  isStructuredHeavy: boolean;
};

export const EMPTY_STREAMING_MARKDOWN_COMPLEXITY: StreamingMarkdownComplexity = {
  trimmedText: "",
  lineCount: 0,
  headingCount: 0,
  listItemCount: 0,
  fencedCodeBlockCount: 0,
  fencedCodeLineCount: 0,
  structuredBlockCount: 0,
  isMedium: false,
  isLarge: false,
  isHuge: false,
  isStructuredHeavy: false,
};

export function analyzeStreamingMarkdownComplexity(
  displayText: string,
): StreamingMarkdownComplexity {
  const trimmedText = displayText.trim();
  if (!trimmedText) {
    return EMPTY_STREAMING_MARKDOWN_COMPLEXITY;
  }

  const lines = trimmedText.split(/\r?\n/);
  const lineCount = lines.length;
  let headingCount = 0;
  let listItemCount = 0;
  let fencedCodeBlockCount = 0;
  let fencedCodeLineCount = 0;
  let insideCodeFence = false;

  for (const line of lines) {
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      continue;
    }
    if (normalizedLine.startsWith("```")) {
      fencedCodeBlockCount += insideCodeFence ? 0 : 1;
      insideCodeFence = !insideCodeFence;
      continue;
    }
    if (insideCodeFence) {
      fencedCodeLineCount += 1;
      continue;
    }
    if (/^#{1,6}\s+/.test(normalizedLine)) {
      headingCount += 1;
      continue;
    }
    if (/^(?:[-*+]|\d+[.)])\s+/.test(normalizedLine)) {
      listItemCount += 1;
    }
  }

  const isMedium =
    trimmedText.length >= CODEX_MEDIUM_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_MEDIUM_STREAMING_MIN_LINES;
  const isLarge =
    trimmedText.length >= CODEX_LARGE_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_LARGE_STREAMING_MIN_LINES;
  const isHuge =
    trimmedText.length >= CODEX_HUGE_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_HUGE_STREAMING_MIN_LINES;
  const structuredBlockCount =
    headingCount + listItemCount + fencedCodeBlockCount + fencedCodeLineCount;
  const isStructuredHeavy =
    headingCount >= CODEX_STRUCTURED_STREAMING_MIN_HEADINGS ||
    listItemCount >= CODEX_STRUCTURED_STREAMING_MIN_LIST_ITEMS ||
    fencedCodeLineCount >= CODEX_STRUCTURED_STREAMING_MIN_CODE_LINES ||
    (fencedCodeBlockCount > 0 && structuredBlockCount >= CODEX_MEDIUM_STREAMING_MIN_LINES);

  return {
    trimmedText,
    lineCount,
    headingCount,
    listItemCount,
    fencedCodeBlockCount,
    fencedCodeLineCount,
    structuredBlockCount,
    isMedium,
    isLarge,
    isHuge,
    isStructuredHeavy,
  };
}

/**
 * 判定某引擎的流式 assistant 消息是否启用 staged 轻量 markdown 渲染。
 *
 * 历史上仅 codex 走该路径(useCodexStagedMarkdownThrottle);Claude 作为主引擎却
 * 恒走 full react-markdown 全量重解析,是 Issue #721 对话页 6FPS 的主因。此处把
 * codex 已在生产验证的轻量流式路径同样启用给 claude;opencode 与其它引擎保持不变,
 * 除非 presentationProfile 显式开启。
 */
export function shouldUseStagedStreamingMarkdown(
  activeEngine: MessagesEngine,
  presentationProfile: PresentationProfile | null | undefined,
): boolean {
  if (presentationProfile?.useCodexStagedMarkdownThrottle === true) {
    return true;
  }
  return activeEngine === "codex" || activeEngine === "claude";
}

export function resolveAssistantMessageStreamingThrottleMs(
  item: Extract<ConversationItem, { kind: "message" }>,
  isStreaming: boolean,
  activeEngine: MessagesEngine,
  mitigationProfile: StreamMitigationProfile | null | undefined,
  presentationProfile: PresentationProfile | null | undefined,
  complexity: StreamingMarkdownComplexity,
) {
  if (!isStreaming) {
    return 80;
  }
  if (mitigationProfile?.messageStreamingThrottleMs) {
    return mitigationProfile.messageStreamingThrottleMs;
  }
  const baselineThrottleMs =
    presentationProfile?.assistantMarkdownStreamingThrottleMs ??
    LIVE_ASSISTANT_MARKDOWN_THROTTLE_MS;
  const useStagedMarkdownThrottle = shouldUseStagedStreamingMarkdown(
    activeEngine,
    presentationProfile,
  );
  if (item.role !== "assistant" || !useStagedMarkdownThrottle) {
    return baselineThrottleMs;
  }
  if (!complexity.trimmedText) {
    return baselineThrottleMs;
  }
  if (complexity.isHuge) {
    return CODEX_HUGE_STREAMING_THROTTLE_MS;
  }
  if (complexity.isStructuredHeavy && complexity.isLarge) {
    return CODEX_STRUCTURED_STREAMING_THROTTLE_MS;
  }
  if (complexity.isLarge) {
    return CODEX_LARGE_STREAMING_THROTTLE_MS;
  }
  if (complexity.isStructuredHeavy || complexity.isMedium) {
    return CODEX_MEDIUM_STREAMING_THROTTLE_MS;
  }
  return baselineThrottleMs;
}

export function resolveReasoningStreamingThrottleMs(
  isLive: boolean,
  mitigationProfile: StreamMitigationProfile | null | undefined,
  presentationProfile: PresentationProfile | null | undefined,
) {
  if (!isLive) {
    return 80;
  }
  return (
    mitigationProfile?.reasoningStreamingThrottleMs ??
    presentationProfile?.reasoningStreamingThrottleMs ??
    180
  );
}

/**
 * Streaming-only incremental analysis for chat-stream-render-isolation-2026-06
 * task 3.1. `prev` MUST be the StreamingMarkdownComplexity previously computed
 * for `prevText`. `deltaText` MUST be the new text appended after `prevText`
 * (typical streaming path) — the helper assumes a suffix-append relationship
 * and walks the delta lines once, threading the inherited fenced-code state
 * from the previous pass.
 *
 * The helper produces a complexity object consistent with what
 * `analyzeStreamingMarkdownComplexity(nextText)` would return, but avoids
 * re-scanning the entire prefix. Empty / whitespace deltas are treated as
 * "no change" and return `prev` unchanged.
 */
export function analyzeStreamingMarkdownComplexityDelta(
  prev: StreamingMarkdownComplexity,
  prevText: string,
  deltaText: string,
): StreamingMarkdownComplexity {
  if (typeof deltaText !== "string" || deltaText.length === 0) {
    return prev;
  }
  const trimmedDelta = deltaText.trim();
  if (!trimmedDelta) {
    return prev;
  }
  const nextText = prevText + deltaText;
  const trimmedText = nextText.trim();
  if (!trimmedText) {
    return EMPTY_STREAMING_MARKDOWN_COMPLEXITY;
  }
  const joinsExistingLine =
    prevText.length > 0 &&
    !/[\r\n]$/.test(prevText) &&
    !/^[\r\n]/.test(deltaText);
  if (joinsExistingLine) {
    return analyzeStreamingMarkdownComplexity(nextText);
  }
  // Inherit fenced-code state by replaying all fence toggles on
  // prevText and stopping at the final state.
  let insideCodeFence = false;
  for (const rawLine of prevText.split(/\r?\n/)) {
    if (rawLine.trim().startsWith("```")) {
      insideCodeFence = !insideCodeFence;
    }
  }
  const deltaLines = trimmedDelta.split(/\r?\n/);
  let headingCount = prev.headingCount;
  let listItemCount = prev.listItemCount;
  let fencedCodeBlockCount = prev.fencedCodeBlockCount;
  let fencedCodeLineCount = prev.fencedCodeLineCount;
  let newLineCount = 0;
  for (const line of deltaLines) {
    if (line.length > 0) {
      newLineCount += 1;
    }
    const normalizedLine = line.trim();
    if (!normalizedLine) {
      continue;
    }
    if (normalizedLine.startsWith("```")) {
      fencedCodeBlockCount += insideCodeFence ? 0 : 1;
      insideCodeFence = !insideCodeFence;
      continue;
    }
    if (insideCodeFence) {
      fencedCodeLineCount += 1;
      continue;
    }
    if (/^#{1,6}\s+/.test(normalizedLine)) {
      headingCount += 1;
      continue;
    }
    if (/^(?:[-*+]|\d+[.)])\s+/.test(normalizedLine)) {
      listItemCount += 1;
    }
  }
  const lineCount = prev.lineCount + newLineCount;
  const isMedium =
    trimmedText.length >= CODEX_MEDIUM_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_MEDIUM_STREAMING_MIN_LINES;
  const isLarge =
    trimmedText.length >= CODEX_LARGE_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_LARGE_STREAMING_MIN_LINES;
  const isHuge =
    trimmedText.length >= CODEX_HUGE_STREAMING_MIN_LENGTH ||
    lineCount >= CODEX_HUGE_STREAMING_MIN_LINES;
  const structuredBlockCount =
    headingCount + listItemCount + fencedCodeBlockCount + fencedCodeLineCount;
  const isStructuredHeavy =
    headingCount >= CODEX_STRUCTURED_STREAMING_MIN_HEADINGS ||
    listItemCount >= CODEX_STRUCTURED_STREAMING_MIN_LIST_ITEMS ||
    fencedCodeLineCount >= CODEX_STRUCTURED_STREAMING_MIN_CODE_LINES ||
    (fencedCodeBlockCount > 0 && structuredBlockCount >= CODEX_MEDIUM_STREAMING_MIN_LINES);
  return {
    trimmedText,
    lineCount,
    headingCount,
    listItemCount,
    fencedCodeBlockCount,
    fencedCodeLineCount,
    structuredBlockCount,
    isMedium,
    isLarge,
    isHuge,
    isStructuredHeavy,
  };
}
