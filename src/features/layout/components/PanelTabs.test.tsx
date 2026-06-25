// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PanelTabs } from "./PanelTabs";

describe("PanelTabs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the active tab and overflow trigger as non-drag interactive controls", () => {
    const onSelect = vi.fn();

    render(<PanelTabs active="files" onSelect={onSelect} />);

    const filesButton = screen.getByRole("button", { name: "panels.files" });
    const moreButton = screen.getByRole("button", { name: "common.moreActions" });

    expect(filesButton.getAttribute("data-tauri-drag-region")).toBe("false");
    expect(moreButton.getAttribute("data-tauri-drag-region")).toBe("false");

    fireEvent.pointerDown(moreButton, {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "panels.search" }));
    expect(onSelect).toHaveBeenCalledWith("search");
  });

  it("shows a tooltip when hovering an icon-only panel tab", async () => {
    const onSelect = vi.fn();

    render(<PanelTabs active="search" onSelect={onSelect} />);

    await act(async () => {
      fireEvent.mouseEnter(screen.getByRole("button", { name: "panels.search" }));
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(screen.getByRole("tooltip").textContent).toContain("panels.search");
  });

  it("marks the activity tab as live when realtime activity is flowing", () => {
    const onSelect = vi.fn();

    const view = render(
      <PanelTabs active="activity" onSelect={onSelect} liveStates={{ activity: true }} />,
    );

    const activityButton = screen.getByRole("button", { name: "panels.activity" });
    expect(activityButton.classList.contains("is-live")).toBe(true);
    expect(
      view.container.querySelector(".panel-tab.is-live .panel-tab-icon.is-live"),
    ).toBeTruthy();
  });

  it("marks the radar tab as live when global running sessions exist", () => {
    const onSelect = vi.fn();

    render(<PanelTabs active="radar" onSelect={onSelect} liveStates={{ radar: true }} />);

    const radarButton = screen.getByRole("button", { name: "panels.radar" });
    expect(radarButton.classList.contains("is-live")).toBe(true);
  });

  it("removes hidden toolbar entries from the DOM", () => {
    const onSelect = vi.fn();

    render(
      <PanelTabs
        active="files"
        onSelect={onSelect}
        visibleTabs={{ activity: false, git: false, search: false }}
      />,
    );

    expect(screen.queryByRole("button", { name: "panels.activity" })).toBeNull();
    expect(screen.queryByRole("button", { name: "panels.git" })).toBeNull();
    expect(screen.queryByRole("button", { name: "panels.search" })).toBeNull();
    expect(screen.getByRole("button", { name: "panels.files" })).toBeTruthy();
  });

  it("keeps git, files, search, and custom memory tabs selectable after adding activity", () => {
    const onSelect = vi.fn();

    render(
      <PanelTabs
        active="memory"
        onSelect={onSelect}
        tabs={[
          { id: "git", label: "panels.git", icon: <span>git</span> },
          { id: "files", label: "panels.files", icon: <span>files</span> },
          { id: "search", label: "panels.search", icon: <span>search</span> },
          { id: "memory", label: "panels.memory", icon: <span>memory</span> },
          { id: "activity", label: "panels.activity", icon: <span>activity</span> },
        ]}
      />,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "common.moreActions" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "panels.git" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "common.moreActions" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "panels.files" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "common.moreActions" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "panels.search" }));
    fireEvent.click(screen.getByRole("button", { name: "panels.memory" }));

    expect(onSelect).toHaveBeenNthCalledWith(1, "git");
    expect(onSelect).toHaveBeenNthCalledWith(2, "files");
    expect(onSelect).toHaveBeenNthCalledWith(3, "search");
    expect(onSelect).toHaveBeenNthCalledWith(4, "memory");
  });

  it("keeps inactive tabs in the overflow menu until selected", () => {
    const onSelect = vi.fn();

    render(<PanelTabs active="files" onSelect={onSelect} />);

    expect(screen.queryByRole("button", { name: "panels.search" })).toBeNull();

    fireEvent.pointerDown(screen.getByRole("button", { name: "common.moreActions" }), {
      button: 0,
      ctrlKey: false,
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "panels.search" }));

    expect(onSelect).toHaveBeenCalledWith("search");
    expect(screen.getByRole("button", { name: "panels.search" })).toBeTruthy();
  });
});
