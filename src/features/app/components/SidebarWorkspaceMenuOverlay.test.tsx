// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceMenuAction } from "../hooks/useSidebarMenus";
import { SidebarWorkspaceMenuOverlay } from "./SidebarWorkspaceMenuOverlay";

const translations: Record<string, string> = {
  "sidebar.sessionActionsGroup": "New session",
  "sidebar.workspaceActionsGroup": "Workspace actions",
  "sidebar.unavailableTag": "Unavailable",
  "common.refresh": "Refresh",
};

function t(key: string) {
  return translations[key] ?? key;
}

function createCodexAction(): WorkspaceMenuAction {
  return {
    id: "new-session-codex",
    label: "Codex",
    iconKind: "engine-codex",
    submenuTitle: "Provider selection",
    onSelect: vi.fn(),
    children: [
      {
        id: "provider-disk",
        label: "Disk config",
        badgeLabel: "Disk config",
        iconKind: "engine-codex",
        onSelect: vi.fn(),
      },
      {
        id: "provider-openai",
        label: "OpenAI",
        badgeLabel: "Custom config",
        iconKind: "engine-codex",
        onSelect: vi.fn(),
      },
    ],
  };
}

describe("SidebarWorkspaceMenuOverlay", () => {
  it("renders child options in a fixed flyout outside the root menu", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 560,
    });
    const codexAction = createCodexAction();

    render(
      <SidebarWorkspaceMenuOverlay
        menu={{
          x: 32,
          y: 28,
          groups: [
            {
              id: "new-session",
              label: "New session",
              actions: [codexAction],
            },
          ],
        }}
        t={t}
        onClose={vi.fn()}
        onAction={vi.fn()}
        renderIcon={() => null}
      />,
    );

    const trigger = screen.getByRole("menuitem", { name: "Codex" });
    const rootMenu = screen.getByRole("menu", { name: "New session" });
    rootMenu.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 32,
          right: 272,
          top: 28,
          bottom: 160,
          width: 240,
          height: 132,
          x: 32,
          y: 28,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    trigger.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 40,
          right: 296,
          top: 96,
          bottom: 130,
          width: 256,
          height: 34,
          x: 40,
          y: 96,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.mouseEnter(trigger);

    const submenu = screen.getByRole("menu", { name: "Codex" });
    expect(submenu.classList.contains("sidebar-workspace-submenu")).toBe(true);
    expect(submenu.style.getPropertyValue("--sidebar-workspace-submenu-x")).toBe("272px");
    expect(submenu.style.getPropertyValue("--sidebar-workspace-submenu-y")).toBe("96px");
    expect(screen.getByText("Provider selection")).toBeTruthy();
    expect(screen.getByText("OpenAI")).toBeTruthy();
    expect(screen.getAllByText("Disk config")).toHaveLength(2);
    expect(screen.getByText("Custom config")).toBeTruthy();
  });

  it("opens the child flyout to the left of the root menu near the viewport edge", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 620,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 560,
    });
    const codexAction = createCodexAction();

    render(
      <SidebarWorkspaceMenuOverlay
        menu={{
          x: 330,
          y: 28,
          groups: [
            {
              id: "new-session",
              label: "New session",
              actions: [codexAction],
            },
          ],
        }}
        t={t}
        onClose={vi.fn()}
        onAction={vi.fn()}
        renderIcon={() => null}
      />,
    );

    const trigger = screen.getByRole("menuitem", { name: "Codex" });
    const rootMenu = screen.getByRole("menu", { name: "New session" });
    rootMenu.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 330,
          right: 570,
          top: 28,
          bottom: 160,
          width: 240,
          height: 132,
          x: 330,
          y: 28,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    trigger.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 338,
          right: 562,
          top: 96,
          bottom: 130,
          width: 224,
          height: 34,
          x: 338,
          y: 96,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.mouseEnter(trigger);

    const submenu = screen.getByRole("menu", { name: "Codex" });
    expect(submenu.style.getPropertyValue("--sidebar-workspace-submenu-x")).toBe("70px");
    expect(submenu.style.getPropertyValue("--sidebar-workspace-submenu-y")).toBe("96px");
  });
});
