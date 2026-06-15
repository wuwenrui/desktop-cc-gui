// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AboutView } from "./AboutView";

const setTitleMock = vi.hoisted(() => vi.fn());

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "about.version": "Version",
        "about.tagline": "Next-generation VibeCoding editor",
        "about.github": "GitHub",
      };
      return translations[key] || key;
    },
  }),
}));

vi.mock("@tauri-apps/api/app", () => ({
  getVersion: vi.fn().mockResolvedValue("0.5.30"),
}));

vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setTitle: setTitleMock,
  }),
}));

vi.mock("../../../styles/featureStyleLoaders", () => ({
  loadAboutStyles: vi.fn().mockResolvedValue(undefined),
}));

describe("AboutView", () => {
  beforeEach(() => {
    setTitleMock.mockClear();
  });

  it("uses the LawyerCopilot brand and does not expose a GitHub link", async () => {
    render(<AboutView />);
    await screen.findByText("Version 0.5.30");

    expect(screen.getByText("LawyerCopilot")).toBeTruthy();
    expect(screen.getByAltText("LawyerCopilot icon")).toBeTruthy();
    expect(screen.queryByText("ccgui")).toBeNull();
    expect(screen.queryByRole("button", { name: "GitHub" })).toBeNull();
  });

  it("keeps the about window title aligned with the app brand", async () => {
    render(<AboutView />);
    await screen.findByText("Version 0.5.30");

    expect(setTitleMock).toHaveBeenCalledWith("关于 LawyerCopilot");
  });
});
