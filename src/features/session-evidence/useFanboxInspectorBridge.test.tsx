// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { openInspectorTab } from "./inspectorBus";
import {
  mapInspectorTabToPanelMode,
  useFanboxInspectorBridge,
} from "./useFanboxInspectorBridge";

describe("mapInspectorTabToPanelMode", () => {
  it("maps semantic tabs to panel modes (changes→git, logs→activity)", () => {
    expect(mapInspectorTabToPanelMode("evidence")).toBe("evidence");
    expect(mapInspectorTabToPanelMode("changes")).toBe("git");
    expect(mapInspectorTabToPanelMode("memory")).toBe("memoryInspector");
    expect(mapInspectorTabToPanelMode("logs")).toBe("activity");
  });
});

describe("useFanboxInspectorBridge", () => {
  it("invokes openPanel with the mapped mode when OPEN_INSPECTOR_EVENT fires", () => {
    const openPanel = vi.fn();
    const { unmount } = renderHook(() => useFanboxInspectorBridge(openPanel));

    openInspectorTab("evidence");
    openInspectorTab("changes");
    openInspectorTab("memory");
    openInspectorTab("logs");

    expect(openPanel).toHaveBeenNthCalledWith(1, "evidence");
    expect(openPanel).toHaveBeenNthCalledWith(2, "git");
    expect(openPanel).toHaveBeenNthCalledWith(3, "memoryInspector");
    expect(openPanel).toHaveBeenNthCalledWith(4, "activity");

    unmount();
  });

  it("uses the latest callback without re-subscribing", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = renderHook(
      ({ openPanel }) => useFanboxInspectorBridge(openPanel),
      { initialProps: { openPanel: first } },
    );

    rerender({ openPanel: second });
    openInspectorTab("changes");

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("git");
    unmount();
  });

  it("stops listening after unmount", () => {
    const openPanel = vi.fn();
    const { unmount } = renderHook(() => useFanboxInspectorBridge(openPanel));
    unmount();

    openInspectorTab("logs");
    expect(openPanel).not.toHaveBeenCalled();
  });
});
