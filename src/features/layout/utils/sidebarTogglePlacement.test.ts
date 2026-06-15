import { describe, expect, it } from "vitest";
import {
  shouldShowMainTopbarSidebarToggle,
  shouldShowFloatingTitlebarSidebarToggle,
  shouldShowSidebarTopbarSidebarToggle,
} from "./sidebarTogglePlacement";

describe("sidebarTogglePlacement", () => {
  it("shows the sidebar titlebar toggle while the desktop sidebar is expanded", () => {
    expect(
      shouldShowSidebarTopbarSidebarToggle({
        isCompact: false,
        isMacDesktop: true,
        isSoloMode: false,
        sidebarCollapsed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowMainTopbarSidebarToggle({
        isCompact: false,
        isMacDesktop: true,
        isSoloMode: false,
        sidebarCollapsed: false,
      }),
    ).toBe(false);
  });

  it("keeps a restore toggle in the main topbar after the desktop sidebar is collapsed", () => {
    expect(
      shouldShowSidebarTopbarSidebarToggle({
        isCompact: false,
        isMacDesktop: true,
        isSoloMode: false,
        sidebarCollapsed: true,
      }),
    ).toBe(false);
    expect(
      shouldShowMainTopbarSidebarToggle({
        isCompact: false,
        isMacDesktop: true,
        isSoloMode: false,
        sidebarCollapsed: true,
      }),
    ).toBe(true);
  });

  it("uses the sidebar titlebar toggle on non-mac desktop layouts while expanded", () => {
    expect(
      shouldShowSidebarTopbarSidebarToggle({
        isCompact: false,
        isMacDesktop: false,
        isSoloMode: false,
        sidebarCollapsed: false,
      }),
    ).toBe(true);
    expect(
      shouldShowMainTopbarSidebarToggle({
        isCompact: false,
        isMacDesktop: false,
        isSoloMode: false,
        sidebarCollapsed: false,
      }),
    ).toBe(false);
  });

  it("hides both toggle placements in compact or solo layouts", () => {
    expect(
      shouldShowSidebarTopbarSidebarToggle({
        isCompact: true,
        isMacDesktop: true,
        isSoloMode: false,
        sidebarCollapsed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowMainTopbarSidebarToggle({
        isCompact: true,
        isMacDesktop: true,
        isSoloMode: false,
        sidebarCollapsed: true,
      }),
    ).toBe(false);

    expect(
      shouldShowSidebarTopbarSidebarToggle({
        isCompact: false,
        isMacDesktop: true,
        isSoloMode: true,
        sidebarCollapsed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowMainTopbarSidebarToggle({
        isCompact: false,
        isMacDesktop: false,
        isSoloMode: true,
        sidebarCollapsed: false,
      }),
    ).toBe(false);
  });

  it("uses a floating titlebar toggle on the homepage when the main topbar toggle would otherwise be hidden", () => {
    expect(
      shouldShowFloatingTitlebarSidebarToggle({
        showHome: true,
        showMainTopbarSidebarToggle: true,
      }),
    ).toBe(true);
    expect(
      shouldShowFloatingTitlebarSidebarToggle({
        showHome: false,
        showMainTopbarSidebarToggle: true,
      }),
    ).toBe(false);
    expect(
      shouldShowFloatingTitlebarSidebarToggle({
        showHome: true,
        showMainTopbarSidebarToggle: false,
      }),
    ).toBe(false);
  });
});
