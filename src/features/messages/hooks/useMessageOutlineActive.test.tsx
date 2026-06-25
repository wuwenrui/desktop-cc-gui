// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MarkdownOutlineEntry } from "../../markdown/fastMarkdownRenderer";
import { useMessageOutlineActive } from "./useMessageOutlineActive";

function entry(id: string, startLine: number, endLine = startLine): MarkdownOutlineEntry {
  return {
    id,
    anchor: id,
    title: id,
    depth: 2,
    startLine,
    endLine,
    ordinal: startLine,
  };
}

describe("useMessageOutlineActive", () => {
  beforeEach(() => {
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.defineProperty(window, "innerHeight", {
      value: 500,
      configurable: true,
    });
  });

  it("returns null for empty outline", () => {
    const ref = createRef<HTMLElement>();

    const { result } = renderHook(() => useMessageOutlineActive([], ref));

    expect(result.current.activeHeadingId).toBeNull();
  });

  it("tracks the nearest heading at or above the viewport top", () => {
    const node = document.createElement("div");
    Object.defineProperty(node, "scrollHeight", { value: 1000, configurable: true });
    node.getBoundingClientRect = () => ({
      top: -250,
      left: 0,
      right: 400,
      bottom: 500,
      width: 400,
      height: 1000,
      x: 0,
      y: -250,
      toJSON: () => ({}),
    });
    const ref = { current: node };
    const outline = [entry("intro", 1), entry("middle", 50), entry("end", 100)];

    const { result } = renderHook(() => useMessageOutlineActive(outline, ref));

    act(() => {
      window.dispatchEvent(new Event("scroll"));
    });

    expect(result.current.activeHeadingId).toBe("middle");
  });
});
