// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FanBoxPanelTabs, resolveActiveFanboxTab } from "./FanBoxPanelTabs";

describe("FanBoxPanelTabs", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the four user-language text tabs with colored dots", () => {
    const onSelect = vi.fn();
    const view = render(<FanBoxPanelTabs active="files" onSelect={onSelect} />);

    expect(screen.getByRole("tab", { name: "fanbox.tabs.evidence" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "fanbox.tabs.changes" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "fanbox.tabs.memory" })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "fanbox.tabs.logs" })).toBeTruthy();

    expect(view.container.querySelector(".fanbox-insp-dot.is-evidence")).toBeTruthy();
    expect(view.container.querySelector(".fanbox-insp-dot.is-changes")).toBeTruthy();
    expect(view.container.querySelector(".fanbox-insp-dot.is-memory")).toBeTruthy();
    expect(view.container.querySelector(".fanbox-insp-dot.is-logs")).toBeTruthy();
  });

  it("maps tab clicks to panel ids (changes→git, logs→activity)", () => {
    const onSelect = vi.fn();
    render(<FanBoxPanelTabs active="files" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("tab", { name: "fanbox.tabs.evidence" }));
    fireEvent.click(screen.getByRole("tab", { name: "fanbox.tabs.changes" }));
    fireEvent.click(screen.getByRole("tab", { name: "fanbox.tabs.memory" }));
    fireEvent.click(screen.getByRole("tab", { name: "fanbox.tabs.logs" }));

    expect(onSelect).toHaveBeenNthCalledWith(1, "evidence");
    expect(onSelect).toHaveBeenNthCalledWith(2, "git");
    expect(onSelect).toHaveBeenNthCalledWith(3, "memoryInspector");
    expect(onSelect).toHaveBeenNthCalledWith(4, "activity");
  });

  it("keeps existing icon tabs reachable behind the overflow control", () => {
    const onSelect = vi.fn();
    render(<FanBoxPanelTabs active="files" onSelect={onSelect} />);

    // 折叠态：旧图标 tabs 不渲染
    expect(screen.queryByRole("button", { name: "panels.files" })).toBeNull();

    const moreButton = screen.getByRole("button", { name: "fanbox.tabs.more" });
    fireEvent.click(moreButton);

    // 展开后现有图标 tabs 全部可选（能力不破坏）
    for (const name of [
      "panels.activity",
      "panels.projectMap",
      "panels.intentCanvas",
      "panels.radar",
      "panels.git",
      "panels.files",
      "panels.search",
      "panels.notes",
    ]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }

    fireEvent.click(screen.getByRole("button", { name: "panels.search" }));
    expect(onSelect).toHaveBeenCalledWith("search");

    // 再点一次收起
    fireEvent.click(moreButton);
    expect(screen.queryByRole("button", { name: "panels.files" })).toBeNull();
  });

  it("highlights the mapped fanbox tab from the active panel id", () => {
    const onSelect = vi.fn();
    const { rerender } = render(<FanBoxPanelTabs active="git" onSelect={onSelect} />);
    expect(
      screen.getByRole("tab", { name: "fanbox.tabs.changes" }).className,
    ).toContain("is-active");

    rerender(<FanBoxPanelTabs active="activity" onSelect={onSelect} />);
    expect(
      screen.getByRole("tab", { name: "fanbox.tabs.logs" }).className,
    ).toContain("is-active");

    rerender(<FanBoxPanelTabs active="evidence" onSelect={onSelect} />);
    expect(
      screen.getByRole("tab", { name: "fanbox.tabs.evidence" }).className,
    ).toContain("is-active");

    rerender(<FanBoxPanelTabs active="memoryInspector" onSelect={onSelect} />);
    expect(
      screen.getByRole("tab", { name: "fanbox.tabs.memory" }).className,
    ).toContain("is-active");

    // 非映射面板（files/search/...）→ 四 tab 均不高亮
    rerender(<FanBoxPanelTabs active="files" onSelect={onSelect} />);
    for (const tab of screen.getAllByRole("tab")) {
      expect(tab.className).not.toContain("is-active");
    }
  });
});

describe("resolveActiveFanboxTab", () => {
  it("maps panel ids to fanbox tab keys", () => {
    expect(resolveActiveFanboxTab("evidence")).toBe("evidence");
    expect(resolveActiveFanboxTab("git")).toBe("changes");
    expect(resolveActiveFanboxTab("memoryInspector")).toBe("memory");
    expect(resolveActiveFanboxTab("activity")).toBe("logs");
    expect(resolveActiveFanboxTab("files")).toBeNull();
    expect(resolveActiveFanboxTab("search")).toBeNull();
    expect(resolveActiveFanboxTab("projectMap")).toBeNull();
  });
});
