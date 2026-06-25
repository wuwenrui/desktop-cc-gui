// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
          size: options.estimateSize(index),
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
import { TIMELINE_VIRTUAL_ROW_PLACEHOLDER_MAX_HEIGHT } from "./messagesTimelineVirtualization";

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

    render(
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
    expect(screen.getAllByRole("button", { name: "messages.copyMessage" }).length)
      .toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole("button", { name: "Hydrate visible details" })[0]!);

    await waitFor(() => {
      expect(screen.queryByText("Deferred detail")).toBeNull();
    });
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
    expect(screen.getByRole("button", { name: "Stay lightweight" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Hydrate visible details" }).length)
      .toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Retry full detail" })).toBeTruthy();
  });
});
