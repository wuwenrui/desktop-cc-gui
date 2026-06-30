// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";

const scrollToIndexMock = vi.hoisted(() => vi.fn());
const measureElementMock = vi.hoisted(() => vi.fn());
const measureMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: (options: {
    count: number;
    enabled: boolean;
    estimateSize: (index: number) => number;
    getItemKey: (index: number) => string;
  }) => {
    const visibleCount = options.enabled ? Math.min(20, options.count) : 0;
    return {
      getVirtualItems: () => {
        const visibleIndexes = Array.from({ length: visibleCount }, (_, index) => index);
        if (options.enabled && options.count > visibleCount) {
          visibleIndexes.push(
            ...Array.from({ length: 10 }, (_, offset) => options.count - 10 + offset)
              .filter((index) => index >= 0 && !visibleIndexes.includes(index)),
          );
        }
        return visibleIndexes.map((index) => ({
          index,
          key: options.getItemKey(index),
          start: index * options.estimateSize(index),
        }));
      },
      getTotalSize: () =>
        Array.from({ length: options.count }, (_, index) => options.estimateSize(index))
          .reduce((total, size) => total + size, 0),
      measure: measureMock,
      measureElement: measureElementMock,
      scrollToIndex: scrollToIndexMock,
    };
  },
}));

vi.mock("./Markdown", () => ({
  Markdown: ({
    value,
    className,
    onRenderedValueChange,
  }: {
    value: string;
    className?: string;
    onRenderedValueChange?: (value: string) => void;
  }) => {
    useEffect(() => {
      onRenderedValueChange?.(value);
    }, [onRenderedValueChange, value]);
    return <div className={className}>{value}</div>;
  },
}));

import { Messages } from "./Messages";

describe("Messages virtualized jump behavior", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
  });

  beforeEach(() => {
    scrollToIndexMock.mockClear();
    measureElementMock.mockClear();
    measureMock.mockClear();
    window.localStorage.setItem("ccgui.claude.hideReasoningModule", "0");
    window.localStorage.removeItem("ccgui.messages.live.autoFollow");
    window.localStorage.removeItem("ccgui.messages.live.collapseMiddleSteps");
  });

  afterEach(() => {
    cleanup();
  });

  it("scrolls the virtualized timeline to mount an offscreen jump target", async () => {
    const items: ConversationItem[] = Array.from({ length: 220 }, (_, index) => ({
      id: `u${index + 1}`,
      kind: "message" as const,
      role: "user" as const,
      text: `message ${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-jump-virtualized"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector('[data-message-anchor-id="u180"]')).toBeNull();

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "u180",
        }),
      );
    });

    await waitFor(() => {
      expect(scrollToIndexMock).toHaveBeenCalled();
    });

    expect(scrollToIndexMock.mock.calls.at(-1)).toEqual([
      expect.any(Number),
      { align: "center" },
    ]);
  });

  it("remeasures the virtualized timeline when final assistant markdown grows", async () => {
    const heavyText = "长文段落\n".repeat(1_200);
    const buildItems = (assistantText: string): ConversationItem[] => [
      ...Array.from({ length: 34 }, (_, index) => ({
        id: `u${index + 1}`,
        kind: "message" as const,
        role: "user" as const,
        text: heavyText,
      })),
      {
        id: "assistant-final",
        kind: "message" as const,
        role: "assistant" as const,
        text: assistantText,
        isFinal: true,
      },
    ];

    const view = render(
      <Messages
        items={buildItems("第一段输出")}
        threadId="thread-final-row-remeasure"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(document.querySelector('[data-timeline-virtualized="true"]')).not.toBeNull();
      expect(document.querySelector('[data-message-anchor-id="assistant-final"]')).not.toBeNull();
    }, { timeout: 500 });
    measureMock.mockClear();

    view.rerender(
      <Messages
        items={buildItems("第一段输出\n\n第二段输出".repeat(80))}
        threadId="thread-final-row-remeasure"
        workspaceId="ws-1"
        isThinking={false}
        activeEngine="codex"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    await waitFor(() => {
      expect(measureMock).toHaveBeenCalled();
    }, { timeout: 500 });
  });
});
