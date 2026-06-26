// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CuratedSkillIndicator } from "./CuratedSkillIndicator";
import type { CuratedSkillOption } from "../../../types";

const sampleSkills: CuratedSkillOption[] = [
  {
    name: "lazy-senior-dev",
    displayName: "Lazy senior dev",
    version: "4.8.1",
    description: "Ponytail 7-level Ladder",
    icon: "sparkles",
    category: "code-style",
    tokenEstimate: 1100,
    source: "upstream",
    license: "MIT",
    enabled: true,
  },
  {
    name: "design-review",
    displayName: "Design review",
    version: "1.0.0",
    description: "Pixel-pushers' checklist",
    icon: "wand",
    category: "review",
    tokenEstimate: 800,
    source: "upstream",
    license: "MIT",
    enabled: true,
  },
];

const enabledIdsState: { current: string[] } = { current: [] };
const skillsState: { current: typeof sampleSkills } = { current: sampleSkills };

vi.mock("../../../services/tauri", () => ({
  getEnabledCuratedSkillIds: () => Promise.resolve(enabledIdsState.current),
  getCuratedSkills: () => Promise.resolve(skillsState.current),
}));

beforeEach(() => {
  enabledIdsState.current = [];
  skillsState.current = sampleSkills;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CuratedSkillIndicator", () => {
  it("renders nothing when no curated skills are enabled", async () => {
    enabledIdsState.current = [];
    const { container } = render(<CuratedSkillIndicator />);
    await waitFor(() => {
      expect(
        container.querySelector('[data-testid="curated-indicator"]'),
      ).toBeNull();
    });
  });

  it("renders one chip per enabled skill, name-only, when at least one is enabled", async () => {
    enabledIdsState.current = ["lazy-senior-dev"];
    render(<CuratedSkillIndicator />);
    await waitFor(() => {
      expect(
        screen.getByTestId("curated-indicator-chip-lazy-senior-dev"),
      ).toBeTruthy();
    });
    expect(screen.getByText("Lazy senior dev")).toBeTruthy();
    // The chip carries name + icon only; token counts and the trailing
    // `1 skills · 1.1K tokens` summary are intentionally absent.
    expect(screen.queryByText(/1\.1K tokens/)).toBeNull();
    expect(screen.queryByTestId("curated-indicator-total")).toBeNull();
  });

  it("renders the chip as a button and forwards click to onOpenSkillsSettings", async () => {
    enabledIdsState.current = ["lazy-senior-dev"];
    const onOpenSkillsSettings = vi.fn();
    render(
      <CuratedSkillIndicator onOpenSkillsSettings={onOpenSkillsSettings} />,
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("curated-indicator-chip-lazy-senior-dev"),
      ).toBeTruthy();
    });
    const chip = screen.getByTestId("curated-indicator-chip-lazy-senior-dev");
    expect(chip.tagName).toBe("BUTTON");
    expect(chip.getAttribute("aria-label")).toMatch(/open Skills settings/i);
    fireEvent.click(chip);
    expect(onOpenSkillsSettings).toHaveBeenCalledTimes(1);
  });

  it("falls back to a read-only span when no onOpenSkillsSettings is provided", async () => {
    enabledIdsState.current = ["lazy-senior-dev"];
    render(<CuratedSkillIndicator />);
    await waitFor(() => {
      expect(
        screen.getByTestId("curated-indicator-chip-lazy-senior-dev"),
      ).toBeTruthy();
    });
    const chip = screen.getByTestId("curated-indicator-chip-lazy-senior-dev");
    expect(chip.tagName).toBe("SPAN");
  });

  it("shows an overflow badge when more than 2 skills are enabled", async () => {
    const extended: CuratedSkillOption[] = [
      ...sampleSkills,
      {
        name: "third",
        displayName: "Third skill",
        version: "1.0.0",
        description: "",
        icon: "package",
        category: "debug",
        tokenEstimate: 500,
        source: "upstream",
        license: "MIT",
        enabled: true,
      },
    ];
    skillsState.current = extended;
    enabledIdsState.current = ["lazy-senior-dev", "design-review", "third"];
    render(<CuratedSkillIndicator />);
    await waitFor(() => {
      expect(
        screen.getByTestId("curated-indicator-overflow"),
      ).toBeTruthy();
    });
    expect(screen.getByTestId("curated-indicator-overflow").textContent).toBe(
      "+1",
    );
  });

  it("polls the backend so toggling on a skill in Settings is reflected", async () => {
    vi.useFakeTimers();
    enabledIdsState.current = [];
    render(<CuratedSkillIndicator />);
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.queryByTestId("curated-indicator")).toBeNull();
    // Simulate the user toggling Lazy senior dev on in Settings. The
    // indicator should pick this up on its next poll (2s interval).
    enabledIdsState.current = ["lazy-senior-dev"];
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByTestId("curated-indicator")).toBeTruthy();
  });
});
