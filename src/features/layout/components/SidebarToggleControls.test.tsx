// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

const mocks = vi.hoisted(() => ({
  isWindowsPlatform: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "menu.closeWindow": "Close window",
        "menu.maximize": "Maximize",
        "menu.minimize": "Minimize",
        "common.restore": "Restore",
        "sidebar.showThreadsSidebar": "Show threads sidebar",
        "sidebar.hideThreadsSidebar": "Hide threads sidebar",
      };
      return translations[key] ?? key;
    },
  }),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: vi.fn(),
}));

vi.mock("../../../utils/platform", () => ({
  isWindowsPlatform: mocks.isWindowsPlatform,
}));

import {
  SidebarCollapseButton,
  TitlebarExpandControls,
  type SidebarToggleProps,
} from "./SidebarToggleControls";

const baseProps: SidebarToggleProps = {
  isCompact: false,
  sidebarCollapsed: true,
  rightPanelCollapsed: false,
  onCollapseSidebar: vi.fn(),
  onExpandSidebar: vi.fn(),
  onCollapseRightPanel: vi.fn(),
  onExpandRightPanel: vi.fn(),
};

describe("TitlebarExpandControls", () => {
  beforeEach(() => {
    mocks.isWindowsPlatform.mockReset();
    mocks.isWindowsPlatform.mockReturnValue(false);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders a floating sidebar restore button when requested on non-Windows desktops", () => {
    render(
      createElement(TitlebarExpandControls as never, {
        ...baseProps,
        showSidebarTitlebarToggle: true,
      }),
    );

    expect(
      screen.getByRole("button", { name: "Show threads sidebar" }),
    ).toBeTruthy();
  });

  it("renders distinct Windows window controls and swapped floating sidebar restore groups", () => {
    mocks.isWindowsPlatform.mockReturnValue(true);

    const { container } = render(
      createElement(TitlebarExpandControls as never, {
        ...baseProps,
        isLayoutSwapped: true,
        showSidebarTitlebarToggle: true,
      }),
    );

    const windowControls = container.querySelector(".titlebar-window-controls");
    const sidebarToggle = container.querySelector(".titlebar-sidebar-toggle");

    expect(windowControls).toBeTruthy();
    expect(windowControls?.classList.contains("titlebar-toggle-right")).toBe(true);
    expect(sidebarToggle).toBeTruthy();
    expect(sidebarToggle?.classList.contains("titlebar-toggle-right")).toBe(true);
    expect(screen.getByRole("button", { name: "Show threads sidebar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Minimize" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Maximize" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close window" })).toBeTruthy();
  });

  it("shows a tooltip for the sidebar collapse button on hover", async () => {
    vi.useFakeTimers();
    try {
      render(
        <SidebarCollapseButton
          {...baseProps}
          sidebarCollapsed={false}
        />,
      );

      await act(async () => {
        fireEvent.mouseEnter(screen.getByRole("button", { name: "Hide threads sidebar" }));
        await vi.advanceTimersByTimeAsync(250);
      });

      const tooltips = screen.getAllByRole("tooltip");
      expect(tooltips[tooltips.length - 1]?.textContent).toContain("Hide threads sidebar");
    } finally {
      vi.useRealTimers();
    }
  });
});
