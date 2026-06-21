import type { Virtualizer } from "@tanstack/react-virtual";
import { describe, expect, it, vi } from "vitest";
import {
  classifyTimelineVirtualizerStability,
  estimateTimelineProjectionRowSize,
  estimateTimelineProjectionRenderWeight,
  getActiveLiveTimelineRowKeys,
  observeTimelineElementOffset,
  shouldVirtualizeTimelineRows,
  TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT,
  TIMELINE_VIRTUALIZATION_MIN_ROWS,
} from "./messagesTimelineVirtualization";
import type { TimelineProjectionRow } from "./messagesTimelineProjection";

describe("messagesTimelineVirtualization", () => {
  it("enables virtualization only for long stable timelines", () => {
    expect(shouldVirtualizeTimelineRows({
      isThinking: false,
      rowCount: TIMELINE_VIRTUALIZATION_MIN_ROWS,
    })).toBe(true);
    expect(shouldVirtualizeTimelineRows({
      isThinking: false,
      rowCount: TIMELINE_VIRTUALIZATION_MIN_ROWS - 1,
    })).toBe(false);
  });

  it("keeps active streaming timelines virtualized when rowCount is above the minimum (chat-stream-render-isolation-2026-06 task 2.1)", () => {
    expect(shouldVirtualizeTimelineRows({
      isThinking: true,
      rowCount: 1_000,
    })).toBe(true);
    expect(shouldVirtualizeTimelineRows({
      isThinking: true,
      rowCount: 200,
    })).toBe(true);
    expect(shouldVirtualizeTimelineRows({
      isThinking: true,
      rowCount: 50,
    })).toBe(false);
  });

  it("enables virtualization for image-heavy streaming timelines by render weight", () => {
    expect(shouldVirtualizeTimelineRows({
      isThinking: true,
      rowCount: 12,
      renderWeight: TIMELINE_VIRTUALIZATION_MIN_RENDER_WEIGHT,
    })).toBe(true);
  });

  it("estimates grouped rows higher than a single item row", () => {
    const singleRow: TimelineProjectionRow = {
      kind: "entry",
      key: "item:message:1",
      entry: {
        kind: "item",
        item: { id: "message-1", kind: "message", role: "assistant", text: "hello" },
      },
      itemIds: ["message-1"],
      hasActiveUserInputAnchor: false,
    };
    const groupRow: TimelineProjectionRow = {
      kind: "entry",
      key: "readGroup:1:2:2",
      entry: {
        kind: "readGroup",
        items: [
          {
            id: "tool-1",
            kind: "tool",
            toolType: "Read",
            title: "Read",
            detail: "a.ts",
            status: "completed",
          },
          {
            id: "tool-2",
            kind: "tool",
            toolType: "Read",
            title: "Read",
            detail: "b.ts",
            status: "completed",
          },
        ],
      },
      itemIds: ["tool-1", "tool-2"],
      hasActiveUserInputAnchor: false,
    };

    expect(estimateTimelineProjectionRowSize(groupRow)).toBeGreaterThan(
      estimateTimelineProjectionRowSize(singleRow),
    );
  });

  it("assigns high render weight to image-heavy message rows", () => {
    const imageRow: TimelineProjectionRow = {
      kind: "entry",
      key: "item:message:image",
      entry: {
        kind: "item",
        item: {
          id: "message-image",
          kind: "message",
          role: "user",
          text: "screenshot",
          images: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"],
        },
      },
      itemIds: ["message-image"],
      hasActiveUserInputAnchor: false,
    };

    expect(estimateTimelineProjectionRenderWeight(imageRow)).toBeGreaterThan(40);
  });

  it("finds active live row keys from item and docked reasoning rows", () => {
    const rows: TimelineProjectionRow[] = [
      {
        kind: "entry",
        key: "item:message:assistant-live",
        entry: {
          kind: "item",
          item: {
            id: "assistant-live",
            kind: "message",
            role: "assistant",
            text: "streaming",
          },
        },
        itemIds: ["assistant-live"],
        hasActiveUserInputAnchor: false,
      },
      {
        kind: "dockedReasoning",
        key: "claude-live:reasoning-live",
        itemId: "reasoning-live",
      },
      { kind: "workingIndicator", key: "working-indicator" },
    ];

    expect(getActiveLiveTimelineRowKeys({
      rows,
      liveAssistantItemId: "assistant-live",
      liveReasoningItemId: "reasoning-live",
    })).toEqual(["item:message:assistant-live", "claude-live:reasoning-live"]);
  });

  it("classifies empty virtualizer output as suspicious only when rows can render", () => {
    expect(classifyTimelineVirtualizerStability({
      shouldVirtualize: true,
      rowCount: 8,
      hasScrollElement: true,
      virtualItemKeys: [],
      activeLiveRowKeys: [],
      streamingActive: false,
    })).toBe("empty-visible-set");

    expect(classifyTimelineVirtualizerStability({
      shouldVirtualize: true,
      rowCount: 8,
      hasScrollElement: false,
      virtualItemKeys: [],
      activeLiveRowKeys: [],
      streamingActive: false,
    })).toBe("stable");
  });

  it("classifies missing active live rows during streaming", () => {
    expect(classifyTimelineVirtualizerStability({
      shouldVirtualize: true,
      rowCount: 8,
      hasScrollElement: true,
      virtualItemKeys: ["item:message:older", "working-indicator"],
      activeLiveRowKeys: ["item:message:assistant-live"],
      streamingActive: true,
    })).toBe("active-live-row-missing");

    expect(classifyTimelineVirtualizerStability({
      shouldVirtualize: true,
      rowCount: 8,
      hasScrollElement: true,
      virtualItemKeys: ["item:message:assistant-live", "working-indicator"],
      activeLiveRowKeys: ["item:message:assistant-live"],
      streamingActive: true,
    })).toBe("stable");
  });

  it("clears pending scroll-end fallback when virtualizer unmounts", () => {
    const listeners = new Map<string, EventListener>();
    const element = {
      scrollLeft: 0,
      scrollTop: 240,
      addEventListener: vi.fn((eventName: string, listener: EventListener) => {
        listeners.set(eventName, listener);
      }),
      removeEventListener: vi.fn(),
    } as unknown as Element & { scrollLeft: number; scrollTop: number };
    const setTimeoutSpy = vi.fn(() => 7);
    const clearTimeoutSpy = vi.fn();
    const targetWindow = {
      setTimeout: setTimeoutSpy,
      clearTimeout: clearTimeoutSpy,
    } as unknown as Window & typeof globalThis;
    const instance = {
      scrollElement: element,
      targetWindow,
      options: {
        horizontal: false,
        isRtl: false,
        isScrollingResetDelay: 150,
        useScrollendEvent: false,
      },
    } as Virtualizer<Element, Element>;
    const callback = vi.fn();

    const cleanup = observeTimelineElementOffset(instance, callback);
    listeners.get("scroll")?.(new Event("scroll"));
    cleanup?.();

    expect(callback).toHaveBeenCalledWith(240, true);
    expect(setTimeoutSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(7);
  });
});
