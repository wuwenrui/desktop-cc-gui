// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ModelSelect } from "./ModelSelect";
import { STORAGE_KEYS } from "../../../types/provider";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string>) =>
      params?.model
        ? `${key}:${params.model}`
        : params?.message
          ? `${key}:${params.message}`
          : key,
  }),
}));

vi.mock("../../../../engine/components/EngineIcon", () => ({
  EngineIcon: ({ engine }: { engine: string }) => (
    <span data-testid={`${engine}-icon`} />
  ),
}));

describe("ModelSelect", () => {
  it("renders the readiness trigger with provider and selected model chrome", () => {
    const onChange = vi.fn();

    render(
      <ModelSelect
        value="demo"
        currentProvider="codex"
        providerLabel="Codex"
        triggerVariant="readiness"
        onChange={onChange}
        models={[{ id: "demo", label: "demo" }]}
      />,
    );

    const trigger = screen.getByRole("button", { name: "chat.currentModel:demo" });

    expect(trigger.className).toContain("composer-readiness-target-button");
    expect(trigger.textContent).toContain("Codex");
    expect(trigger.textContent).toContain("demo");

    fireEvent.click(trigger);
    const dropdownOption = screen.getAllByText("demo").find((node) => {
      return node.closest(".selector-option");
    });
    expect(dropdownOption).toBeTruthy();
    fireEvent.click(dropdownOption!);

    expect(onChange).toHaveBeenCalledWith("demo");
  });

  it("renders compact grouped provider models and selects provider plus model", () => {
    const onChange = vi.fn();
    const onProviderModelChange = vi.fn();

    render(
      <ModelSelect
        value="gpt-5.4"
        currentProvider="codex"
        providerLabel="Codex"
        triggerVariant="readiness"
        onChange={onChange}
        onProviderModelChange={onProviderModelChange}
        models={[{ id: "gpt-5.4", label: "GPT-5.4" }]}
        modelGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            models: [{ id: "claude-sonnet-4-6", label: "Sonnet 4.6", description: "hidden" }],
          },
          {
            providerId: "codex",
            providerLabel: "Codex",
            enabled: true,
            models: [{ id: "gpt-5.4", label: "GPT-5.4", description: "hidden" }],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "chat.currentModel:models.codex.gpt54.label" }));

    expect(screen.getByText("Claude Code")).toBeTruthy();
    expect(screen.getAllByText("Codex").length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText("hidden")).toBeNull();

    fireEvent.click(screen.getByText("Sonnet 4.6"));

    expect(onProviderModelChange).toHaveBeenCalledWith("claude", "claude-sonnet-4-6");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("limits only the Codex group to an inner scroll area", () => {
    render(
      <ModelSelect
        value="gpt-5.4"
        currentProvider="codex"
        onChange={vi.fn()}
        modelGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            models: [
              { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
              { id: "claude-opus-4-1", label: "Opus 4.1" },
              { id: "claude-haiku-4-5", label: "Haiku 4.5" },
              { id: "custom-claude", label: "Custom Claude" },
            ],
          },
          {
            providerId: "codex",
            providerLabel: "Codex CLI",
            enabled: true,
            models: [
              { id: "gpt-5.5", label: "gpt-5.5" },
              { id: "gpt-5.4", label: "gpt-5.4" },
              { id: "gpt-5.4-mini", label: "gpt-5.4-mini" },
              { id: "gpt-5.3-codex", label: "gpt-5.3-codex" },
            ],
          },
        ]}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);

    const optionsWraps = Array.from(document.querySelectorAll(".selector-model-group-options"));
    expect(optionsWraps).toHaveLength(2);
    expect(optionsWraps[0].className).not.toContain("selector-model-group-options--scrollable");
    expect(optionsWraps[1].className).toContain("selector-model-group-options--scrollable");
  });

  it("expands runtime vendor options from the group title and switches vendor", async () => {
    const onRefreshConfig = vi.fn();
    const onRuntimeVendorSwitch = vi.fn().mockResolvedValue(undefined);

    render(
      <ModelSelect
        value="gpt-5.5"
        currentProvider="codex"
        onChange={vi.fn()}
        onRefreshConfig={onRefreshConfig}
        onRuntimeVendorSwitch={onRuntimeVendorSwitch}
        runtimeVendorOptions={{
          claude: [
            { id: "claude-default", label: "Krill-GPT", isActive: true },
            { id: "claude-alt", label: "Backup Claude", isActive: false },
          ],
          codex: [
            { id: "codex-main", label: "OpenAI", isActive: true },
            { id: "codex-alt", label: "Azure", isActive: false },
          ],
        }}
        modelGroups={[
          {
            providerId: "claude",
            providerLabel: "Claude Code",
            enabled: true,
            models: [{ id: "claude-sonnet-4-6", label: "Sonnet 4.6" }],
          },
          {
            providerId: "codex",
            providerLabel: "Codex CLI",
            enabled: true,
            models: [{ id: "gpt-5.5", label: "gpt-5.5" }],
          },
        ]}
        models={[{ id: "gpt-5.5", label: "gpt-5.5" }]}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: /Claude Code/ }));
    expect(screen.getByRole("button", { name: "Backup Claude" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Backup Claude" }));

    await waitFor(() => {
      expect(onRuntimeVendorSwitch).toHaveBeenCalledWith("claude", "claude-alt");
    });
    expect(onRefreshConfig).not.toHaveBeenCalled();
  });

  it("uses refreshed model labels passed by the parent instead of stale localStorage mapping", () => {
    window.localStorage.setItem(
      STORAGE_KEYS.CLAUDE_MODEL_MAPPING,
      JSON.stringify({ sonnet: "old-settings-model" }),
    );

    render(
      <ModelSelect
        value="claude-sonnet-4-6"
        currentProvider="claude"
        onChange={vi.fn()}
        models={[{ id: "claude-sonnet-4-6", label: "new-settings-model" }]}
      />,
    );

    const buttonText = screen.getByRole("button").textContent ?? "";

    expect(buttonText).toContain("new-settings-model");
    expect(buttonText).not.toContain("old-settings-model");
  });

  it("does not synthesize a missing Claude selected value as a fallback option", () => {
    render(
      <ModelSelect
        value="sonnet"
        currentProvider="claude"
        onChange={vi.fn()}
        models={[]}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);

    expect(screen.queryByText("sonnet")).toBeNull();
    expect(screen.getByRole("button").textContent ?? "").toContain("models.selectModel");
  });

  it("renders settings-sourced Claude runtime models without legacy family relabeling", () => {
    render(
      <ModelSelect
        value="settings-opus"
        currentProvider="claude"
        onChange={vi.fn()}
        models={[
          {
            id: "settings-opus",
            label: "MiniMax-M4[1m]",
            description: "Custom Opus model configured by ANTHROPIC_DEFAULT_OPUS_MODEL",
          },
        ]}
      />,
    );

    const buttonText = screen.getByRole("button").textContent ?? "";

    expect(buttonText).toContain("MiniMax-M4[1m]");
    expect(buttonText).not.toContain("Opus 4.6");
  });

  it("disables refresh config action while refreshing", () => {
    render(
      <ModelSelect
        value="claude-sonnet-4-6"
        currentProvider="claude"
        onChange={vi.fn()}
        onAddModel={vi.fn()}
        onRefreshConfig={vi.fn()}
        isRefreshingConfig
        models={[{ id: "claude-sonnet-4-6", label: "Sonnet" }]}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);

    const refreshButton = screen.getByRole("button", {
      name: "models.refreshingConfig",
    });
    expect((refreshButton as HTMLButtonElement).disabled).toBe(true);
    expect(refreshButton.getAttribute("aria-busy")).toBe("true");
  });

  it("keeps the dropdown usable when refresh config fails", async () => {
    render(
      <ModelSelect
        value="gemini-2.5-flash"
        currentProvider="gemini"
        onChange={vi.fn()}
        onAddModel={vi.fn()}
        onRefreshConfig={vi.fn().mockRejectedValue(new Error("settings.json invalid"))}
        models={[{ id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" }]}
      />,
    );

    fireEvent.click(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByRole("button", { name: "models.refreshConfig" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("settings.json invalid");
    });

    expect(screen.getAllByText("Gemini 2.5 Flash").length).toBeGreaterThan(0);
  });
});
