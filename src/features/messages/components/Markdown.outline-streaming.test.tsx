// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MarkdownOutlineEntry } from "../../markdown/fastMarkdownRenderer";
import { Markdown } from "./Markdown";

const extractOutlineFromMarkdownMock = vi.hoisted(() => vi.fn());

vi.mock("../utils/messageOutlineExtractor", () => ({
  extractOutlineFromMarkdown: extractOutlineFromMarkdownMock,
}));

function buildMockOutline(markdown: string): MarkdownOutlineEntry[] {
  return markdown
    .split(/\r?\n/)
    .map((line, index) => {
      const match = line.match(/^(#{1,6})\s+(.+)$/);
      if (!match) {
        return null;
      }
      const title = match[2] ?? "";
      const anchor = title.trim().toLowerCase().replace(/\s+/g, "-");
      return {
        id: anchor,
        anchor,
        title,
        depth: Math.min(6, match[1]?.length ?? 1) as MarkdownOutlineEntry["depth"],
        startLine: index + 1,
        endLine: index + 1,
        ordinal: index + 1,
      };
    })
    .filter((entry): entry is MarkdownOutlineEntry => Boolean(entry));
}

describe("Markdown streaming outline extraction", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    extractOutlineFromMarkdownMock.mockReset();
  });

  it("throttles live partial outline updates and converges after the stream settles", async () => {
    vi.useFakeTimers();
    extractOutlineFromMarkdownMock.mockImplementation(buildMockOutline);
    const onOutlineReady = vi.fn();
    const { rerender } = render(
      <Markdown
        value="# Start"
        liveRenderMode="lightweight"
        streamingThrottleMs={100}
        onOutlineReady={onOutlineReady}
      />,
    );

    expect(onOutlineReady).toHaveBeenLastCalledWith([
      expect.objectContaining({ title: "Start" }),
    ]);
    const initialCallCount = onOutlineReady.mock.calls.length;

    rerender(
      <Markdown
        value={"# Start\n\n## Partial"}
        liveRenderMode="lightweight"
        streamingThrottleMs={100}
        onOutlineReady={onOutlineReady}
      />,
    );
    rerender(
      <Markdown
        value={"# Start\n\n## Final"}
        liveRenderMode="lightweight"
        streamingThrottleMs={100}
        onOutlineReady={onOutlineReady}
      />,
    );

    expect(onOutlineReady).toHaveBeenCalledTimes(initialCallCount);

    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(onOutlineReady).toHaveBeenLastCalledWith([
      expect.objectContaining({ title: "Start" }),
      expect.objectContaining({ title: "Final" }),
    ]);
  });

  it("reuses the latest outline when only the callback identity changes", () => {
    extractOutlineFromMarkdownMock.mockImplementation(buildMockOutline);
    const firstOutlineReady = vi.fn();
    const secondOutlineReady = vi.fn();
    const { rerender } = render(
      <Markdown
        value="# Start"
        liveRenderMode="lightweight"
        streamingThrottleMs={0}
        onOutlineReady={firstOutlineReady}
      />,
    );

    expect(extractOutlineFromMarkdownMock).toHaveBeenCalledTimes(1);
    expect(firstOutlineReady).toHaveBeenCalledTimes(1);

    rerender(
      <Markdown
        value="# Start"
        liveRenderMode="lightweight"
        streamingThrottleMs={0}
        onOutlineReady={secondOutlineReady}
      />,
    );

    expect(extractOutlineFromMarkdownMock).toHaveBeenCalledTimes(1);
    expect(secondOutlineReady).toHaveBeenCalledWith([
      expect.objectContaining({ title: "Start" }),
    ]);
  });
});
