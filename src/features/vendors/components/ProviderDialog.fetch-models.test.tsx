// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { fetchClaudeProviderModels } from "../../../services/tauri";
import { ProviderDialog } from "./ProviderDialog";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) =>
      key === "settings.vendor.dialog.fetchModelsCount"
        ? `${options?.count ?? 0} models loaded`
        : key,
  }),
}));

vi.mock("../../../services/tauri", () => ({
  fetchClaudeProviderModels: vi.fn(),
}));

describe("ProviderDialog model fetching", () => {
  it("fetches models and attaches shared datalist suggestions", async () => {
    vi.mocked(fetchClaudeProviderModels).mockResolvedValueOnce({
      models: ["claude-sonnet-4-6", "claude-opus-4-8"],
      endpoint: "https://proxy.example.com/v1/models",
    });

    render(
      <ProviderDialog
        isOpen
        provider={null}
        onClose={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.dialog.apiUrlPlaceholder"),
      { target: { value: "https://proxy.example.com/anthropic" } },
    );
    fireEvent.change(
      screen.getByPlaceholderText("settings.vendor.dialog.apiKeyPlaceholder"),
      { target: { value: "sk-test" } },
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.vendor.dialog.fetchModels",
      }),
    );

    await waitFor(() => {
      expect(fetchClaudeProviderModels).toHaveBeenCalledWith(
        "https://proxy.example.com/anthropic",
        "sk-test",
      );
    });

    expect(await screen.findByText("2 models loaded")).toBeTruthy();
    const options = Array.from(
      document.querySelectorAll<HTMLOptionElement>(
        "#vendor-fetched-models option",
      ),
    ).map((option) => option.value);
    expect(options).toEqual(["claude-sonnet-4-6", "claude-opus-4-8"]);
    expect(
      screen
        .getByPlaceholderText("settings.vendor.dialog.sonnetModelPlaceholder")
        .getAttribute("list"),
    ).toBe("vendor-fetched-models");
    expect(
      screen
        .getByPlaceholderText("settings.vendor.dialog.opusModelPlaceholder")
        .getAttribute("list"),
    ).toBe("vendor-fetched-models");
    expect(
      screen
        .getByPlaceholderText("settings.vendor.dialog.haikuModelPlaceholder")
        .getAttribute("list"),
    ).toBe("vendor-fetched-models");
  });
});
