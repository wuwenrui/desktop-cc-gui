// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
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
      getVirtualItems: () =>
        Array.from({ length: visibleCount }, (_, index) => ({
          index,
          key: options.getItemKey(index),
          start: index * options.estimateSize(index),
        })),
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
  Markdown: ({ value, className }: { value: string; className?: string }) => (
    <div className={className}>{value}</div>
  ),
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
});
