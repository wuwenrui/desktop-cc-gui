import type { Virtualizer } from "@tanstack/react-virtual";
import type { ConversationItem } from "../../../types";
import type { TimelineProjectionRow } from "./messagesTimelineProjection";

export const TIMELINE_VIRTUALIZATION_MIN_ROWS = 200;
export const TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT = 96;

/**
 * Escape hatch for chat-stream-render-isolation-2026-06 task 2.1.
 * When `true`, `shouldVirtualizeTimelineRows` keeps the long-row virtualizer
 * enabled during streaming even when `isThinking === true`; the legacy
 * `!isThinking` short-circuit only ran for short conversations and let
 * row counts above 200 produce unvirtualized DOM trees during long
 * parallel-streaming sessions.
 */
export const TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED = true;

export function shouldVirtualizeTimelineRows(input: {
  isThinking: boolean;
  rowCount: number;
  renderWeight?: number;
}) {
  const hasHighRenderDensity =
    typeof input.renderWeight === "number" &&
    input.renderWeight >= TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT &&
    input.renderWeight > input.rowCount * 2;
  if (hasHighRenderDensity) {
    return true;
  }
  if (!TIMELINE_VIRTUALIZATION_DURING_STREAMING_ENABLED && input.isThinking) {
    return input.rowCount >= TIMELINE_VIRTUALIZATION_MIN_ROWS;
  }
  return input.rowCount >= TIMELINE_VIRTUALIZATION_MIN_ROWS;
}

function estimateConversationItemRenderWeight(
  item: ConversationItem,
) {
  if (item.kind === "message") {
    const imageWeight = (item.images ?? []).reduce((total, image) => {
      const inlineDataWeight = image.toLowerCase().startsWith("data:image/")
        ? Math.min(160, Math.ceil(image.length / 32_768))
        : 0;
      return total + 28 + inlineDataWeight;
    }, 0);
    const deferredImageWeight = (item.deferredImages?.length ?? 0) * 18;
    const textWeight = Math.min(24, Math.floor(item.text.length / 2_000));
    return 1 + imageWeight + deferredImageWeight + textWeight;
  }
  if (item.kind === "generatedImage") {
    const imageWeight = item.images.reduce((total, image) => {
      const inlineDataWeight = image.src.toLowerCase().startsWith("data:image/")
        ? Math.min(160, Math.ceil(image.src.length / 32_768))
        : 0;
      return total + 28 + inlineDataWeight;
    }, 0);
    return 24 + imageWeight;
  }
  if (item.kind === "reasoning") {
    return 1 + Math.min(18, Math.floor((item.summary.length + item.content.length) / 2_000));
  }
  if (item.kind === "tool") {
    return 1 + Math.min(16, Math.floor((item.output?.length ?? 0) / 2_000));
  }
  if (item.kind === "diff" || item.kind === "review") {
    const textLength = item.kind === "diff" ? item.diff.length : item.text.length;
    return 1 + Math.min(20, Math.floor(textLength / 2_000));
  }
  return 1;
}

export function estimateTimelineProjectionRenderWeight(row: TimelineProjectionRow) {
  if (row.kind !== "entry") {
    return row.kind === "bottomAnchor" ? 0 : 1;
  }
  if (row.entry.kind === "item") {
    return estimateConversationItemRenderWeight(row.entry.item);
  }
  return row.entry.items.reduce(
    (total, item) => total + estimateConversationItemRenderWeight(item),
    0,
  );
}

export function estimateTimelineProjectionRowSize(row: TimelineProjectionRow) {
  switch (row.kind) {
    case "entry":
      return row.entry.kind === "item" ? 112 : 168;
    case "dockedReasoning":
      return 96;
    case "tailUserInput":
      return 132;
    case "liveMiddleCollapsed":
      return 44;
    case "workingIndicator":
      return 52;
    case "emptyState":
      return 160;
    case "approval":
      return 132;
    case "bottomAnchor":
      return 1;
  }
}

export function getActiveLiveTimelineRowKeys(input: {
  rows: readonly TimelineProjectionRow[];
  liveAssistantItemId?: string | null;
  liveReasoningItemId?: string | null;
}) {
  const liveItemIds = new Set(
    [input.liveAssistantItemId, input.liveReasoningItemId].filter(
      (itemId): itemId is string => typeof itemId === "string" && itemId.length > 0,
    ),
  );
  if (liveItemIds.size === 0) {
    return [];
  }
  return input.rows
    .filter((row) => {
      if (row.kind === "entry") {
        return row.itemIds.some((itemId) => liveItemIds.has(itemId));
      }
      if (row.kind === "dockedReasoning") {
        return liveItemIds.has(row.itemId);
      }
      return false;
    })
    .map((row) => row.key);
}

export type TimelineVirtualizerStabilityState =
  | "stable"
  | "empty-visible-set"
  | "active-live-row-missing";

export function classifyTimelineVirtualizerStability(input: {
  shouldVirtualize: boolean;
  rowCount: number;
  hasScrollElement: boolean;
  virtualItemKeys: ReadonlyArray<unknown>;
  activeLiveRowKeys: readonly string[];
  streamingActive: boolean;
}): TimelineVirtualizerStabilityState {
  if (!input.shouldVirtualize || !input.hasScrollElement || input.rowCount <= 0) {
    return "stable";
  }
  if (input.virtualItemKeys.length === 0) {
    return "empty-visible-set";
  }
  if (!input.streamingActive || input.activeLiveRowKeys.length === 0) {
    return "stable";
  }
  const visibleKeys = new Set(input.virtualItemKeys.map(String));
  return input.activeLiveRowKeys.some((rowKey) => !visibleKeys.has(rowKey))
    ? "active-live-row-missing"
    : "stable";
}

export function observeTimelineElementOffset<TScrollElement extends Element>(
  instance: Virtualizer<TScrollElement, Element>,
  callback: (offset: number, isScrolling: boolean) => void,
) {
  const element = instance.scrollElement;
  const targetWindow = instance.targetWindow;
  if (!element || !targetWindow) {
    return;
  }

  let offset = 0;
  let timeoutId: number | null = null;
  const clearPendingScrollEnd = () => {
    if (timeoutId !== null) {
      targetWindow.clearTimeout(timeoutId);
      timeoutId = null;
    }
  };
  const supportsScrollEnd = "onscrollend" in targetWindow;
  const useScrollEndEvent = instance.options.useScrollendEvent && supportsScrollEnd;

  const scheduleScrollEndFallback = () => {
    if (useScrollEndEvent) {
      return;
    }
    clearPendingScrollEnd();
    timeoutId = targetWindow.setTimeout(() => {
      timeoutId = null;
      callback(offset, false);
    }, instance.options.isScrollingResetDelay);
  };

  const createHandler = (isScrolling: boolean) => () => {
    offset = instance.options.horizontal
      ? element.scrollLeft * (instance.options.isRtl ? -1 : 1)
      : element.scrollTop;
    scheduleScrollEndFallback();
    callback(offset, isScrolling);
  };
  const scrollHandler = createHandler(true);
  const scrollEndHandler = createHandler(false);
  element.addEventListener("scroll", scrollHandler, { passive: true });
  if (useScrollEndEvent) {
    element.addEventListener("scrollend", scrollEndHandler, { passive: true });
  }
  return () => {
    clearPendingScrollEnd();
    element.removeEventListener("scroll", scrollHandler);
    if (useScrollEndEvent) {
      element.removeEventListener("scrollend", scrollEndHandler);
    }
  };
}
