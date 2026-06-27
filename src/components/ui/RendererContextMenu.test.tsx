// @vitest-environment jsdom
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  clampRendererContextMenuPosition,
  RendererContextMenu,
  type RendererContextMenuState,
} from "./RendererContextMenu";

function createMenu(overrides?: Partial<RendererContextMenuState>): RendererContextMenuState {
  return {
    x: 10,
    y: 20,
    label: "Actions",
    items: [
      {
        type: "item",
        id: "open",
        label: "Open",
        onSelect: vi.fn(),
      },
      {
        type: "item",
        id: "disabled",
        label: "Disabled",
        disabled: true,
        onSelect: vi.fn(),
      },
    ],
    ...overrides,
  };
}

describe("RendererContextMenu", () => {
  it("closes on backdrop click and Escape", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <RendererContextMenu menu={createMenu()} onClose={onClose} />,
    );

    fireEvent.click(document.body.querySelector(".renderer-context-menu-backdrop")!);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<RendererContextMenu menu={createMenu()} onClose={onClose} />);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not activate disabled items", () => {
    const onClose = vi.fn();
    const onDisabledSelect = vi.fn();
    render(
      <RendererContextMenu
        menu={createMenu({
          items: [
            {
              type: "item",
              id: "disabled",
              label: "Disabled",
              disabled: true,
              onSelect: onDisabledSelect,
            },
          ],
        })}
        onClose={onClose}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Disabled" }));

    expect(onDisabledSelect).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes before activating enabled items", () => {
    const events: string[] = [];
    render(
      <RendererContextMenu
        menu={createMenu({
          items: [
            {
              type: "item",
              id: "open",
              label: "Open",
              onSelect: () => {
                events.push("select");
              },
            },
          ],
        })}
        onClose={() => {
          events.push("close");
        }}
      />,
    );

    fireEvent.click(screen.getByRole("menuitem", { name: "Open" }));

    expect(events).toEqual(["close", "select"]);
  });

  it("opens submenu items in a flyout and activates leaf actions", () => {
    const events: string[] = [];
    render(
      <RendererContextMenu
        menu={createMenu({
          items: [
            {
              type: "submenu",
              id: "move-to-folder",
              label: "Move to folder",
              items: [
                {
                  type: "item",
                  id: "move-root",
                  label: "Project root",
                  onSelect: () => {
                    events.push("move-root");
                  },
                },
                {
                  type: "item",
                  id: "move-planning",
                  label: "Planning",
                  onSelect: () => {
                    events.push("move-planning");
                  },
                },
              ],
            },
          ],
        })}
        onClose={() => {
          events.push("close");
        }}
      />,
    );

    const trigger = screen.getByRole("menuitem", { name: "Move to folder" });
    expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
    expect(screen.queryByRole("menu", { name: "Move to folder" })).toBeNull();

    fireEvent.mouseEnter(trigger);

    const submenu = screen.getByRole("menu", { name: "Move to folder" });
    fireEvent.click(within(submenu).getByRole("menuitem", { name: "Planning" }));

    expect(events).toEqual(["close", "move-planning"]);
  });

  it("aligns compact submenu flyouts with the trigger row when viewport space allows", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 900,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 430,
    });
    render(
      <RendererContextMenu
        menu={createMenu({
          items: [
            {
              type: "submenu",
              id: "move-to-folder",
              label: "Move to folder",
              items: [
                {
                  type: "label",
                  id: "root-label",
                  label: "Project root",
                },
                {
                  type: "item",
                  id: "move-planning",
                  label: "Planning",
                  onSelect: vi.fn(),
                },
              ],
            },
          ],
        })}
        onClose={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("menuitem", { name: "Move to folder" });
    trigger.getBoundingClientRect = vi.fn(
      () =>
        ({
          left: 260,
          right: 516,
          top: 300,
          bottom: 340,
          width: 256,
          height: 40,
          x: 260,
          y: 300,
          toJSON: () => ({}),
        }) as DOMRect,
    );

    fireEvent.mouseEnter(trigger);

    const submenu = screen.getByRole("menu", { name: "Move to folder" });
    expect(submenu.style.top).toBe("300px");
    expect(submenu.style.left).toBe("522px");
  });

  it("clamps the menu inside the viewport", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 320,
    });
    Object.defineProperty(window, "innerHeight", {
      configurable: true,
      value: 240,
    });

    expect(
      clampRendererContextMenuPosition(999, 999, {
        width: 120,
        height: 100,
        padding: 8,
      }),
    ).toEqual({ x: 192, y: 132 });
    expect(
      clampRendererContextMenuPosition(-20, -10, {
        width: 120,
        height: 100,
        padding: 8,
      }),
    ).toEqual({ x: 8, y: 8 });
  });
});
