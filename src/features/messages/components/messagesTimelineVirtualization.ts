import type { Virtualizer } from "@tanstack/react-virtual";
import type { TimelineProjectionRow } from "./messagesTimelineProjection";

export const TIMELINE_VIRTUALIZATION_MIN_ROWS = 200;

export function shouldVirtualizeTimelineRows(input: {
  isThinking: boolean;
  rowCount: number;
}) {
  return input.rowCount >= TIMELINE_VIRTUALIZATION_MIN_ROWS && !input.isThinking;
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
