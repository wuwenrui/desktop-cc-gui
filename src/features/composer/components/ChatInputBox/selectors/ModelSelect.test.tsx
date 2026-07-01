// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
  it("renders the readiness trigger with provider and selected model chrome", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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
    // Provider is shown as an engine icon, the selected model as text.
    expect(within(trigger).getByTestId("codex-icon")).toBeTruthy();
    expect(trigger.textContent).toContain("demo");

    await user.click(trigger);
    const option = await screen.findByRole("menuitem", { name: /demo/ });
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith("demo");
  });

  it("renders compact grouped provider models and selects provider plus model", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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

    await user.click(
      screen.getByRole("button", { name: "chat.currentModel:models.codex.gpt54.label" }),
    );

    // Group headings render, and grouped items stay compact (no description).
    expect(await screen.findByText("Claude Code")).toBeTruthy();
    expect(screen.getByText("Codex")).toBeTruthy();
    expect(screen.queryByText("hidden")).toBeNull();

    await user.click(screen.getByText("Sonnet 4.6"));

    expect(onProviderModelChange).toHaveBeenCalledWith("claude", "claude-sonnet-4-6");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not display the first model when no model value is selected", () => {
    render(
      <ModelSelect
        value=""
        currentProvider="codex"
        onChange={vi.fn()}
        models={[
          {
            id: "gpt-5.5",
            label: "gpt-5.5",
          },
        ]}
      />,
    );

    const buttonText = screen.getByRole("button").textContent ?? "";

    expect(buttonText).toContain("models.selectModel");
    expect(buttonText).not.toContain("gpt-5.5");
  });

  it("renders independent add model and refresh config footer actions", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    const onAddModel = vi.fn();
    const onRefreshConfig = vi.fn();

    render(
      <ModelSelect
        value="gpt-5.5"
        currentProvider="codex"
        onChange={vi.fn()}
        onAddModel={onAddModel}
        onRefreshConfig={onRefreshConfig}
        models={[{ id: "gpt-5.5", label: "gpt-5.5" }]}
      />,
    );

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByRole("menuitem", { name: "models.refreshConfig" }));

    expect(onRefreshConfig).toHaveBeenCalledTimes(1);
    expect(onAddModel).not.toHaveBeenCalled();

    // Refresh keeps the menu open; the add action is still reachable.
    await user.click(screen.getByRole("menuitem", { name: "models.addModel" }));

    expect(onAddModel).toHaveBeenCalledTimes(1);
    expect(onRefreshConfig).toHaveBeenCalledTimes(1);
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

  it("disables refresh config action while refreshing", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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

    await user.click(screen.getAllByRole("button")[0]);

    const refreshItem = await screen.findByRole("menuitem", {
      name: "models.refreshingConfig",
    });
    expect(refreshItem.getAttribute("data-disabled")).not.toBeNull();
  });

  it("keeps the dropdown usable when refresh config fails", async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
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

    await user.click(screen.getAllByRole("button")[0]);
    await user.click(await screen.findByRole("menuitem", { name: "models.refreshConfig" }));

    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toContain("settings.json invalid");
    });

    expect(screen.getAllByText("Gemini 2.5 Flash").length).toBeGreaterThan(0);
  });
});
