// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OtherSection } from "./OtherSection";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (typeof params?.count === "number") {
        return `${key}:${params.count}`;
      }
      return key;
    },
  }),
}));

vi.mock("../../HistoryCompletionSettings", () => ({
  HistoryCompletionSettings: () => <div data-testid="history-completion-settings" />,
}));

vi.mock("./CostBudgetSettingsSection", () => ({
  CostBudgetSettingsSection: () => <div data-testid="cost-budget-settings" />,
}));

vi.mock("../../SessionRadarHistoryManagementSection", () => ({
  SessionRadarHistoryManagementSection: () => (
    <div data-testid="session-radar-history-management" />
  ),
}));

function renderOtherSection() {
  return render(
    <OtherSection
      title="Other"
      description="Other settings"
      sessionRadarRecentCompletedSessions={[]}
      onDeleteSessionRadarHistory={vi.fn()}
    />,
  );
}

describe("OtherSection performance diagnostics", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("clears known realtime performance overrides and asks for reload", () => {
    window.localStorage.setItem("ccgui.perf.realtimeBatching", "0");
    window.localStorage.setItem("ccgui.perf.backgroundRenderGating", "off");
    window.localStorage.setItem("ccgui.other.flag", "kept");

    renderOtherSection();

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.performanceFlagsResetButton",
      }),
    );

    expect(window.localStorage.getItem("ccgui.perf.realtimeBatching")).toBeNull();
    expect(window.localStorage.getItem("ccgui.perf.backgroundRenderGating")).toBeNull();
    expect(window.localStorage.getItem("ccgui.other.flag")).toBe("kept");
    expect(
      screen.getByText("settings.performanceFlagsResetDone:2"),
    ).toBeTruthy();
  });

  it("reports default state when there are no overrides to clear", () => {
    renderOtherSection();

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.performanceFlagsResetButton",
      }),
    );

    expect(
      screen.getByText("settings.performanceFlagsResetAlreadyDefault"),
    ).toBeTruthy();
  });
});
