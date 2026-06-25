// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationItem } from "../../../types";

const scrollToIndexMock = vi.hoisted(() => vi.fn());
const measureElementMock = vi.hoisted(() => vi.fn());
const measureMock = vi.hoisted(() => vi.fn());
const resizeItemMock = vi.hoisted(() => vi.fn());
const virtualRowSizeOverride = vi.hoisted(() => ({ value: null as number | null }));

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
          size: virtualRowSizeOverride.value ?? options.estimateSize(index),
          start: index * (virtualRowSizeOverride.value ?? options.estimateSize(index)),
        })),
      getTotalSize: () =>
        Array.from({ length: options.count }, (_, index) => options.estimateSize(index))
          .reduce((total, size) => total + size, 0),
      measure: measureMock,
      measureElement: measureElementMock,
      resizeItem: resizeItemMock,
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
import {
  TIMELINE_LIGHTWEIGHT_ROW_PLACEHOLDER_HEIGHT,
  TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MAX_HEIGHT,
} from "./messagesTimelineVirtualization";

describe("Messages virtualized jump behavior", () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = vi.fn();
    }
    if (!HTMLElement.prototype.scrollTo) {
      HTMLElement.prototype.scrollTo = vi.fn();
    }
  });

  beforeEach(() => {
    scrollToIndexMock.mockClear();
    measureElementMock.mockClear();
    measureMock.mockClear();
    resizeItemMock.mockClear();
    virtualRowSizeOverride.value = null;
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

  it("scrolls to an offscreen heavy anchor when render weight triggers virtualization", async () => {
    const heavyMarkdown = [
      "# Heavy section",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 28 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 24 }, (_, index) => `const value${index} = ${index};`),
      "```",
      "<tool_call><invoke name=\"read_file\" /></tool_call>",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 36 }, (_, index) => ({
      id: `heavy-u${index + 1}`,
      kind: "message" as const,
      role: "user" as const,
      text: `${heavyMarkdown}\n\n${index + 1}`,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-heavy-jump"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(container.querySelector('[data-message-anchor-id="heavy-u30"]')).toBeNull();

    act(() => {
      document.dispatchEvent(
        new CustomEvent<string>("ccgui:jump-to-message", {
          detail: "heavy-u30",
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
    const virtualRows = Array.from(
      container.querySelectorAll<HTMLElement>(".messages-virtualized-row"),
    );
    expect(virtualRows.length).toBeGreaterThan(0);
    for (const virtualRow of virtualRows) {
      expect(Number(virtualRow.dataset.virtualRowSize)).toBeLessThanOrEqual(
        TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MAX_HEIGHT,
      );
    }
  });

  it("toggles lightweight summaries and hydrates details on request", async () => {
    const heavyMarkdown = [
      "# Heavy assistant answer",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 18 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 18 }, (_, index) => `const heavyValue${index} = ${index};`),
      "```",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 8 }, (_, index) => ({
      id: `assistant-heavy-${index + 1}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `canonical assistant payload ${index + 1}\n\n${heavyMarkdown}`,
      isFinal: true,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-lightweight-toggle"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("Heavy conversation detected")).toBeTruthy();
    expect(screen.queryByText("Deferred detail")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Use lightweight" }));

    await waitFor(() => {
      expect(screen.getAllByText("Deferred detail").length).toBeGreaterThan(0);
    });
    expect(
      container.querySelector(".messages-lightweight-row-summary .message-copy-button"),
    ).toBeNull();

    fireEvent.click(screen.getAllByRole("button", { name: "Render details" })[0]!);

    await waitFor(() => {
      expect(screen.queryByText("Deferred detail")).toBeNull();
    });
  });

  it("compresses virtual row height when heavy rows render as lightweight summaries", async () => {
    virtualRowSizeOverride.value = TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MAX_HEIGHT;
    const heavyMarkdown = [
      "# Heavy assistant answer",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 20 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 20 }, (_, index) => `const heavyValue${index} = ${index};`),
      "```",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 8 }, (_, index) => ({
      id: `assistant-compact-${index + 1}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `canonical assistant payload ${index + 1}\n\n${heavyMarkdown}`,
      isFinal: true,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-lightweight-compact-height"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use lightweight" }));

    await waitFor(() => {
      expect(
        container.querySelectorAll('[data-conversation-lightweight-virtual-row="true"]').length,
      ).toBeGreaterThan(0);
    });

    for (const virtualRow of Array.from(
      container.querySelectorAll<HTMLElement>('[data-conversation-lightweight-virtual-row="true"]'),
    )) {
      expect(Number(virtualRow.dataset.virtualRowSize)).toBe(
        TIMELINE_LIGHTWEIGHT_ROW_PLACEHOLDER_HEIGHT,
      );
    }
    const virtualCanvas = container.querySelector<HTMLElement>(".messages-virtualized-canvas");
    expect(virtualCanvas).toBeTruthy();
    const virtualCanvasHeight = Number.parseFloat(virtualCanvas?.style.height ?? "0");
    expect(virtualCanvasHeight).toBeLessThanOrEqual(
      TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MAX_HEIGHT * items.length,
    );
    expect(measureMock).toHaveBeenCalled();
    expect(resizeItemMock).toHaveBeenCalledWith(
      expect.any(Number),
      TIMELINE_LIGHTWEIGHT_ROW_PLACEHOLDER_HEIGHT,
    );
  });

  it("uses static lightweight flow after expanding collapsed heavy history", async () => {
    const heavyMarkdown = [
      "# Heavy history answer",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 24 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 24 }, (_, index) => `const historyValue${index} = ${index};`),
      "```",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 36 }, (_, index) => ({
      id: `history-heavy-${index + 1}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `${heavyMarkdown}\n\n${index + 1}`,
      isFinal: true,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-expand-heavy-history-static"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const showEarlierButton = container.querySelector<HTMLButtonElement>(
      ".messages-collapsed-indicator",
    );
    expect(showEarlierButton).toBeTruthy();

    fireEvent.click(showEarlierButton!);

    await waitFor(() => {
      expect(
        container
          .querySelector(".messages-timeline-root")
          ?.getAttribute("data-timeline-static-expanded-history"),
      ).toBe("true");
      expect(
        container
          .querySelector(".messages-timeline-root")
          ?.getAttribute("data-timeline-static-lightweight-history"),
      ).toBe("true");
    });
    expect(container.querySelector(".messages-virtualized-canvas")).toBeNull();
    expect(container.querySelector(".messages-full .messages-lightweight-mode-banner")).toBeTruthy();
    expect(container.querySelectorAll(".messages-lightweight-row-summary").length)
      .toBeGreaterThan(0);
  });

  it("uses static expanded history flow even when lightweight mode is not active", async () => {
    const items: ConversationItem[] = Array.from({ length: 240 }, (_, index) => ({
      id: `history-static-expand-${index + 1}`,
      kind: "message" as const,
      role: index % 2 === 0 ? "user" as const : "assistant" as const,
      text: `plain expanded history message ${index + 1}`,
      isFinal: true,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-expand-history-static"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    const showEarlierButton = container.querySelector<HTMLButtonElement>(
      ".messages-collapsed-indicator",
    );
    expect(showEarlierButton).toBeTruthy();

    fireEvent.click(showEarlierButton!);

    await waitFor(() => {
      expect(
        container
          .querySelector(".messages-timeline-root")
          ?.getAttribute("data-timeline-static-expanded-history"),
      ).toBe("true");
    });
    expect(container.querySelector(".messages-virtualized-canvas")).toBeNull();
    expect(container.querySelector(".messages-full .messages-lightweight-mode-banner")).toBeTruthy();
    expect(container.querySelector(".messages-lightweight-row-summary")).toBeNull();
    expect(screen.getByText("plain expanded history message 1")).toBeTruthy();
  });

  it("does not inject lightweight summary cards while a heavy conversation is streaming", () => {
    const heavyMarkdown = [
      "# Streaming heavy answer",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 32 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 32 }, (_, index) => `const streamingValue${index} = ${index};`),
      "```",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 8 }, (_, index) => ({
      id: `streaming-heavy-${index + 1}`,
      kind: "message" as const,
      role: "assistant" as const,
      text: `${heavyMarkdown}\n\nchunk ${index + 1}`,
      isFinal: index < 7,
    }));

    const { container } = render(
      <Messages
        items={items}
        threadId="thread-heavy-streaming"
        workspaceId="ws-heavy"
        isThinking={true}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.queryByText("Heavy conversation detected")).toBeNull();
    expect(screen.queryByText("Deferred detail")).toBeNull();
    expect(container.querySelector("[data-timeline-virtualized='true']")).toBeNull();
    expect(screen.getAllByText(/Streaming heavy answer/).length).toBeGreaterThan(0);
  });

  it("shows an oversized history prompt before full detail hydration", () => {
    const oversizedMarkdown = [
      "# Oversized section",
      "| A | B | C |",
      "| - | - | - |",
      ...Array.from({ length: 90 }, (_, index) => `| ${index} | value | value |`),
      "```ts",
      ...Array.from({ length: 44 }, (_, index) => `const oversizedValue${index} = ${index};`),
      "```",
      "<tool_call><invoke name=\"read_file\" /></tool_call>",
    ].join("\n");
    const items: ConversationItem[] = Array.from({ length: 12 }, (_, index) => ({
      id: `oversized-u${index + 1}`,
      kind: "message" as const,
      role: "user" as const,
      text: `${oversizedMarkdown}\n\n${index + 1}`,
    }));

    render(
      <Messages
        items={items}
        threadId="thread-oversized-prompt"
        workspaceId="ws-heavy"
        isThinking={false}
        activeEngine="claude"
        openTargets={[]}
        selectedOpenAppId=""
      />,
    );

    expect(screen.getByText("Oversized conversation opened in lightweight mode")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Stay lightweight" })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Render details" }).length)
      .toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "Retry full detail" })).toBeNull();
  });
});
