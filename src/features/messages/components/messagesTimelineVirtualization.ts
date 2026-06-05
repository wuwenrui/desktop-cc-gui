import type { Virtualizer } from "@tanstack/react-virtual";
import type { ConversationItem } from "../../../types";
import type { TimelineProjectionRow } from "./messagesTimelineProjection";

export const TIMELINE_VIRTUALIZATION_MIN_ROWS = 200;
export const TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT = 96;

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
  return input.rowCount >= TIMELINE_VIRTUALIZATION_MIN_ROWS && !input.isThinking;
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
