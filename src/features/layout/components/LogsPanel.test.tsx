// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LogsPanel } from "./LogsPanel";

describe("LogsPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders the terminal note and embeds the activity content", () => {
    render(
      <LogsPanel onToggleTerminal={vi.fn()}>
        <div data-testid="activity-content">activity</div>
      </LogsPanel>,
    );

    expect(screen.getByText("fanbox.logs.terminalNote")).toBeTruthy();
    expect(screen.getByTestId("activity-content")).toBeTruthy();
  });

  it("triggers onToggleTerminal when the open-terminal entry is clicked", () => {
    const onToggleTerminal = vi.fn();
    render(
      <LogsPanel onToggleTerminal={onToggleTerminal}>
        <div />
      </LogsPanel>,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "fanbox.logs.openTerminal" }),
    );
    expect(onToggleTerminal).toHaveBeenCalledTimes(1);
  });
});
