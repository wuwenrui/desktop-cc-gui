// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OtherSection } from "./OtherSection";

const TRANSLATIONS: Record<string, string> = {
  "settings.streamingScheduleTierTitle": "Streaming schedule tier",
  "settings.streamingScheduleTier.baseline": "Baseline",
  "settings.streamingScheduleTier.guarded": "Guarded",
  "settings.streamingScheduleTier.aggressive": "Aggressive",
  "settings.streamingScheduleTierDetail.baseline": "Baseline detail",
  "settings.streamingScheduleTierDetail.guarded": "Guarded detail",
  "settings.streamingScheduleTierDetail.aggressive": "Aggressive detail",
  "settings.performanceFlagsResetButton": "Reset",
  "settings.performanceFlagsResetAlreadyDefault": "Already default",
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (typeof params?.count === "number") {
        return `${key}:${params.count}`;
      }
      return TRANSLATIONS[key] ?? key;
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
    window.localStorage.setItem("ccgui.perf.streamingScheduleTier", "aggressive");
    window.localStorage.setItem("ccgui.other.flag", "kept");

    renderOtherSection();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset",
      }),
    );

    expect(window.localStorage.getItem("ccgui.perf.realtimeBatching")).toBeNull();
    expect(window.localStorage.getItem("ccgui.perf.backgroundRenderGating")).toBeNull();
    expect(window.localStorage.getItem("ccgui.perf.streamingScheduleTier")).toBeNull();
    expect(window.localStorage.getItem("ccgui.other.flag")).toBe("kept");
    expect(
      screen.getByText("settings.performanceFlagsResetDone:3"),
    ).toBeTruthy();
  });

  it("defaults streaming schedule tier to guarded and persists changes", () => {
    renderOtherSection();

    const select = screen.getByRole("combobox", {
      name: "Streaming schedule tier",
    }) as HTMLSelectElement;
    expect(select.value).toBe("guarded");
    expect(screen.getByText("Baseline")).toBeTruthy();
    expect(screen.getByText("Guarded")).toBeTruthy();
    expect(screen.getByText("Aggressive")).toBeTruthy();
    expect(screen.getByText("Guarded detail")).toBeTruthy();

    fireEvent.change(select, { target: { value: "baseline" } });

    expect(select.value).toBe("baseline");
    expect(screen.getByText("Baseline detail")).toBeTruthy();
    expect(window.localStorage.getItem("ccgui.perf.streamingScheduleTier")).toBe(
      "baseline",
    );
  });

  it("reports default state when there are no overrides to clear", () => {
    renderOtherSection();

    fireEvent.click(
      screen.getByRole("button", {
        name: "Reset",
      }),
    );

    expect(screen.getByText("Already default")).toBeTruthy();
  });
});
